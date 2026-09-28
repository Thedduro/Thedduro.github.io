#!/usr/bin/env python3
"""Validate production Hugo HTML, sitemap and feeds without network access.

Usage: python3 scripts/check-seo.py [public-directory]
Sitemaps and feeds may intentionally contain only a subset of public pages.
"""
import argparse
from collections import Counter
from datetime import datetime
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
import json
from pathlib import Path
import sys
from urllib.parse import unquote, urljoin, urlsplit
from urllib.robotparser import RobotFileParser
import xml.etree.ElementTree as ET


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.meta, self.canonicals, self.refs = {}, [], []
        self.ids, self.titles, self.jsonld, self.times, self.images = [], [], [], [], []
        self.text, self.h1, self.redirect = [], 0, False
        self.capture, self.buffer = None, []
        self.feed(path.read_text(encoding='utf-8'))

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a:
            self.ids.append(a['id'])
        if tag == 'h1':
            self.h1 += 1
        if tag == 'meta':
            key = a.get('name', a.get('property', '')).lower()
            self.meta.setdefault(key, []).append(a.get('content', ''))
            self.redirect |= a.get('http-equiv', '').lower() == 'refresh'
        if tag == 'link' and a.get('rel') == 'canonical':
            self.canonicals.append(a.get('href', ''))
        if tag in ('a', 'link') and a.get('href'):
            self.refs.append(a['href'])
        if tag in ('img', 'script') and a.get('src'):
            self.refs.append(a['src'])
        if tag == 'img':
            self.images.append(a)
        if tag == 'time':
            self.times.append(a.get('datetime', ''))
        if tag == 'title' or (tag == 'script' and a.get('type') == 'application/ld+json'):
            self.capture, self.buffer = tag, []

    def handle_data(self, data):
        (self.buffer if self.capture else self.text).append(data)

    def handle_endtag(self, tag):
        if tag == self.capture:
            (self.titles if tag == 'title' else self.jsonld).append(''.join(self.buffer))
            self.capture = None


