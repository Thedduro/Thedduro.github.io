"""Regression checks for generated SEO output. Requires Hugo, no Python packages.

Run: python3 -m unittest discover -s scripts -p 'test_*.py'
"""
import importlib.util
from html.parser import HTMLParser
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET

REPO = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('seo', REPO / 'scripts/check-seo.py')
seo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seo)


class ExecutableScripts(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.active, self.text = False, []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            self.active = dict(attrs).get('type') != 'application/ld+json'

    def handle_data(self, text):
        if self.active:
            self.text.append(text)

    def handle_endtag(self, tag):
        if tag == 'script':
            self.active = False


class SearchSEOTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='hugo-seo-test-')
        cls.addClassCleanup(cls.temp.cleanup)
        cls.root = Path(cls.temp.name)
        cls.source = cls.root / 'source'
        cls.source.mkdir()
        for name in ('layouts', 'assets', 'static', 'archetypes', 'content'):
            shutil.copytree(REPO / name, cls.source / name)
        shutil.copy2(REPO / 'hugo.toml', cls.source / 'hugo.toml')
        cls.title = 'A & B "quotes" </script><script>alert(1)</script>'
        cls.write_post('seo-fixture', title=cls.title, lastmod='2021-01-01T12:00:00+09:00',
                       images=['/profile.jpeg'], imageAlt='Example image')
        cls.write_post('seo-draft', draft=True, description='')
        cls.write_post('seo-future', date='2999-01-01T00:00:00+09:00')
        cls.output = cls.root / 'public'
        cls.build(cls.output)

    @classmethod
    def write_post(cls, slug, **overrides):
        fields = dict(title='SEO fixture', date='2020-01-01T12:00:00+09:00', draft=False,
                      description='Example & "quoted" description.', slug=slug)
        fields.update(overrides)
        # JSON scalar values are valid YAML and escape the test strings safely.
        frontmatter = '\n'.join(f'{k}: {json.dumps(v, ensure_ascii=False)}' for k, v in fields.items())
        (cls.source / f'content/posts/{slug}.md').write_text(
            '---\n' + frontmatter + '\n---\n\nA reproducible example.\n\n## Example\n\n```python\nprint(1)\n```\n')

    @classmethod
    def build(cls, output, *args, success=True):
        result = subprocess.run(['hugo', '--source', str(cls.source), '--destination', str(output),
                                 '--cacheDir', str(cls.root / 'cache'), '--minify', *args],
                                capture_output=True, text=True)
        if (result.returncode == 0) != success:
            raise AssertionError(result.stdout + result.stderr)
        return result

    def output_copy(self, name):
        destination = self.root / name
        shutil.copytree(self.output, destination)
        return destination

    def test_production_output_and_existing_counter_integration(self):
        self.assertEqual(seo.check(self.output), [])
        self.assertFalse((self.output / 'posts/seo-draft/index.html').exists())
        self.assertFalse((self.output / 'posts/seo-future/index.html').exists())
        page = self.output / 'posts/seo-fixture/index.html'
        parsed = seo.Page(page)
        self.assertEqual(parsed.meta['og:locale'], ['ko_KR'])
        self.assertIn('data-view-counter', page.read_text())
        self.assertIn('data-mode=visit', page.read_text())
        self.assertIn('data-mode=read', (self.output / 'index.html').read_text())

    def test_escaped_json_and_rss_match_visible_content(self):
        page = seo.Page(self.output / 'posts/seo-fixture/index.html')
        article = json.loads(page.jsonld[0])
        self.assertEqual(article['headline'], self.title)
        self.assertEqual(article['description'], 'Example & "quoted" description.')
        self.assertEqual(article['image'], ['https://thedduro.github.io/profile.jpeg'])
        self.assertEqual(page.meta['twitter:card'], ['summary_large_image'])
        self.assertIn(article['dateModified'], page.times)
        items = ET.parse(self.output / 'index.xml').findall('./channel/item')
        fixture = next(i for i in items if i.findtext('link').endswith('/seo-fixture/'))
        self.assertEqual(fixture.findtext('title'), self.title)
        scripts = ExecutableScripts((self.output / 'posts/seo-fixture/index.html').read_text())
        self.assertNotIn('alert(1)', ''.join(scripts.text))

    def test_preview_is_noindex_and_has_no_article_schema(self):
        dest = self.root / 'preview'
        self.build(dest, '--buildDrafts')
        page = seo.Page(dest / 'posts/seo-draft/index.html')
        self.assertEqual(page.meta['robots'], ['noindex'])
        self.assertEqual(page.jsonld, [])

    def test_missing_description_and_invalid_modification_date(self):
        path = self.source / 'content/posts/seo-invalid.md'
        try:
            self.write_post('seo-invalid', description='')
            result = self.build(self.root / 'invalid-description', success=False)
            self.assertIn('description이 필요합니다', result.stdout + result.stderr)
            self.write_post('seo-invalid', lastmod='2019-01-01T00:00:00+09:00')
            dest = self.root / 'invalid-date'
            self.build(dest)
            self.assertTrue(any('수정일이 게시일보다 이전' in e for e in seo.check(dest)))
        finally:
            path.unlink(missing_ok=True)

    def test_intentional_sitemap_omission_and_feed_limit(self):
        path = self.source / 'content/posts/seo-fixture.md'
        config = self.source / 'hugo.toml'
        original, original_config = path.read_text(), config.read_text()
        try:
            path.write_text(original.replace('\n---\n\n', '\nsitemap:\n  disable: true\n---\n\n', 1))
            config.write_text(original_config + '\n[services.rss]\n  limit = 1\n')
            dest = self.root / 'limited'
            self.build(dest)
            self.assertEqual(len(ET.parse(dest / 'index.xml').findall('./channel/item')), 1)
            self.assertNotIn('/posts/seo-fixture/', (dest / 'sitemap.xml').read_text())
            self.assertEqual(seo.check(dest), [])
        finally:
            path.write_text(original)
            config.write_text(original_config)

    def test_checker_rejects_broken_links_and_noindex(self):
        dest = self.output_copy('broken')
        p = dest / 'posts/seo-fixture/index.html'
        p.write_text(p.read_text().replace('</article>', '<a href="/missing-seo-page/">Missing</a></article>')
                     .replace('</head>', '<meta name="robots" content="noindex"></head>'))
        problems = seo.check(dest)
        self.assertTrue(any('내부 참조 없음' in p for p in problems))
        self.assertTrue(any('색인/링크 차단' in p for p in problems))

    def test_new_post_archetype(self):
        path = self.source / 'content/posts/seo-new.md'
        try:
            subprocess.run(['hugo', 'new', 'content', 'posts/seo-new.md', '--source', str(self.source)],
                           check=True, capture_output=True)
            text = path.read_text()
            self.assertIn('slug: "seo-new"', text)
            self.assertIn('draft: true', text)
        finally:
            path.unlink(missing_ok=True)


if __name__ == '__main__':
    unittest.main()
