"""The manifest's four tools remain discoverable without optional inference."""
import importlib.util
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('sound_studio_release_test', ROOT / '__init__.py', submodule_search_locations=[str(ROOT)])
PLUGIN = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = PLUGIN
SPEC.loader.exec_module(PLUGIN)

class RegistrationTests(unittest.TestCase):
    def test_all_declared_tools_register_in_unavailable_scope(self):
        class Context:
            profile_name = 'other-profile'
            def __init__(self): self.tools = {}
            def register_tool(self, **kwargs): self.tools[kwargs['name']] = kwargs
            def register_hook(self, *args): pass
            def register_auxiliary_task(self, *args, **kwargs): pass
            def register_skill(self, *args, **kwargs): pass
        ctx = Context()
        PLUGIN.register(ctx)
        self.assertEqual(set(ctx.tools), {'synthesize_ui_soundscape', 'audit_ui_silence', 'inject_sonic_hooks', 'sonic_create_patch'})
        result = json.loads(ctx.tools['sonic_create_patch']['handler']({'description': 'A soft chime'}))
        self.assertFalse(result['ok'])
        self.assertIn('profile', result['error'])

if __name__ == '__main__':
    unittest.main()
