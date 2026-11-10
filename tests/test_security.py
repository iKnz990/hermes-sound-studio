"""Regression coverage for catalog review: write approval and child isolation."""
import importlib
import json
import os
from pathlib import Path
import shutil
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from test_backend import plugin, injection, ROOT

safety = importlib.import_module('sonic_plugin.safety')


class Context:
    def __init__(self):
        self.tools = {}
        self.hooks = {}

    def register_tool(self, **kwargs): self.tools[kwargs['name']] = kwargs['handler']
    def register_hook(self, name, callback): self.hooks[name] = callback
    def register_auxiliary_task(self, *args, **kwargs): pass
    def register_skill(self, *args, **kwargs): pass
    def get_config(self, key, default=None): return default


class WriteApprovalTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.ctx = Context()
        plugin.register(self.ctx)
        self.hook = self.ctx.hooks['pre_tool_call']

    def test_read_only_calls_do_not_request_approval(self):
        for tool, args in [('synthesize_ui_soundscape', {'preset': 'nocturnal_dark'}),
                           ('inject_sonic_hooks', {'project_root': str(self.root)}),
                           ('inject_sonic_hooks', {'apply': False}),
                           ('audit_ui_silence', {}), ('other_tool', {'output_path': str(self.root)})]:
            with self.subTest(tool=tool, args=args):
                self.assertIsNone(self.hook(tool, args))
        self.assertTrue(json.loads(self.ctx.tools['synthesize_ui_soundscape']({}))['ok'])
        self.assertEqual(list(self.root.iterdir()), [])

    def test_both_write_operations_require_destination_specific_approval(self):
        for tool, args in [('synthesize_ui_soundscape', {'output_path': str(self.root / 'sound.ts')}),
                           ('inject_sonic_hooks', {'apply': True, 'project_root': str(self.root)})]:
            with self.subTest(tool=tool):
                result = self.hook(tool, args)
                self.assertEqual(result['action'], 'approve')
                self.assertIn(str(self.root), result['message'])
                changed = dict(args)
                changed['output_path' if 'output_path' in args else 'project_root'] = str(self.root / 'other')
                self.assertNotEqual(result['rule_key'], self.hook(tool, changed)['rule_key'])
        self.assertEqual(list(self.root.iterdir()), [])

    def test_invalid_paths_block_and_non_boolean_apply_cannot_write(self):
        for value in [None, '', 'relative.ts', '//server/share/file.ts', str(self.root / 'bad\nname')]:
            self.assertEqual(self.hook('synthesize_ui_soundscape', {'output_path': value})['action'], 'block')
        result = json.loads(self.ctx.tools['inject_sonic_hooks']({'project_root': str(self.root), 'apply': 'true'}))
        self.assertFalse(result['ok'])
        self.assertEqual(list(self.root.iterdir()), [])

    def test_handlers_refuse_hermes_trees_even_without_hook_dispatch(self):
        for variable in ['HERMES_HOME', 'HERMES_INSTALL_ROOT']:
            with self.subTest(variable=variable), patch.dict(os.environ, {variable: str(self.root)}):
                result = json.loads(self.ctx.tools['synthesize_ui_soundscape']({'output_path': str(self.root / 'sound.ts')}))
                self.assertFalse(result['ok'])
                self.assertEqual(self.hook('inject_sonic_hooks', {'project_root': str(self.root), 'apply': True})['action'], 'block')
                with self.assertRaisesRegex(ValueError, 'Hermes home or install'):
                    injection.plan_injection(self.root)
                with self.assertRaisesRegex(ValueError, 'Hermes home or install'):
                    injection.apply_injection(self.root, {})
        self.assertEqual(list(self.root.iterdir()), [])

    def test_host_denylist_is_consulted_by_hook_and_writer(self):
        guard = SimpleNamespace(get_write_denied_error=lambda path: 'Write denied by Hermes')
        with patch.object(safety, '_optional_host_module', side_effect=lambda name: guard if name == 'agent.file_safety' else None):
            target = str(self.root / 'sound.ts')
            self.assertEqual(self.hook('synthesize_ui_soundscape', {'output_path': target})['action'], 'block')
            with self.assertRaisesRegex(ValueError, 'Write denied'):
                plugin._write_new(target, 'test')
        self.assertFalse(Path(target).exists())

    def test_missing_host_policy_function_blocks_instead_of_bypassing(self):
        with patch.object(safety, '_optional_host_module', return_value=SimpleNamespace()):
            self.assertEqual(self.hook('synthesize_ui_soundscape', {'output_path': str(self.root / 'out.ts')})['action'], 'block')

    def test_running_host_without_denylist_blocks_instead_of_using_standalone_mode(self):
        with patch.object(safety, '_optional_host_module', side_effect=lambda name: None if name == 'agent.file_safety' else SimpleNamespace()):
            self.assertEqual(self.hook('synthesize_ui_soundscape', {'output_path': str(self.root / 'out.ts')})['action'], 'block')

    def test_active_profile_global_home_and_executing_install_are_protected(self):
        home, profile, install = (self.root / name for name in ['home', 'profile', 'install'])
        host = SimpleNamespace(get_hermes_home=lambda: profile, get_default_hermes_root=lambda: home,
                               __file__=str(install / 'hermes_constants.py'))
        with patch.object(safety, '_optional_host_module', side_effect=lambda name: host if name == 'hermes_constants' else SimpleNamespace(get_write_denied_error=lambda path: None)):
            for root in [home, profile, install, ROOT]:
                with self.subTest(root=root), self.assertRaises(ValueError):
                    safety.external_write_path(root / 'nested' / 'out.ts')

    def test_dot_segments_and_symlink_alias_cannot_escape_protection(self):
        protected = self.root / 'hermes'
        protected.mkdir()
        with patch.dict(os.environ, {'HERMES_HOME': str(protected)}):
            with self.assertRaises(ValueError):
                safety.external_write_path(self.root / 'other' / '..' / 'hermes' / 'out.ts')
            alias = self.root / 'alias'
            alias.symlink_to(protected, target_is_directory=True)
            with self.assertRaises(ValueError):
                safety.external_write_path(alias / 'out.ts')
            sibling = self.root / 'hermes-project' / 'out.ts'
            self.assertEqual(safety.external_write_path(sibling), sibling)

    def test_broken_host_dependency_is_not_treated_as_standalone(self):
        error = ModuleNotFoundError("No module named 'host_dependency'", name='host_dependency')
        with patch.object(safety.importlib, 'import_module', side_effect=error):
            self.assertEqual(self.hook('synthesize_ui_soundscape', {'output_path': str(self.root / 'out.ts')})['action'], 'block')


