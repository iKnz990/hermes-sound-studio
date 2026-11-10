"""Native Hermes plugin entrypoint: deterministic patch compiler and guarded JSX injector."""
from __future__ import annotations
import json
import hashlib
import os
from pathlib import Path
import tempfile
from .synth_schema import PATCH_SCHEMA, load_preset, validate_patch
from .compiler import compile_ts_hook
from .injector import apply_injection, plan_injection
from .safety import external_write_path


def _result(fn):
    try:
        return json.dumps({'ok': True, **fn()}, ensure_ascii=True, allow_nan=False)
    except (ValueError, TypeError, OSError, KeyError, TimeoutError) as exc:
        return json.dumps({'ok': False, 'error': str(exc)[:500]}, ensure_ascii=True)


def _write_new(path_value, content):
    if not isinstance(path_value, str) or not Path(path_value).is_absolute():
        raise ValueError('output_path must be absolute')
    path = external_write_path(path_value)
    if path.exists() or path.is_symlink() or not path.parent.is_dir() or path.parent.is_symlink():
        raise ValueError('output already exists or parent is unsafe')
    if len(content.encode('utf-8')) > 512_000:
        raise ValueError('generated output exceeds 512KB')
    # Stage complete bytes, then publish with exclusive hardlink (no replace).
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='wb', dir=path.parent,
                                         prefix='.sonic-generation-', suffix='.tmp', delete=False) as f:
            temporary = Path(f.name)
            f.write(content.encode('utf-8'))
            f.flush()
            os.fsync(f.fileno())
        os.link(temporary, path)  # fails rather than clobbering an existing target
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return str(path)


def _schema(name, description, properties, required=()):
    return {'name': name, 'description': description,
            'parameters': {'type': 'object', 'properties': properties,
                           'required': list(required), 'additionalProperties': False}}


