"""Verifier guards only; these tests are not evidence of native execution."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location(
    'native_proof', Path(__file__).resolve().parents[1] / 'scripts/native-desktop-proof.py')
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)


class NativeVerificationGuards(unittest.TestCase):
    def test_only_loopback_http_endpoints(self):
        for url in ['http://127.0.0.1:9222', 'http://localhost:9222/', 'http://[::1]:9222']:
            self.assertEqual(native.local_endpoint(url), url)
        for url in ['', 'https://localhost:9222', 'http://example.com:9222',
                    'http://localhost.evil.test:9222', 'http://user@localhost:9222',
                    'http://localhost:9222/private', 'http://localhost:9222/?secret=x',
                    'http://localhost', 'http://localhost:9222/#fragment']:
            with self.assertRaises(ValueError, msg=url):
                native.local_endpoint(url)

    def test_host_import_rewrite_matches_but_code_changes_do_not(self):
        original = 'import {host} from "@hermes/plugin-sdk";\nconst limit=32;\n'
        loaded = 'import {host} from "blob:http://localhost/native-sdk";\r\nconst limit=32;\r\n'
        self.assertEqual(native.canonical_source(original), native.canonical_source(loaded))
        self.assertNotEqual(native.canonical_source(original), native.canonical_source(loaded.replace('32', '4')))

    def test_embedded_import_like_text_remains_part_of_identity(self):
        source = 'const text = `import {host} from "@hermes/plugin-sdk";`;\n'
        self.assertEqual(native.canonical_source(source), source)
        self.assertNotEqual(native.canonical_source(source), native.canonical_source(source.replace('@hermes/plugin-sdk', 'fixture')))
