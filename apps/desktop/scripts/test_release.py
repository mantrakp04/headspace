import base64
from pathlib import Path
import tempfile
import unittest
from release import bundle_info, config, validate_appcast


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.cfg = config()
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.archive = Path(self.tmp.name) / 'Headspace.dmg'
        self.archive.write_bytes(b'release bytes')
        self.feed = Path(self.tmp.name) / 'appcast.xml'
        self.signature = base64.b64encode(bytes(64)).decode()

    def write_feed(self, *, url=None, build=None, length=None, signature=None):
        url = url or f"https://github.com/{self.cfg['repository']}/releases/download/v{self.cfg['version']}/Headspace.dmg"
        build = self.cfg['build'] if build is None else build
        length = self.archive.stat().st_size if length is None else length
        signature = self.signature if signature is None else signature
        self.feed.write_text(f'''<rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle"><channel><item>
            <sparkle:version>{build}</sparkle:version>
            <enclosure url="{url}" length="{length}" sparkle:edSignature="{signature}" />
            </item></channel></rss>''')

    def test_versioned_archive_is_accepted_for_crypto_verification(self):
        self.write_feed()
        self.assertEqual(validate_appcast(self.feed, self.archive, self.cfg), self.signature)

    def test_mutable_or_foreign_download_url_is_rejected(self):
        for url in ['https://github.com/mantrakp04/headspace/releases/latest/download/Headspace.dmg',
                    'https://example.com/Headspace.dmg']:
            with self.subTest(url=url), self.assertRaises(ValueError):
                self.write_feed(url=url)
                validate_appcast(self.feed, self.archive, self.cfg)

    def test_changed_archive_and_wrong_build_are_rejected(self):
        for kwargs in [{'length': 1}, {'build': 0}, {'signature': ''}]:
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                self.write_feed(**kwargs)
                validate_appcast(self.feed, self.archive, self.cfg)

    def test_development_builds_cannot_start_automatic_updates(self):
        development = bundle_info(self.cfg, development=True)
        production = bundle_info(self.cfg)
        self.assertFalse(development['SUEnableAutomaticChecks'])
        self.assertFalse(development['SUAutomaticallyUpdate'])
        self.assertTrue(production['SUEnableAutomaticChecks'])
        self.assertTrue(production['SURequireSignedFeed'])
        self.assertTrue(production['SUVerifyUpdateBeforeExtraction'])
        self.assertEqual(production['CFBundleIdentifier'], 'local.headspace.player')

    def test_hmr_is_a_separate_bundle_with_updates_disabled(self):
        dev = bundle_info(self.cfg, development=True, hmr=True)
        self.assertEqual(dev['CFBundleIdentifier'], 'local.headspace.player.dev')
        self.assertEqual(dev['CFBundleDisplayName'], 'Headspace Dev')
        self.assertFalse(dev['SUEnableAutomaticChecks'])
        self.assertFalse(dev['SUAutomaticallyUpdate'])


if __name__ == '__main__':
    unittest.main()
