import { DurableObject } from "cloudflare:workers";

// Keep the generated class/binding names and v1 SQLite migration stable.
export class MyDurableObject extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS counter (
			id INTEGER PRIMARY KEY CHECK (id = 1),
			views INTEGER NOT NULL CHECK (views >= 0)
		)`);
		ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS counted_requests (
			request_id TEXT PRIMARY KEY
		)`);
		ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS post_likes (
			visitor_id TEXT PRIMARY KEY,
			liked INTEGER NOT NULL CHECK (liked IN (0, 1)),
			revision INTEGER NOT NULL
		)`);
	}

	getLikes(visitorId: string) {
		const state = this.ctx.storage.sql.exec<{ liked: number; revision: number }>(
			"SELECT liked, revision FROM post_likes WHERE visitor_id = ?", visitorId,
		).toArray()[0];
		const likes = this.ctx.storage.sql.exec<{ likes: number }>(
			"SELECT COALESCE(SUM(liked), 0) AS likes FROM post_likes",
		).one().likes;
		return { likes, liked: state?.liked === 1, revision: state?.revision ?? 0 };
	}

	setLike(visitorId: string, liked: boolean, revision: number) {
		return this.ctx.storage.transactionSync(() => {
			const current = this.getLikes(visitorId);
			// A delayed retry must never overwrite a later like/unlike.
			if (current.revision !== revision) return { ...current, conflict: true };
			this.ctx.storage.sql.exec(`INSERT INTO post_likes (visitor_id, liked, revision)
				VALUES (?, ?, ?) ON CONFLICT (visitor_id) DO UPDATE SET
				liked = excluded.liked, revision = excluded.revision`, visitorId, liked ? 1 : 0, revision + 1);
			return { ...this.getLikes(visitorId), conflict: false };
		});
	}

	getViews(): number {
		return this.ctx.storage.sql.exec<{ views: number }>(
			"SELECT views FROM counter WHERE id = 1",
		).toArray()[0]?.views ?? 0;
	}

	incrementViews(requestId: string): number {
		// Persist the receipt and increment together: neither can commit alone.
		return this.ctx.storage.transactionSync(() => {
			const inserted = this.ctx.storage.sql.exec<{ request_id: string }>(
				"INSERT INTO counted_requests (request_id) VALUES (?) ON CONFLICT DO NOTHING RETURNING request_id",
				requestId,
			).toArray();
			if (inserted.length === 0) return this.getViews();
			return this.ctx.storage.sql.exec<{ views: number }>(`
				INSERT INTO counter (id, views) VALUES (1, 1)
				ON CONFLICT (id) DO UPDATE SET views = views + 1
				RETURNING views
			`).one().views;
		});
	}

}

function normalizePostId(value: string | null): string | null {
	if (!value || value.length > 1024) return null;
	try {
		// Accept a pathname (including percent-encoded Korean), never a full URL.
		const decoded = decodeURIComponent(value);
		const match = /^\/posts\/([\p{L}\p{M}\p{N}_-]+)\/?$/u.exec(decoded);
		if (!match) return null;
		const canonical = `/posts/${encodeURIComponent(match[1])}/`;
		return canonical.length <= 1024 ? canonical : null;
	} catch {
		return null;
	}
}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		const origin = request.headers.get("Origin");
		const allowedOrigins = env.ALLOWED_ORIGINS.split(",").map((value) => value.trim());
		const headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
		if (origin && allowedOrigins.includes(origin)) {
			headers.set("Access-Control-Allow-Origin", origin);
		}
		const json = (body: object, status = 200) => Response.json(body, { status, headers });

		// Reject disallowed browser origins before storage access, even for simple POSTs.
		// Requests without Origin (e.g. curl) remain supported; CORS is not authentication.
		if (origin && !allowedOrigins.includes(origin)) {
			return json({ error: "Origin not allowed" }, 403);
		}
		const batch = url.pathname === "/api/views/batch";
		const likes = url.pathname === "/api/likes";
		if (!batch && !likes && url.pathname !== "/api/views") return json({ error: "Not found" }, 404);
		const methods = batch ? ["GET", "OPTIONS"] : ["GET", "POST", "OPTIONS"];
		if (!methods.includes(request.method)) {
			headers.set("Allow", methods.join(", "));
			return json({ error: "Method not allowed" }, 405);
		}
		if (request.method === "OPTIONS") {
			const method = request.headers.get("Access-Control-Request-Method");
			if (method && (!methods.includes(method) || method === "OPTIONS")) {
				headers.set("Allow", methods.join(", "));
				return json({ error: "Method not allowed" }, 405);
			}
			const requestedHeaders = request.headers.get("Access-Control-Request-Headers");
			if (requestedHeaders?.split(",").some((value) => !["content-type", "idempotency-key"].includes(value.trim().toLowerCase()))) {
				return json({ error: "Request headers not allowed" }, 400);
			}
			headers.set("Access-Control-Allow-Methods", methods.join(", "));
			headers.set("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key");
			return new Response(null, { status: 204, headers });
		}

		if (batch) {
			const ids = url.searchParams.getAll("postId");
			if (ids.length === 0 || ids.length > 50 || ids.some(id => !normalizePostId(id))) {
				return json({ error: "Provide 1 to 50 valid postId parameters" }, 400);
			}
			try {
				const unique = [...new Set(ids.map(id => normalizePostId(id)!))];
				const values = new Map(await Promise.all(unique.map(async id =>
					[id, await env.MY_DURABLE_OBJECT.getByName(id).getViews()] as const,
				)));
				return json({ views: Object.fromEntries(ids.map(id => [id, values.get(normalizePostId(id)!)])) });
			} catch (error) {
				console.error("View counter batch request failed", error);
				return json({ error: "View counter temporarily unavailable" }, 503);
			}
		}

		const postId = normalizePostId(url.searchParams.get("postId"));
		if (!postId || url.searchParams.getAll("postId").length !== 1) {
			return json({ error: "Provide one valid postId: /posts/<slug>/ (maximum 1024 characters)" }, 400);
		}
		if (likes) {
			const visitorId = url.searchParams.get("visitorId") ?? "";
			if (url.searchParams.getAll("visitorId").length > 1 ||
				(visitorId !== "" && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitorId)) ||
				(request.method === "POST" && !visitorId)) {
				return json({ error: "Provide a UUID v4 visitorId" }, 400);
			}
			let input: { liked: boolean; revision: number } | undefined;
			if (request.method === "POST") {
				try {
					const body = await request.json() as Record<string, unknown> | null;
					if (!body || typeof body.liked !== "boolean" || !Number.isSafeInteger(body.revision) ||
						(body.revision as number) < 0 || (body.revision as number) >= Number.MAX_SAFE_INTEGER) {
						return json({ error: "Provide boolean liked and non-negative safe integer revision" }, 400);
					}
					input = { liked: body.liked, revision: body.revision as number };
				} catch { return json({ error: "Invalid JSON body" }, 400); }
			}
			try {
				const counter = env.MY_DURABLE_OBJECT.getByName(postId);
				if (!input) return json(await counter.getLikes(visitorId.toLowerCase()));
				const { conflict, ...state } = await counter.setLike(visitorId.toLowerCase(), input.liked, input.revision);
				return json(state, conflict ? 409 : 200);
			} catch (error) {
				console.error("Like counter storage request failed", error);
				return json({ error: "Like counter temporarily unavailable" }, 503);
			}
		}
		const requestId = request.headers.get("Idempotency-Key");
		if (request.method === "POST" && (!requestId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))) {
			return json({ error: "POST requires a UUID v4 Idempotency-Key header" }, 400);
		}
		try {
			const counter = env.MY_DURABLE_OBJECT.getByName(postId);
			const views = request.method === "POST" ? await counter.incrementViews(requestId!.toLowerCase()) : await counter.getViews();
			return json({ views });
		} catch (error) {
			console.error("View counter storage request failed", error);
			return json({ error: "View counter temporarily unavailable" }, 503);
		}
	},
} satisfies ExportedHandler<Env>;
