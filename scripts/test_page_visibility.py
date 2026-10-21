"""Check independent home/about visibility and restoration in production builds."""
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest
from html.parser import HTMLParser

REPO = Path(__file__).resolve().parents[1]


class Navigation(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.in_nav = False
        self.links = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'nav' and attrs.get('class') == 'site-nav':
            self.in_nav = True
        if tag == 'a' and self.in_nav:
            self.links.append(attrs)

    def handle_endtag(self, tag):
        if tag == 'nav':
            self.in_nav = False


class PageVisibilityTests(unittest.TestCase):
    def test_visibility_combinations_and_restore(self):
        with tempfile.TemporaryDirectory(prefix='hugo-visibility-') as temporary:
            root = Path(temporary)
            source = root / 'source'
            source.mkdir()
            for name in ('layouts', 'assets', 'static', 'content', 'data'):
                shutil.copytree(REPO / name, source / name)
            config = (REPO / 'hugo.toml').read_text()
            about = (REPO / 'content/about.md').read_text()
            for home_draft, about_draft in ((True, True), (False, True), (True, False), (False, False)):
                with self.subTest(home_draft=home_draft, about_draft=about_draft):
                    (source / 'hugo.toml').write_text(re.sub(r'homeDraft = (?:true|false)', f'homeDraft = {str(home_draft).lower()}', config))
                    (source / 'content/about.md').write_text(re.sub(r'(?m)^draft: (?:true|false)$', f'draft: {str(about_draft).lower()}', about, count=1))
                    output = root / f'output-{home_draft}-{about_draft}'
                    build = subprocess.run(['hugo', '--source', str(source), '--destination', str(output), '--minify'], capture_output=True, text=True)
                    self.assertEqual(build.returncode, 0, build.stdout + build.stderr)
                    html = (output / 'index.html').read_text()
                    links = Navigation(html).links
                    self.assertEqual('id=hero-title' in html, not home_draft)
                    self.assertEqual((output / 'about/index.html').exists(), not about_draft)
                    self.assertEqual(any(a['href'] == '/about/' for a in links), not about_draft)
                    self.assertEqual('경험 더 보기' in html, not home_draft and not about_draft)
                    if home_draft:
                        self.assertIn('<h1>글</h1>', html)
                        self.assertEqual(links[0]['href'], '/')
                        self.assertEqual(links[0]['aria-current'], 'page')
                        self.assertFalse(any(a['href'] == '/posts/' for a in links))
                    else:
                        self.assertEqual(links[0]['href'], '/')
                        self.assertEqual(links[1]['href'], '/posts/')
                    self.assertTrue((output / 'posts/index.html').exists())
                    check = subprocess.run(['python3', str(REPO / 'scripts/check-seo.py'), str(output)], capture_output=True, text=True)
                    self.assertEqual(check.returncode, 0, check.stdout + check.stderr)

                    preview = root / f'preview-{home_draft}-{about_draft}'
                    build = subprocess.run(['hugo', '--source', str(source), '--destination', str(preview), '--buildDrafts', '--minify'], capture_output=True, text=True)
                    self.assertEqual(build.returncode, 0, build.stdout + build.stderr)
                    preview_html = (preview / 'index.html').read_text()
                    preview_links = Navigation(preview_html).links
                    self.assertEqual(any(a['href'] == '/about/' for a in preview_links), not about_draft)
                    self.assertEqual('경험 더 보기' in preview_html, not home_draft and not about_draft)
                    for post in (preview / 'posts').glob('*/index.html'):
                        self.assertEqual('href=/about/' in post.read_text(), not about_draft, str(post))