class NodeEnvironmentTests(unittest.TestCase):
    def test_environment_is_an_explicit_allowlist(self):
        supplied = {'PATH': os.defpath, 'HOME': str(Path.home()), 'LANG': 'en_US.UTF-8',
                    'SYSTEMROOT': 'C:\\Windows', 'NODE_OPTIONS': '--require secret.js',
                    'NODE_PATH': '/secret', 'MODEL_API_KEY': 'never-inherit'}
        with patch.dict(os.environ, supplied, clear=True):
            env = injection._minimal_node_env()
        self.assertEqual(set(env), {'PATH', 'HOME', 'LANG'} | ({'SYSTEMROOT'} if os.name == 'nt' else set()))
        for key in env:
            self.assertEqual(env[key], supplied[key])

    @unittest.skipUnless(shutil.which('node'), 'Node required for child-process isolation')
    def test_real_node_does_not_execute_parent_preload_and_injection_still_works(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'src').mkdir()
            source = root / 'src' / 'App.tsx'
            source.write_text('const App = () => <button onClick={cb}>Go</button>;', encoding='utf-8')
            (root / 'src' / 'sonic-ui.ts').write_text('export const sonic = {};', encoding='utf-8')
            marker = root / 'leaked-env.txt'
            preload = root / 'preload.cjs'
            preload.write_text(f'require("fs").writeFileSync({json.dumps(str(marker))}, "leaked");', encoding='utf-8')
            with patch.dict(os.environ, {'NODE_OPTIONS': f'--require "{preload}"', 'MODEL_API_KEY': 'never-inherit'}):
                plan = injection.plan_injection(root)
                self.assertEqual(len(plan['files']), 1)
                self.assertTrue(injection.apply_injection(root, plan)['ok'])
            self.assertFalse(marker.exists())
            self.assertIn("hermesSonic.wrap(cb, 'onCommit')", source.read_text(encoding='utf-8'))
            self.assertEqual(len(list((root / '.sonic-ui-backups').glob('*.bak'))), 1)