def register(ctx):
    """No directory creation, model change, source edit or LLM request at registration."""
    def pre_tool_call(tool_name, args, **kwargs):
        if not isinstance(args, dict):
            return None
        if tool_name == 'inject_sonic_hooks' and args.get('apply') is True:
            value = args.get('project_root')
            operation = 'Apply the reviewed JSX/TSX edits and create backups in'
        elif tool_name == 'synthesize_ui_soundscape' and 'output_path' in args:
            value = args['output_path']
            operation = 'Write a new generated TypeScript sound runtime to'
        else:
            return None
        try:
            path = external_write_path(value)
        except (ValueError, TypeError, OSError, RuntimeError) as exc:
            return {'action': 'block', 'message': str(exc)}
        # An "always" grant for one destination must not authorize other projects.
        key = hashlib.sha256(str(path).encode('utf-8')).hexdigest()
        return {'action': 'approve', 'message': f'{operation}:\n{path}',
                'rule_key': f'hermes-sonic-ui:{tool_name}:{key}'}

    ctx.register_hook('pre_tool_call', pre_tool_call)
    ctx.register_auxiliary_task('sonic_patch_designer', display_name='Sonic Patch Designer',
                                description='Optional structured UI audio patch design; never used by deterministic presets.')
    ctx.register_skill('sonic-ui', Path(__file__).resolve().parent / 'skills' / 'sonic-ui' / 'SKILL.md',
                       description='Use for validated opt-in UI audio and guarded JSX hook injection.')

    def synthesize(args, **kwargs):
        def run():
            if not isinstance(args, dict) or set(args) - {'preset', 'patch', 'brief', 'output_path', 'enable_css_vars'}:
                raise ValueError('unknown synthesis arguments')
            choices = [name for name in ('preset', 'patch', 'brief') if name in args]
            if len(choices) > 1:
                raise ValueError('choose exactly one preset, patch or brief')
            enable = args.get('enable_css_vars', ctx.get_config('enable_css_vars', True))
            if type(enable) is not bool:
                raise ValueError('enable_css_vars must be boolean')
            if 'patch' in args:
                patch, origin = validate_patch(args['patch']), 'explicit_patch'
            elif 'brief' in args:
                brief = args['brief']
                if not isinstance(brief, str) or not 1 <= len(brief.strip()) <= 1500:
                    raise ValueError('brief must be 1..1500 characters')
                result = ctx.llm.complete_structured(
                    instructions='Create one usable sound patch for six UI event voices. Respond only with a strict JSON object matching the provided schema. No prose.',
                    input=[{'type': 'text', 'text': brief}], json_schema=PATCH_SCHEMA,
                    schema_name='sonic_patch', task='sonic_patch_designer', purpose='sonic.patch-design',
                    temperature=0.2, max_tokens=2500)
                if result.parsed is None:
                    raise ValueError('model did not return a valid structured patch')
                patch, origin = validate_patch(result.parsed), 'host_llm'
            else:
                patch = load_preset(args.get('preset', ctx.get_config('default_preset', 'nocturnal_dark')))
                origin = 'preset'
            typescript = compile_ts_hook(patch, enable_css_vars=enable)
            output = {'origin': origin, 'patch': patch, 'typescript': typescript}
            if 'output_path' in args:
                output['output_path'] = _write_new(args['output_path'], typescript)
            return output
        return _result(run)

    def audit(args, **kwargs):
        def run():
            if not isinstance(args, dict) or set(args) - {'project_root', 'target', 'module', 'max_files'}:
                raise ValueError('unknown audit arguments')
            plan = plan_injection(args['project_root'], args.get('target'), module=args.get('module', 'src/sonic-ui.ts'), max_files=args.get('max_files', 20))
            return {'classification': 'eligible JSX event hooks and explicit skips; silence is not inferred from visual UI',
                    'eligible_files': len(plan['files']), 'skipped': plan['skipped'], 'plan_sha256': plan['plan_sha256']}
        return _result(run)

    def inject(args, **kwargs):
        def run():
            if not isinstance(args, dict) or set(args) - {'project_root', 'target', 'module', 'max_files', 'apply', 'plan'}:
                raise ValueError('unknown injection arguments')
            if type(args.get('apply', False)) is not bool:
                raise ValueError('apply must be boolean')
            if args.get('apply', False):
                if set(args) - {'project_root', 'apply', 'plan'}:
                    raise ValueError('apply accepts only project_root and a pre-reviewed plan')
                return apply_injection(args['project_root'], args['plan'])
            if 'plan' in args:
                raise ValueError('plan only accepted for apply')
            return {'applied': False, 'plan': plan_injection(args['project_root'], args.get('target'),
                module=args.get('module', 'src/sonic-ui.ts'), max_files=args.get('max_files', 20))}
        return _result(run)

    ctx.register_tool(name='synthesize_ui_soundscape', toolset='sonic_ui', handler=synthesize,
        schema=_schema('synthesize_ui_soundscape', 'Generate a validated six-event UI audio patch and canonical TypeScript runtime; offline presets by default. Writing output_path requires human approval.',
            {'preset': {'type': 'string', 'enum': ['nocturnal_dark', 'post_bop_chamber', 'brutalist_mono']},
             'patch': PATCH_SCHEMA, 'brief': {'type': 'string', 'maxLength': 1500},
             'output_path': {'type': 'string'}, 'enable_css_vars': {'type': 'boolean'}}))
    ctx.register_tool(name='audit_ui_silence', toolset='sonic_ui', handler=audit,
        schema=_schema('audit_ui_silence', 'Read-only JSX/TSX event-hook eligibility and explicit skip reasons; no subjective silence judgment.',
            {'project_root': {'type': 'string'}, 'target': {'type': 'string'}, 'module': {'type': 'string'},
             'max_files': {'type': 'integer', 'minimum': 1, 'maximum': 20}}, ['project_root']))
    ctx.register_tool(name='inject_sonic_hooks', toolset='sonic_ui', handler=inject,
        schema=_schema('inject_sonic_hooks', 'Plan dry-run JSX/TSX AST edits; applying an unchanged hash-bound plan requires human approval and keeps backups.',
            {'project_root': {'type': 'string'}, 'target': {'type': 'string'}, 'module': {'type': 'string'},
             'max_files': {'type': 'integer', 'minimum': 1, 'maximum': 20}, 'apply': {'type': 'boolean'},
             'plan': {'type': 'object'}}, ['project_root']))

    from .studio_registration import register_studio
    register_studio(ctx)