def check(directory):
    root = Path(directory).resolve()
    errors = []

    def require(condition, message):
        if not condition:
            errors.append(message)

    pages = {p.resolve(): Page(p) for p in root.rglob('*.html')}
    home = pages.get(root / 'index.html')
    if not home or len(home.canonicals) != 1:
        return ['홈 HTML과 정확히 하나의 canonical이 필요합니다.']
    base = home.canonicals[0]
    origin = urlsplit(base)
    require(origin.scheme == 'https' and bool(origin.netloc), '프로덕션 baseURL은 HTTPS 절대 URL이어야 합니다.')

    def local_path(url):
        parts = urlsplit(url)
        if parts.scheme not in ('http', 'https') or parts.netloc != origin.netloc:
            return None
        if not parts.path.startswith(origin.path):
            return None
        target = root / unquote(parts.path[len(origin.path):])
        if parts.path.endswith('/'):
            target /= 'index.html'
        return target.resolve()

    def one(page, key, label):
        values = page.meta.get(key, [])
        require(len(values) == 1 and bool(values[0].strip()), f'{label}: {key} 누락/중복')
        return values[0] if values else ''

    def date(value, label):
        try:
            result = datetime.fromisoformat(value.replace('Z', '+00:00'))
            require(result.year > 1 and result.tzinfo is not None, f'{label}: 유효한 날짜와 시간대가 필요합니다.')
            return result if result.tzinfo is not None else None
        except (ValueError, TypeError, AttributeError):
            errors.append(f'{label}: 잘못된 날짜 {value!r}')
            return None

    articles, canonicals = {}, []
    for path, page in pages.items():
        label = path.relative_to(root).as_posix()
        if page.redirect:  # Hugo aliases have their own minimal redirect document.
            continue
        require(len(page.titles) == 1 and bool(page.titles[0].strip()), f'{label}: title 누락/중복')
        require(page.h1 == 1, f'{label}: H1은 하나여야 합니다.')
        require(not [i for i, n in Counter(page.ids).items() if n > 1], f'{label}: HTML ID 중복')
        for image in page.images:
            require('alt' in image, f'{label}: 이미지 alt 속성 누락')
        description = one(page, 'description', label)
        robots = ','.join(page.meta.get('robots', [])).lower()
        if label == '404.html':
            require('noindex' in robots, '404.html: noindex가 필요합니다.')
            continue
        require('noindex' not in robots and 'nofollow' not in robots, f'{label}: 공개 페이지의 색인/링크 차단')
        require(len(page.canonicals) == 1, f'{label}: canonical 누락/중복')
        if not page.canonicals:
            continue
        url = page.canonicals[0]
        canonicals.append(url)
        require(urlsplit(url).scheme == 'https' and local_path(url) == path, f'{label}: canonical 경로 불일치')
        require(one(page, 'og:url', label) == url, f'{label}: OG URL 불일치')
        for prefix in ('og', 'twitter'):
            require(one(page, prefix + ':title', label) == (page.titles[0] if page.titles else ''), f'{label}: {prefix} 제목 불일치')
            require(one(page, prefix + ':description', label) == description, f'{label}: {prefix} 설명 불일치')
        require(one(page, 'twitter:card', label) in ('summary', 'summary_large_image'), f'{label}: Twitter 카드 유형 오류')
        kind = one(page, 'og:type', label)
        schemas = []
        for raw in page.jsonld:
            try:
                data = json.loads(raw)
                require(isinstance(data, (dict, list)), f'{label}: JSON-LD는 객체 또는 배열이어야 합니다.')
                if isinstance(data, dict):
                    schemas.extend(data.get('@graph', [data]))
                elif isinstance(data, list):
                    schemas.extend(data)
            except (ValueError, TypeError):
                errors.append(f'{label}: JSON-LD 파싱 실패')
        postings = [s for s in schemas if isinstance(s, dict) and s.get('@type') == 'BlogPosting']
        if kind == 'article':
            require(len(postings) == 1, f'{label}: BlogPosting 누락/중복')
            for data in postings:
                try:
                    require(data['url'] == data['mainEntityOfPage']['@id'] == url, f'{label}: JSON-LD URL 불일치')
                    require(data['description'] == description, f'{label}: JSON-LD 설명 불일치')
                    require(data['headline'] in ''.join(page.text), f'{label}: JSON-LD 제목이 본문에 없음')
                    require(data['author']['name'] in ''.join(page.text), f'{label}: 작성자 표시 누락')
                    require(local_path(data['author']['url']) in pages, f'{label}: 작성자 페이지 없음')
                    published = date(data['datePublished'], f'{label} datePublished')
                    modified = date(data['dateModified'], f'{label} dateModified')
                    if published and modified:
                        require(modified >= published, f'{label}: 수정일이 게시일보다 이전')
                    require(data['datePublished'] in page.times, f'{label}: 표시 게시일 불일치')
                    if data['dateModified'] != data['datePublished']:
                        require(data['dateModified'] in page.times, f'{label}: 표시 수정일 누락')
                    require(one(page, 'article:published_time', label) == data['datePublished'], f'{label}: OG 게시일 불일치')
                    require(one(page, 'article:modified_time', label) == data['dateModified'], f'{label}: OG 수정일 불일치')
                    articles[url] = data
                except (KeyError, TypeError):
                    errors.append(f'{label}: BlogPosting 필드 형식 오류')
        for ref in page.refs + page.meta.get('og:image', []):
            target_url = urljoin(url, ref)
            target = local_path(target_url)
            if target is None:
                continue
            require(target.is_file(), f'{label}: 내부 참조 없음: {ref}')
            fragment = unquote(urlsplit(target_url).fragment)
            if fragment and target in pages:
                require(fragment in pages[target].ids, f'{label}: 앵커 없음: {ref}')
    require(len(canonicals) == len(set(canonicals)), '페이지 간 canonical 중복')

    try:
        ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
        sitemap = ET.parse(root / 'sitemap.xml')
        require(sitemap.getroot().tag == '{' + ns['s'] + '}urlset', 'sitemap.xml: URL 목록 형식이 아닙니다.')
        urls = []
        for entry in sitemap.findall('s:url', ns):
            url = entry.findtext('s:loc', '', ns)
            urls.append(url)
            require(url in canonicals, f'sitemap: 공개 canonical에 없는 URL {url}')
            lastmod = entry.findtext('s:lastmod', namespaces=ns)
            if lastmod:
                date(lastmod, f'sitemap {url}')
                if url in articles:
                    require(lastmod == articles[url]['dateModified'], f'sitemap: 수정일 불일치 {url}')
        require(len(urls) == len(set(urls)), 'sitemap: URL 중복')
    except (OSError, ET.ParseError) as exc:
        errors.append(f'sitemap 오류: {exc}')

    for name in ('index.xml', 'posts/index.xml'):
        try:
            feed = ET.parse(root / name)
            require(feed.getroot().tag == 'rss', f'{name}: RSS 형식이 아닙니다.')
            links = []
            for item in feed.findall('./channel/item'):
                url = item.findtext('link')
                links.append(url)
                require(url in articles, f'{name}: 공개 게시글이 아닌 항목 {url}')
                published = parsedate_to_datetime(item.findtext('pubDate', ''))
                require(published.year > 1 and published.tzinfo is not None, f'{name}: 게시일 오류')
                if url in articles:
                    require(item.findtext('title') == articles[url]['headline'], f'{name}: 제목 불일치 {url}')
            require(len(links) == len(set(links)), f'{name}: 항목 중복')
        except (OSError, ET.ParseError, ValueError, TypeError) as exc:
            errors.append(f'{name}: RSS 오류: {exc}')
    try:
        robots = RobotFileParser()
        robots.parse((root / 'robots.txt').read_text().splitlines())
        require(urljoin(base, 'sitemap.xml') in (robots.site_maps() or []), 'robots.txt: sitemap 주소 누락/오류')
        for bot in ('Googlebot', 'bingbot'):
            for url in canonicals:
                require(robots.can_fetch(bot, url), f'robots.txt: {bot}의 {url} 접근 차단')
    except OSError as exc:
        errors.append(f'robots.txt 오류: {exc}')
    return errors


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', nargs='?', default='public')
    problems = check(parser.parse_args().directory)
    if problems:
        print('\n'.join(f'ERROR: {p}' for p in problems), file=sys.stderr)
        sys.exit(1)
    print('SEO checks passed: metadata, JSON-LD, links, sitemap, RSS, robots.')
