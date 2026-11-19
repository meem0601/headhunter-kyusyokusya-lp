import re
import unittest
import xml.etree.ElementTree as ET
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

    def test_only_top_advertised_in_sitemap(self):
        root = ET.parse(ROOT / 'sitemap.xml').getroot()
        self.assertEqual([n.text for n in root.findall('.//{*}loc')], [BASE + '/'])
        self.assertIn('Sitemap: ' + BASE + '/sitemap.xml', (ROOT / 'robots.txt').read_text())
