"""Verify series navigation and published-only recommendations in rendered Hugo pages."""
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from html.parser import HTMLParser

REPO = Path(__file__).resolve().parents[1]


class Connections(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.section = None
        self.links = {'series': [], 'related': []}
        self.steps = {}
        self.current = 0
        self.feed(path.read_text())

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = attrs.get('class', '').split()
        if tag == 'section' and 'post-connections' in classes:
            self.section = 'series' if 'post-series' in classes else 'related'
        if self.section and tag == 'a':
            if attrs['href'].startswith('/posts/'):
                self.links[self.section].append(attrs['href'])
            for direction in ('previous', 'next'):
                if f'series-{direction}' in classes:
                    self.steps[direction] = attrs['href']
        if self.section and attrs.get('aria-current') == 'page':
            self.current += 1

    def handle_endtag(self, tag):
        if tag == 'section':
            self.section = None


class PostConnectionsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='hugo-connections-test-')
        cls.addClassCleanup(cls.temp.cleanup)
        cls.root = Path(cls.temp.name)
        cls.source = cls.root / 'source'
        cls.source.mkdir()
        for name in ('layouts', 'assets', 'static', 'archetypes', 'content', 'data'):
            shutil.copytree(REPO / name, cls.source / name)
        shutil.copy2(REPO / 'hugo.toml', cls.source / 'hugo.toml')
        # File names, slugs and dates deliberately disagree with series order.
        for name, slug, order, date, extra in (
            ('z-first', 'fixture-first', 1, '2020-03-01', {}),
            ('a-middle', 'fixture-middle', 2, '2020-01-01', {}),
            ('m-last', 'fixture-last', 3, '2020-02-01', {}),
            ('hidden-draft', 'fixture-draft', 4, '2020-04-01', {'draft': True}),
            ('hidden-future', 'fixture-future', 5, '2999-01-01', {}),
        ):
            cls.write_post(name, slug=slug, series='Fixture series',
                           seriesOrder=order, date=date + 'T00:00:00+09:00', **extra)
        for index in range(4):
            cls.write_post(f'candidate-{index}', slug=f'fixture-related-{index}')
        cls.write_post('unrelated', slug='fixture-unrelated', tags=['Unique topic'])
        cls.outputs = []
        for name, flags in (('production', []), ('preview', ['--buildDrafts', '--buildFuture'])):
            output = cls.root / name
            subprocess.run(['hugo', '--source', str(cls.source), '--destination', str(output), *flags],
                           check=True, capture_output=True, text=True)
            cls.outputs.append(output)

    @classmethod
    def write_post(cls, name, **params):
        front = dict(title=name, description='Fixture article', draft=False,
                     date='2020-01-01T00:00:00+09:00', tags=['Fixture topic'])
        front.update(params)
        (cls.source / 'content/posts' / f'{name}.md').write_text(
            json.dumps(front) + '\n\nFixture body.\n')

    def page(self, output, slug):
        return Connections(output / 'posts' / slug / 'index.html')

    def test_series_order_and_boundaries(self):
        for output in self.outputs:
            first = self.page(output, 'fixture-first')
            middle = self.page(output, 'fixture-middle')
            last = self.page(output, 'fixture-last')
            self.assertEqual(first.steps, {'next': '/posts/fixture-middle/'})
            self.assertEqual(middle.steps, {'previous': '/posts/fixture-first/', 'next': '/posts/fixture-last/'})
            self.assertEqual(last.steps, {'previous': '/posts/fixture-middle/'})
            self.assertEqual(middle.current, 1)

    def test_related_limit_and_no_duplicate_series(self):
        for output in self.outputs:
            page = self.page(output, 'fixture-middle')
            self.assertEqual(len(page.links['related']), 3)
            self.assertTrue(all(link.startswith('/posts/fixture-related-') for link in page.links['related']))

    def test_no_connections_for_unrelated_standalone(self):
        for output in self.outputs:
            page = self.page(output, 'fixture-unrelated')
            self.assertEqual(page.links, {'series': [], 'related': []})

    def test_hidden_posts_not_linked_even_in_preview(self):
        for output in self.outputs:
            page = self.page(output, 'fixture-middle')
            links = page.links['series'] + page.links['related']
            self.assertNotIn('/posts/fixture-draft/', links)
            self.assertNotIn('/posts/fixture-future/', links)


if __name__ == '__main__':
    unittest.main()
