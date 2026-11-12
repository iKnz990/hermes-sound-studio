"""Verifier guards only; these tests are not evidence of native execution."""
import importlib.util
from pathlib import Path
import unittest
import json
import copy

spec = importlib.util.spec_from_file_location(
    'native_proof', Path(__file__).resolve().parents[1] / 'scripts/native-desktop-proof.py')
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)


class NativeVerificationGuards(unittest.TestCase):
    def test_null_and_incomplete_exports_are_not_assignment_proof(self):
        for value in [None, {}, {'schemaVersion': 'SoundTheme/v1', 'events': {}}]:
            with self.assertRaises(ValueError):
                native.active_theme(json.dumps(value))

    def test_live_export_validates_every_patch(self):
        theme = json.loads((native.ROOT / 'examples/signal-garden.theme.json').read_text(encoding='utf-8'))
        self.assertEqual(native.active_theme(json.dumps(theme)), theme)
        for event in native.EVENTS:
            broken = copy.deepcopy(theme)
            broken['events'][event]['intensity'] = -1
            with self.assertRaises((ValueError, TypeError)):
                native.active_theme(json.dumps(broken))

    def test_live_snapshot_comparison_detects_each_assignment_change(self):
        theme = json.loads((native.ROOT / 'examples/signal-garden.theme.json').read_text(encoding='utf-8'))
        before = native.active_theme(json.dumps(theme))
        for event in native.EVENTS:
            changed = copy.deepcopy(theme)
            changed['events'][event]['name'] += ' changed'
            self.assertNotEqual(before, native.active_theme(json.dumps(changed)))

    def test_only_loopback_http_endpoints(self):
        for url in ['http://127.0.0.1:9222', 'http://localhost:9222/', 'http://[::1]:9222']:
            self.assertEqual(native.local_endpoint(url), url)
        for url in ['', 'https://localhost:9222', 'http://example.com:9222',
                    'http://localhost.evil.test:9222', 'http://user@localhost:9222',
                    'http://localhost:9222/private', 'http://localhost:9222/?secret=x',
                    'http://localhost', 'http://localhost:9222/#fragment']:
            with self.assertRaises(ValueError, msg=url):
                native.local_endpoint(url)

    def test_verified_shims_require_exact_known_host_source(self):
        expected={'react':'const m = globalThis.__HERMES_REACT__;\nexport default m.default ?? m;\n'}
        scripts=[{'url':'blob:known','source':expected['react']},
                 {'url':'blob:modified','source':expected['react']+'sideEffect();'},
                 {'url':'https://example.invalid/known','source':expected['react']}]
        self.assertEqual(native.verified_shims(scripts,expected),{'blob:known':'react'})

    def test_node_bridge_preserves_dependency_identity(self):
        expected='import React from "react";\nconst limit=32;'
        modules=[{'url':'good','source':'import React from "blob:react";\nconst limit=32;'},
                 {'url':'swapped','source':'import React from "blob:jsx";\nconst limit=32;'},
                 {'url':'unknown','source':'import React from "blob:unknown";\nconst limit=32;'}]
        self.assertEqual(native.verify_sources(expected,modules,{'blob:react':'react','blob:jsx':'react/jsx-runtime'}),{'good':True,'swapped':False,'unknown':False})
