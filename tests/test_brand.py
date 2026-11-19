import hashlib
import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOME = 'headhunter-kyusyokusha-v7.html'
PAGES = (HOME, 'terms.html', 'privacy.html')

class CareerBrand(unittest.TestCase):
    def test_public_brand_labels(self):
        for name in PAGES:
            with self.subTest(name=name):
                text = (ROOT / name).read_text()
                self.assertNotRegex(text, r'HEAD\s*HUNTER')
                self.assertIn('SCOUTIA', text)

    def test_three_home_logos_use_official_local_assets(self):
        text = (ROOT / HOME).read_text()
        sources = re.findall(r'<img class="career-brand-logo" src="(/[^\"]+)" alt="SCOUTIA"', text)
        self.assertEqual(sources, ['/assets/scoutia-blue.svg', '/assets/scoutia-blue.svg', '/assets/scoutia-white.svg'])
        # Original SVG bytes from the approved SCOUTIA-logo-kit.zip.
        hashes = {
            '/assets/scoutia-blue.svg': '6e00d189b636dfebcccdd203b98950672fd8f835e32173dd59ab1c3b12cab9e7',
            '/assets/scoutia-white.svg': '600cd97cfe6a38a775f0941bb006108adc27d290e64f6e6e12ceea36b5123877',
        }
        for src, expected in hashes.items():
            self.assertEqual(hashlib.sha256((ROOT / src.lstrip('/')).read_bytes()).hexdigest(), expected)

    def test_legal_terms_and_hrefs_change_only_by_brand(self):
        for name in PAGES[1:]:
            original = subprocess.check_output(['git', 'show', '3dc50dc:' + name], cwd=ROOT, text=True)
            self.assertEqual((ROOT / name).read_text(), original.replace('HEAD HUNTER', 'SCOUTIA').replace('https://career.head-hunter.jp/', 'https://career.scoutia.jp/'))

    def test_home_navigation_and_behaviour_are_preserved(self):
        original = subprocess.check_output(['git', 'show', '3dc50dc:' + HOME], cwd=ROOT, text=True)
        now = (ROOT / HOME).read_text()
        self.assertEqual(re.findall(r'<script\b.*?</script>', original, re.S), re.findall(r'<script\b.*?</script>', now, re.S))
        self.assertEqual(re.findall(r'<a\b[^>]*href="([^"]+)"', original), re.findall(r'<a\b[^>]*href="([^"]+)"', now))
