import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://career.scoutia.jp'

class SearchMetadata(unittest.TestCase):
    def test_exact_canonical(self):
        for name, path in [('headhunter-kyusyokusha-v7.html', '/'), ('privacy.html', '/privacy'), ('terms.html', '/terms')]:
            with self.subTest(name=name):
                raw = (ROOT / name).read_text()
                self.assertEqual(re.findall(r'<link rel="canonical" href="([^"]+)"', raw), [BASE + path])
                self.assertEqual(re.findall(r'<meta property="og:url" content="([^"]+)"', raw), [BASE + path])

    def test_google_excludes_only_the_landing_page(self):
        for name, expected in [('headhunter-kyusyokusha-v7.html', ['noindex']), ('privacy.html', []), ('terms.html', [])]:
            with self.subTest(name=name):
                raw = (ROOT / name).read_text()
                self.assertEqual(re.findall(r'<meta name="googlebot" content="([^"]+)"', raw), expected)

    def test_robots_allows_google_to_read_noindex(self):
        self.assertEqual((ROOT / 'robots.txt').read_text().splitlines(), ['User-agent: *', 'Disallow:'])

    def test_no_sitemap_advertising_the_excluded_page(self):
        self.assertFalse((ROOT / 'sitemap.xml').exists())
