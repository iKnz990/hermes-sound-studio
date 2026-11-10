"""Native Sound Studio tool/RPC registration, separate from local audio and UI."""
import json
import sys
import uuid
from pathlib import Path
from . import studio_backend

def register_studio(ctx):
    service=studio_backend.bind(ctx)
    if service is not None:
        sys.modules[studio_backend.bridge_key(Path(__file__).resolve().parent)]=studio_backend
    def notification(record):
        try:
            identity={'request_id':record['request_id'],'session_id':record['session_id']}
            if callable(getattr(ctx,'emit_to_session',None)):
                ctx.emit_to_session(record['session_id'],'studio.draft-ready',identity)
            else:
                from hermes_cli.plugin_events import broadcast_plugin_event
                broadcast_plugin_event('hermes-sonic-ui','studio.draft-ready',identity)
        except Exception:pass  # Exact-ID status read is the fallback; never resubmit.
    if service is not None:service.on_result=notification
    def tool(args,**kwargs):
        try:
            if service is None:raise RuntimeError('Sound draft generation is unavailable in this profile')
            if not isinstance(args,dict) or set(args)-{'description','patch','event','current_patch','request_id'}:raise ValueError('Unknown arguments')
            if ('patch' in args)==('description' in args):raise ValueError('Supply exactly one description or patch')
            event=args.get('event','onCommit')
            presets=json.loads((Path(__file__).parent/'assets/studio-palettes.json').read_text(encoding='utf-8'))
            starting=args.get('current_patch',presets[0]['events'].get(event))
            body={'request_id':args.get('request_id',str(uuid.uuid4())),'session_id':kwargs.get('session_id') or 'agent-tool','event':event,'current_patch':starting,**{k:args[k] for k in ('description','patch') if k in args}}
            result=service.generate(body)
            return json.dumps({'ok':result['status']=='completed',**result,'note':'Draft only. Accept or import it in Sound Studio; no active event mapping was changed.'},allow_nan=False)
        except Exception:return json.dumps({'ok':False,'error':'Sound draft request rejected. Check schema, native bridge and current profile; no sound was applied.'})
    schema=json.loads((Path(__file__).parent/'assets/sound-patch-v1.schema.json').read_text(encoding='utf-8'))
    # Hermes embeds parameter properties below tool-root, so local #/$defs refs
    # inside a patch property would otherwise resolve against the wrong object.
    def inline(node):
        if isinstance(node,list):return [inline(item) for item in node]
        if not isinstance(node,dict):return node
        if '$ref' in node:
            ref=node['$ref']
            if set(node)!={'$ref'} or ref not in ('#/$defs/oscillator','#/$defs/lfo'):
                raise ValueError('Unexpected SoundPatch schema reference')
            return inline(schema['$defs'][ref.removeprefix('#/$defs/')])
        return {key:inline(value) for key,value in node.items() if key!='$defs'}
    tool_patch_schema=inline(schema)
    ctx.register_tool(name='sonic_create_patch',toolset='sonic_ui',handler=tool,schema={'name':'sonic_create_patch','description':'Create and preserve a validated SoundPatch/v1 draft. Supply patch JSON from the current conversation, or a description for a separate configured-model call. Never applies audio or writes existing projects. Reuse request_id when checking an uncertain attempt.','parameters':{'type':'object','additionalProperties':False,'properties':{'description':{'type':'string','minLength':1,'maxLength':1500},'patch':tool_patch_schema,'current_patch':tool_patch_schema,'event':{'type':'string','enum':list(studio_backend.EVENTS)},'request_id':{'type':'string','format':'uuid'}}}})
    if service is not None and callable(getattr(ctx,'register_rpc',None)):
        def start(params,**kwargs):
            session=kwargs.get('session_id')
            if not session or params.get('session_id')!=session:raise ValueError('RPC session mismatch')
            return service.start(params)
        def status(params,**kwargs):
            session=kwargs.get('session_id')
            if not session or params.get('session_id')!=session:raise ValueError('RPC session mismatch')
            return service.read(params.get('request_id'),session)
        ctx.register_rpc('studio_generate',start)
        ctx.register_rpc('studio_status',status)
