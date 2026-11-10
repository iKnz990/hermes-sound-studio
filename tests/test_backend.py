"""Backend contract tests; run: python -m unittest discover -s tests -p test_backend.py -v."""
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("sonic_plugin", ROOT / "__init__.py", submodule_search_locations=[str(ROOT)])
plugin = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = plugin
spec.loader.exec_module(plugin)
schema = importlib.import_module("sonic_plugin.synth_schema")
compiler = importlib.import_module("sonic_plugin.compiler")
injection = importlib.import_module("sonic_plugin.injector")
PRESETS = json.loads((ROOT / "assets/presets.json").read_text(encoding="utf-8"))


class SchemaTests(unittest.TestCase):
    def test_all_presets_are_valid_and_have_six_events(self):
        for patch in PRESETS.values():
            self.assertEqual(len(schema.validate_patch(patch)["events"]), 6)

    def test_invalid_numbers_extras_and_color_fail_closed(self):
        for field, value in (("gain", float("nan")), ("freq_ratio", 1e308), ("attack_ms", -1), ("chord_intervals", [0] * 100)):
            patch = json.loads(json.dumps(PRESETS["nocturnal_dark"]))
            patch["events"]["onHover"][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                schema.validate_patch(patch)
        patch = json.loads(json.dumps(PRESETS["nocturnal_dark"]))
        patch["events"]["onHover"]["unexpected"] = 1
        with self.assertRaises(ValueError): schema.validate_patch(patch)
        patch["css_accent_hex"] = '#abc;alert(1)'
        with self.assertRaises(ValueError): schema.validate_patch(patch)

    def test_hover_gain_and_sound_frequencies_are_bounded(self):
        patch = json.loads(json.dumps(PRESETS["nocturnal_dark"]))
        patch["events"]["onHover"]["gain"] = 0.041
        with self.assertRaises(ValueError): schema.validate_patch(patch)
        patch["events"]["onHover"]["gain"] = .03
        patch["events"]["onHover"]["freq_ratio"] = 0
        with self.assertRaises(ValueError): schema.validate_patch(patch)

    def test_huge_json_integer_is_structured_validation_error(self):
        patch = json.loads(json.dumps(PRESETS['nocturnal_dark']))
        for field in ('fundamental_hz', 'gain', 'freq_ratio'):
            case = json.loads(json.dumps(patch))
            if field == 'fundamental_hz': case[field] = 10 ** 400
            else: case['events']['onHover'][field] = 10 ** 400
            with self.subTest(field=field), self.assertRaises(ValueError):
                schema.validate_patch(case)

    def test_schema_advertises_hover_gain_limit_separately(self):
        hover = schema.PATCH_SCHEMA['properties']['events']['properties']['onHover']
        commit = schema.PATCH_SCHEMA['properties']['events']['properties']['onCommit']
        self.assertEqual(hover['properties']['gain']['maximum'], .04)
        self.assertEqual(commit['properties']['gain']['maximum'], .2)
        self.assertIsNot(hover, commit)

    def test_compiler_embeds_canonical_asset_and_only_valid_patch(self):
        text = compiler.compile_ts_hook(PRESETS["nocturnal_dark"])
        engine = (ROOT / "assets/audio-engine.ts").read_text(encoding="utf-8")
        self.assertTrue(text.startswith(engine))
        self.assertIn('export const useSonicUI = () => sonic;', text)
        with self.assertRaises(ValueError): compiler.compile_ts_hook({})

    @unittest.skipUnless(shutil.which('node'), 'Node required for TS typecheck')
    def test_generated_patch_typechecks_against_real_engine(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'sonic-ui.ts'
            path.write_text(compiler.compile_ts_hook(PRESETS['brutalist_mono']), encoding='utf-8')
            script = '''const ts=require('typescript'); const p=process.argv[1]; const program=ts.createProgram([p],{strict:true,noEmit:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,lib:['lib.es2022.d.ts','lib.dom.d.ts'],skipLibCheck:true,types:[]}); const errors=ts.getPreEmitDiagnostics(program); if(errors.length){console.error(ts.formatDiagnosticsWithColorAndContext(errors,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>process.cwd(),getNewLine:()=>"\\n"}));process.exit(1)}'''
            completed = subprocess.run(['node', '-e', script, str(path)], cwd=ROOT, text=True, capture_output=True, timeout=30)
            self.assertEqual(completed.returncode, 0, completed.stderr)


@unittest.skipUnless(shutil.which('node'), 'Node required for TS AST injector')
class InjectionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / 'src').mkdir()
        self.source = self.root / 'src' / 'App.tsx'
        self.module = self.root / 'src' / 'sonic-ui.ts'
        self.module.write_text('export const sonic = {onHover(){},onFocus(){},onCommit(){},onToggle(){}};\n', encoding='utf-8')

    def tearDown(self): self.tmp.cleanup()

    def test_plan_preserves_nested_arrow_returns_and_dry_run(self):
        original = 'import React from "react";\nexport const App = () => <button onClick={(event) => { if (event) { return {nested: {ok: true}}; } return null; }}>Go</button>;\n'
        self.source.write_text(original, encoding='utf-8')
        plan = injection.plan_injection(self.root)
        self.assertEqual(self.source.read_text(encoding='utf-8'), original)
        self.assertEqual(plan['files'][0]['sha256'], hashlib.sha256(self.source.read_bytes()).hexdigest())
        self.assertIn('hermesSonic.onCommit();', plan['files'][0]['diff'])
        applied = injection.apply_injection(self.root, plan)
        changed = self.source.read_text(encoding='utf-8')
        self.assertTrue(applied['ok'])
        self.assertIn('return {nested: {ok: true}};', changed)
        self.assertFalse(injection.plan_injection(self.root)['files'])

    def test_expression_handler_preserves_return_and_opt_out(self):
        self.source.write_text('const App = () => <><button onClick={(e) => e.currentTarget.id}>A</button><button data-sonic-ui="off" onClick={cb}>B</button></>;\n', encoding='utf-8')
        plan = injection.plan_injection(self.root)
        self.assertEqual(len(plan['files']), 1)
        self.assertIn('return (e.currentTarget.id);', plan['files'][0]['diff'])
        self.assertIn('data-sonic-ui="off" onClick={cb}', plan['files'][0]['diff'])

    def test_refuses_spread_and_server_component_and_unsupported_extensions(self):
        self.source.write_text('const App = () => <button {...props} onClick={cb}>A</button>;\n', encoding='utf-8')
        self.assertFalse(injection.plan_injection(self.root)['files'])
        app = self.root / 'app'
        app.mkdir()
        (app / 'page.tsx').write_text('export default function Page(){return <button onClick={cb}>A</button>}', encoding='utf-8')
        self.assertFalse(injection.plan_injection(self.root)['files'])
        with self.assertRaises(ValueError): injection.plan_injection(self.root / 'component.vue')

    def test_next_project_components_without_client_directive_are_skipped(self):
        (self.root / 'next.config.mjs').write_text('export default {};', encoding='utf-8')
        self.source.write_text('export function Button(){ return <button onClick={cb}>A</button> }', encoding='utf-8')
        self.assertFalse(injection.plan_injection(self.root)['files'])
        self.source.write_text('"use client";\nexport function Button(){ return <button onClick={cb}>A</button> }', encoding='utf-8')
        self.assertEqual(len(injection.plan_injection(self.root)['files']), 1)

    def test_apply_rejects_changed_content_and_does_not_write(self):
        self.source.write_text('const App = () => <button onClick={cb}>Go</button>;', encoding='utf-8')
        plan = injection.plan_injection(self.root)
        self.source.write_text('const App = () => <button onClick={other}>Go</button>;', encoding='utf-8')
        with self.assertRaises(ValueError): injection.apply_injection(self.root, plan)
        self.assertNotIn('hermesSonic', self.source.read_text(encoding='utf-8'))

    def test_selected_file_plan_applies_without_editing_other_candidate(self):
        self.source.write_text('const App = () => <button onClick={cb}>Go</button>;', encoding='utf-8')
        other = self.root / 'src' / 'Other.tsx'
        original = 'const Other = () => <button onClick={cb}>Other</button>;'
        other.write_text(original, encoding='utf-8')
        plan = injection.plan_injection(self.root, self.source)
        self.assertEqual([entry['path'] for entry in plan['files']], ['src/App.tsx'])
        injection.apply_injection(self.root, plan)
        self.assertEqual(other.read_text(encoding='utf-8'), original)

    def test_deep_component_import_is_contained_and_relative(self):
        nested = self.root / 'src' / 'components' / 'forms'
        nested.mkdir(parents=True)
        target = nested / 'Submit.tsx'
        target.write_text('export const Submit = () => <button onClick={cb}>Save</button>;', encoding='utf-8')
        plan = injection.plan_injection(self.root, target)
        self.assertEqual(len(plan['files']), 1)
        self.assertIn('"../../sonic-ui"', plan['files'][0]['diff'])

    def test_apply_requires_generated_module_without_mutating_source(self):
        original = 'const App = () => <button onClick={cb}>Go</button>;'
        self.source.write_text(original, encoding='utf-8')
        plan = injection.plan_injection(self.root)
        self.module.unlink()
        with self.assertRaises(ValueError): injection.apply_injection(self.root, plan)
        self.assertEqual(self.source.read_text(encoding='utf-8'), original)

    def test_dry_run_can_audit_before_generated_module_exists(self):
        self.source.write_text('const App = () => <button onClick={cb}>Go</button>;', encoding='utf-8')
        self.module.unlink()
        plan = injection.plan_injection(self.root)
        self.assertEqual(len(plan['files']), 1)
        self.assertIsNone(plan['module_sha256'])
        with self.assertRaises(ValueError): injection.apply_injection(self.root, plan)

    def test_symlink_escape_is_never_written(self):
        outside = self.root.parent / (self.root.name + '-outside.tsx')
        outside.write_text('const App = () => <button onClick={cb}/>;', encoding='utf-8')
        self.addCleanup(outside.unlink)
        (self.root / 'src' / 'external.tsx').symlink_to(outside)
        self.assertFalse(any(f['path'].endswith('external.tsx') for f in injection.plan_injection(self.root)['files']))


class RegistrationTests(unittest.TestCase):
    def test_registration_uses_current_native_tool_and_auxiliary_shapes(self):
        class Context:
            def __init__(self): self.tools = {}; self.aux = None; self.skill = None
            def register_tool(self, **kw): self.tools[kw['name']] = kw
            def register_hook(self, *args): pass
            def register_auxiliary_task(self, *args, **kw): self.aux = (args, kw)
            def register_skill(self, *args, **kwargs): self.skill = args
            def get_config(self, key, default=None): return default
        ctx = Context()
        plugin.register(ctx)
        self.assertEqual(set(ctx.tools), {'synthesize_ui_soundscape','audit_ui_silence','inject_sonic_hooks','sonic_create_patch'})
        self.assertEqual(ctx.aux[0], ('sonic_patch_designer',))
        self.assertEqual(ctx.skill[0], 'sonic-ui')
        result = json.loads(ctx.tools['synthesize_ui_soundscape']['handler']({'preset': 'nocturnal_dark'}))
        self.assertTrue(result['ok'])
        self.assertIn('export const useSonicUI', result['typescript'])

    def test_generated_output_never_replaces_existing_file(self):
        class Context:
            def __init__(self): self.tools = {}
            def register_tool(self, **kw): self.tools[kw['name']] = kw
            def register_hook(self, *args): pass
            def register_auxiliary_task(self, *args, **kw): pass
            def register_skill(self, *args, **kwargs): pass
            def get_config(self, key, default=None): return default
        ctx = Context()
        plugin.register(ctx)
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / 'sonic-ui.ts'
            handler = ctx.tools['synthesize_ui_soundscape']['handler']
            first = json.loads(handler({'preset': 'nocturnal_dark', 'output_path': str(output)}))
            self.assertTrue(first['ok'])
            saved = output.read_bytes()
            second = json.loads(handler({'preset': 'post_bop_chamber', 'output_path': str(output)}))
            self.assertFalse(second['ok'])
            self.assertEqual(saved, output.read_bytes())

    def test_host_llm_result_is_locally_revalidated_before_output(self):
        class LLM:
            def __init__(self): self.calls = 0
            def complete_structured(self, **kwargs):
                self.calls += 1
                self.assert_route = kwargs['task']
                class Result: parsed = {'fake': 'provider returned invalid patch'}
                return Result()
        class Context:
            def __init__(self): self.tools = {}; self.llm = LLM()
            def register_tool(self, **kw): self.tools[kw['name']] = kw
            def register_hook(self, *args): pass
            def register_auxiliary_task(self, *args, **kwargs): pass
            def register_skill(self, *args, **kwargs): pass
            def get_config(self, key, default=None): return default
        ctx = Context()
        plugin.register(ctx)
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / 'result.ts'
            answer = json.loads(ctx.tools['synthesize_ui_soundscape']['handler']({'brief': 'gentle, short confirmations', 'output_path': str(output)}))
            self.assertFalse(answer['ok'])
            self.assertEqual(ctx.llm.calls, 1)
            self.assertEqual(ctx.llm.assert_route, 'sonic_patch_designer')
            self.assertFalse(output.exists())


if __name__ == '__main__': unittest.main()
