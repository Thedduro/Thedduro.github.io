"""Glossary data, publishing and reference regressions. Requires Python and Hugo."""
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from html.parser import HTMLParser

REPO = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.hrefs, self.ids, self.entries = [], [], []
        self.heading_links, self.in_heading = 0, False
        self.feed(path.read_text())

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'h3':
            self.in_heading = True
        if tag == 'a':
            self.hrefs.append(attrs.get('href', ''))
            self.heading_links += self.in_heading
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        if 'glossary-entry' in attrs.get('class', '').split():
            self.entries.append(attrs)

    def handle_endtag(self, tag):
        if tag == 'h3':
            self.in_heading = False


class GlossaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='hugo-glossary-test-')
        cls.addClassCleanup(cls.temp.cleanup)
        cls.root = Path(cls.temp.name)
        cls.source = cls.root / 'source'
        cls.source.mkdir()
        for name in ('layouts', 'assets', 'static', 'archetypes', 'content', 'data'):
            shutil.copytree(REPO / name, cls.source / name)
        shutil.copy2(REPO / 'hugo.toml', cls.source / 'hugo.toml')
        cls.write_post('glossary-public', title='Public linked article',
                       slug='different-public-url', description='Public article',
                       date='2020-01-01T00:00:00+09:00')
        cls.write_post('glossary-draft', title='Draft article', draft=True)
        cls.write_post('glossary-future', title='Future article',
                       description='Future', date='2999-01-01T00:00:00+09:00')
        cls.terms = [
            cls.term('fixture', title='검증 용어',
                     related_terms=['second', 'draft-fixture'],
                     related_posts=['/posts/glossary-public', '/posts/glossary-public',
                                    '/posts/glossary-draft', '/posts/glossary-future']),
            cls.term('second', title='다른 용어'),
            cls.term('draft-fixture', title='비공개 용어', draft=True,
                     related_posts=['/posts/glossary-public']),
        ]
        cls.save_data()
        cls.output = cls.root / 'public'
        cls.build(cls.output)

    @classmethod
    def write_post(cls, name, **fields):
        front = '\n'.join(f'{key}: {json.dumps(value, ensure_ascii=False)}'
                          for key, value in fields.items())
        (cls.source / f'content/posts/{name}.md').write_text('---\n' + front + '\n---\n')

    @staticmethod
    def term(name, **overrides):
        fields = dict(id=name, title='Example term', description='A brief definition.',
                      english='Example', abbreviations=['EX'], term_aliases=['예제'], tags=['데이터 엔지니어링', '스토리지'],
                      related_terms=[], related_posts=[], sources=[], draft=False)
        fields.update(overrides)
        return fields

    @classmethod
    def save_data(cls, entries=None):
        # JSON is valid YAML; no third-party YAML parser needed for fixtures.
        (cls.source / 'data/glossary.yaml').write_text(
            json.dumps(cls.terms if entries is None else entries, ensure_ascii=False))

    @classmethod
    def build(cls, output, *args, success=True):
        result = subprocess.run(['hugo', '--source', str(cls.source), '--destination', str(output),
                                 '--cacheDir', str(cls.root / 'cache'), '--minify', *args],
                                capture_output=True, text=True)
        if (result.returncode == 0) != success:
            raise AssertionError(result.stdout + result.stderr)
        return result.stdout + result.stderr

    def test_links_resolve_post_permalink_and_return_to_inline_term(self):
        page = Page(self.output / 'glossary/index.html')
        self.assertEqual(page.hrefs.count('/posts/different-public-url/'), 1)
        self.assertIn('/glossary/#term-second', page.hrefs)
        post = Page(self.output / 'posts/different-public-url/index.html')
        self.assertIn('/glossary/#term-fixture', post.hrefs)
        self.assertNotIn('/posts/glossary-public/', page.hrefs)

    def test_no_individual_term_pages_or_clickable_headings(self):
        self.assertEqual(list((self.output / 'glossary').rglob('*.html')),
                         [self.output / 'glossary/index.html'])
        self.assertEqual(Page(self.output / 'glossary/index.html').heading_links, 0)
        sitemap = (self.output / 'sitemap.xml').read_text()
        self.assertNotIn('/glossary/fixture/', sitemap)

    def test_multiple_tags_and_bilingual_names_reach_browser(self):
        entry = Page(self.output / 'glossary/index.html').entries[0]
        self.assertEqual(json.loads(entry['data-tags']), ['데이터 엔지니어링', '스토리지'])
        self.assertEqual(entry['data-title'], '검증 용어')
        self.assertEqual(entry['data-english'], 'Example')
        self.assertEqual(entry['data-abbreviations'], 'EX')
        self.assertNotIn('EX', entry['data-aliases'])
        self.assertIn('예제', entry['data-aliases'])

    def test_draft_terms_and_unpublished_post_links_stay_hidden_even_in_preview(self):
        preview = self.root / 'preview'
        self.build(preview, '--buildDrafts', '--buildFuture')
        for output in (self.output, preview):
            page = Page(output / 'glossary/index.html')
            self.assertEqual(len(page.entries), 2)
            self.assertNotIn('term-draft-fixture', page.ids)
            for ref in ('/posts/glossary-draft/', '/posts/glossary-future/',
                        '/glossary/#term-draft-fixture'):
                self.assertNotIn(ref, page.hrefs)
            post = Page(output / 'posts/different-public-url/index.html')
            self.assertNotIn('/glossary/#term-draft-fixture', post.hrefs)

    def test_missing_refs_duplicate_ids_and_invalid_metadata_fail_build(self):
        try:
            for fields, expected in [
                ({'related_posts': ['/posts/does-not-exist']}, '참조 파일이 없습니다'),
                ({'related_terms': ['does-not-exist']}, 'related_terms 참조가 없습니다'),
                ({'related_posts': ['/posts/different-public-url']}, '참조 파일이 없습니다'),
                ({'description': ''}, 'description 문자열이 필요합니다'),
                ({'tags': []}, 'tags를 하나 이상'),
                ({'tags': 'Spark'}, 'tags는 배열이어야 합니다'),
                ({'title': '검증 용어'}, '중복 용어명'),
                ({'id': 'fixture'}, '중복 용어 id'),
                ({'term_aliases': 'EX'}, 'term_aliases는 배열이어야 합니다'),
                ({'abbreviations': 'EX'}, 'abbreviations는 배열이어야 합니다'),
                ({'draft': 'false'}, 'draft는 true/false'),
            ]:
                with self.subTest(fields=fields):
                    self.save_data(self.terms + [self.term('invalid', **fields)])
                    output = self.build(self.root / 'invalid', success=False)
                    self.assertIn(expected, output)
        finally:
            self.save_data()

    def test_subpath_links_and_static_definitions(self):
        output = self.root / 'subpath'
        self.build(output, '--baseURL', 'https://example.com/blog/')
        links = Page(output / 'glossary/index.html').hrefs
        self.assertIn('/blog/posts/different-public-url/', links)
        self.assertIn('/blog/glossary/#term-second', links)
        self.assertIn('A brief definition.', (output / 'glossary/index.html').read_text())

    def test_empty_glossary_builds_without_broken_term_links(self):
        try:
            self.save_data([])
            output = self.root / 'empty'
            self.build(output)
            self.assertEqual(Page(output / 'glossary/index.html').entries, [])
            post = Page(output / 'posts/different-public-url/index.html')
            self.assertFalse(any('#term-' in ref for ref in post.hrefs))
        finally:
            self.save_data()


if __name__ == '__main__':
    unittest.main()
