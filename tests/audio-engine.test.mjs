import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const patch = JSON.parse(readFileSync(new URL('../assets/presets.json', import.meta.url))).nocturnal_dark;
let contexts = [];
class Param { values = []; value = 1; setValueAtTime(v,t) { this.values.push(['set',v,t]); this.value=v; } linearRampToValueAtTime(v,t) { this.values.push(['linear',v,t]); this.value=v; } exponentialRampToValueAtTime(v,t) { this.values.push(['exponential',v,t]); this.value=v; } cancelScheduledValues(t) { this.values.push(['cancel',t]); } }
class Node { connections=[]; disconnected=false; connect(n) { this.connections.push(n); return n; } disconnect() { this.disconnected=true; this.connections=[]; } }
class Source extends Node { started=[]; stopped=[]; onended=null; start(t) { this.started.push(t); } stop(t) { this.stopped.push(t); } }
class Osc extends Source { frequency=new Param(); type='sine'; }
class Gain extends Node { gain=new Param(); }
class Filter extends Node { frequency=new Param(); Q=new Param(); type='lowpass'; }
class Pan extends Node { pan=new Param(); }
class BufferSource extends Source { buffer=null; }
class FakeContext {
  state='running'; currentTime=10; sampleRate=48000; destination=new Node(); nodes=[]; resumed=0; closed=0;
  constructor() { contexts.push(this); }
  make(ctor) { const n=new ctor(); this.nodes.push(n); return n; }
  createOscillator() { return this.make(Osc); }
  createGain() { return this.make(Gain); }
  createBiquadFilter() { return this.make(Filter); }
  createStereoPanner() { return this.make(Pan); }
  createBufferSource() { return this.make(BufferSource); }
  createBuffer(_channels,length) { const data=new Float32Array(length); return {getChannelData:()=>data,data}; }
  async resume() { this.resumed++; this.state='running'; }
  async close() { this.closed++; this.state='closed'; }
}
globalThis.AudioContext=FakeContext;
afterEach(() => { contexts=[]; globalThis.AudioContext=FakeContext; delete globalThis.requestAnimationFrame; delete globalThis.cancelAnimationFrame; });
const { SonicEngine } = await import('../assets/audio-engine.ts');

test('repeated explicit enable resumes a context suspended after synchronous first enable',async()=>{
  const e=new SonicEngine(patch); await e.enable(); const c=contexts[0]; c.state='suspended';
  assert.equal(await e.enable(),true); assert.equal(c.resumed,1); assert.equal(c.state,'running'); await e.dispose();
});
test('engine defaults quiet',async()=>{
  const e=new SonicEngine(patch); assert.equal(e.getSnapshot().volume,.12); await e.dispose();
});
test('wrap preserves optional unbound handler and return value',async()=>{
  const e=new SonicEngine(patch);
  let receiver='unset'; const fn=function(value){receiver=this;return value+1};
  assert.equal(e.wrap(fn,'onCommit')(4),5); assert.equal(receiver,undefined);
  assert.equal(e.wrap(undefined,'onCommit')({}),undefined); await e.dispose();
});
test('CSS energy follows actual scheduled attack and decay, master gain and silence',async()=>{
  let frame; globalThis.requestAnimationFrame=fn=>{frame=fn;return 1}; globalThis.cancelAnimationFrame=()=>{};
  const style={values:new Map(),setProperty(k,v){this.values.set(k,v)},removeProperty(k){this.values.delete(k)}};
  const single=structuredClone(patch); single.events.onCommit={...single.events.onCommit,attack_ms:100,decay_ms:200,chord_intervals:[0]};
  const e=new SonicEngine(single,{enableCssVars:true,cssTarget:{style},volume:1}); await e.enable(); const c=contexts[0];
  e.trigger('onCommit'); assert.ok(e.getSnapshot().energy<.001,'attack starts at silence, not a fabricated peak');
  c.currentTime=10.1;frame();const peak=e.getSnapshot().energy;assert.ok(peak>.4);
  c.currentTime=10.2;frame();assert.ok(e.getSnapshot().energy<peak/2,'exponential decay follows configured envelope');
  e.setVolume(0); frame();assert.equal(e.getSnapshot().energy,0);assert.equal(style.values.get('--sonic-energy'),'0'); await e.dispose();
});
test('partial WebAudio graph creation failure disconnects already-created nodes',async()=>{
  const e=new SonicEngine(patch); await e.enable(); const c=contexts[0];
  c.createBiquadFilter=()=>{throw Error('test graph allocation failure')};
  assert.equal(e.trigger('onCommit'),false);assert.equal(e.getSnapshot().activeVoices,0);
  assert.ok(c.nodes.filter(n=>!(n instanceof Gain && n.connections.includes(c.destination))).every(n=>n.disconnected)); await e.dispose();
});
test('audio stays disabled until enable gesture; no auto resume on trigger', async () => {
  const e=new SonicEngine(patch); assert.equal(e.trigger('onCommit'),false); assert.equal(contexts.length,0);
  assert.equal(await e.enable(),true); assert.equal(contexts.length,1); assert.equal(e.trigger('onCommit'),true);
  contexts[0].state='suspended'; assert.equal(e.trigger('onCommit'),false); assert.equal(contexts[0].resumed,0);
  await e.dispose(); assert.equal(contexts[0].closed,1);
});
test('mute immediately closes master including queued pulse; unmutes to requested volume',async()=>{
  const e=new SonicEngine(patch); await e.enable(); const c=contexts[0];
  e.startPulse(); e.setMuted(true); const master=c.nodes.find(n=>n instanceof Gain && n.connections.includes(c.destination));
  assert.ok(master); assert.equal(master.gain.value,0); assert.equal(e.trigger('onCommit'),false);
  e.setVolume(.27); assert.equal(master.gain.value,0); e.setMuted(false); assert.equal(master.gain.value,.27);
  await e.dispose();
});
test('voice graph has chord FM noise filter pan and deterministic seeded noise', async()=>{
  const e=new SonicEngine(patch); await e.enable(); const c=contexts[0];
  assert.equal(e.trigger('onBackgroundTaskComplete'),true);
  assert.equal(c.nodes.filter(n=>n instanceof Filter).length,6);
  assert.equal(c.nodes.filter(n=>n instanceof Pan).length,6);
  assert.equal(c.nodes.filter(n=>n instanceof BufferSource).length,1);
  assert.ok(c.nodes.some(n=>n instanceof Osc && n.connections.includes(c.nodes.find(x=>x instanceof Filter))));
  const first=c.nodes.find(n=>n instanceof BufferSource).buffer.data.slice(0,64);
  await e.dispose(); const e2=new SonicEngine(patch); await e2.enable(); e2.trigger('onBackgroundTaskComplete');
  assert.deepEqual(contexts[1].nodes.find(n=>n instanceof BufferSource).buffer.data.slice(0,64),first);
  await e2.dispose();
});
test('bounded voice and trigger rate, stopAll and dispose disconnect sources and nodes',async()=>{
  const e=new SonicEngine(patch); await e.enable(); const c=contexts[0];
  let accepted=0; for(let i=0;i<100;i++) if(e.trigger('onBackgroundTaskComplete')) accepted++;
  assert.ok(accepted>0 && accepted<100); assert.ok(e.getSnapshot().activeVoices<=24);
  e.stopAll(); assert.equal(e.getSnapshot().activeVoices,0);
  assert.ok(c.nodes.filter(n=>n instanceof Source).every(n=>n.stopped.length>0 && n.disconnected));
  await e.dispose(); assert.equal(c.closed,1); assert.equal(e.trigger('onCommit'),false);
});
test('pulse aligns to 126 BPM six subdivisions, and stop cancels future voices',async()=>{
  const e=new SonicEngine(patch); await e.enable(); const c=contexts[0];
  e.startPulse(); const times=c.nodes.filter(n=>n instanceof Osc && n.started.length).map(n=>n.started[0]);
  assert.ok(times.length>1); assert.ok(times.every(t=>t>=c.currentTime));
  e.stopPulse(); assert.equal(e.getSnapshot().activeVoices,0); await e.dispose();
});
test('pulse six-step grid follows audio clock at exact 126 BPM',async()=>{
  const e=new SonicEngine(patch);await e.enable();const c=contexts[0];e.startPulse();
  c.currentTime=10.25;
  await new Promise(resolve=>setTimeout(resolve,80));
  const starts=[...new Set(c.nodes.filter(n=>n instanceof Osc).flatMap(n=>n.started))].sort((a,b)=>a-b);
  assert.ok(starts.some(t=>Math.abs(t-(10.03+2*(2*60/126/6)))<1e-9),JSON.stringify(starts));
  e.stopPulse();await e.dispose();
});
test('telemetry tracks exact IDs for only focused default-profile session and dedupes terminal frames', async()=>{
  const { LifecycleTracker } = await import('../desktop-src/telemetry.ts');
  const t=new LifecycleTracker(); t.setScope('default','session-1','connected','local');
  t.accept({type:'tool.start',session_id:'session-2',payload:{tool_id:'other',name:'terminal'}});
  t.accept({type:'tool.start',session_id:'session-1',profile:'other',payload:{tool_id:'other',name:'terminal'}});
  assert.equal(t.getSnapshot().activeTools,0);
  t.accept({type:'tool.start',session_id:'session-1',payload:{tool_id:'a',name:'terminal'}});
  t.accept({type:'tool.start',session_id:'session-1',payload:{tool_id:'a',name:'terminal'}});
  t.accept({type:'subagent.start',session_id:'session-1',payload:{subagent_id:'worker',goal:'test'}});
  assert.equal(t.getSnapshot().activeTools,1); assert.equal(t.getSnapshot().activeAgents,1);
  t.accept({type:'subagent.complete',session_id:'session-1',payload:{subagent_id:'worker',status:'failed'}});
  t.accept({type:'subagent.complete',session_id:'session-1',payload:{subagent_id:'worker',status:'failed'}});
  t.accept({type:'tool.complete',session_id:'session-1',payload:{tool_id:'a',name:'terminal'}});
  assert.equal(t.getSnapshot().activeTools,0); assert.equal(t.getSnapshot().activeAgents,0);
  assert.equal(t.getSnapshot().completedAgents,0); assert.equal(t.getSnapshot().failedAgents,1);
  t.setScope('other','session-1','connected'); assert.equal(t.getSnapshot().mode,'out-of-scope');
  t.setScope('default','session-3','connected'); assert.equal(t.getSnapshot().failedAgents,0);
  t.accept({type:'subagent.complete',session_id:'session-3',payload:{subagent_id:'unknown',status:'completed'}});
  assert.equal(t.getSnapshot().completedAgents,0);
  t.setScope('default','session-3','reconnecting'); assert.equal(t.getSnapshot().activeAgents,0);
});
test('workbench TypeScript exporter byte-matches Python canonical compiler for same JSON patch',async()=>{
  const {build}=await import('esbuild');
  const {fileURLToPath}=await import('node:url');
  const {resolve,dirname}=await import('node:path');
  const {spawnSync}=await import('node:child_process');
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const compiled=await build({absWorkingDir:root,entryPoints:['desktop-src/export.ts'],bundle:true,format:'esm',platform:'node',write:false,
    plugins:[{name:'raw',setup(b){b.onResolve({filter:/\?raw$/},a=>({path:resolve(a.resolveDir,a.path.replace(/\?raw$/,'')),namespace:'raw'}));b.onLoad({filter:/.*/,namespace:'raw'},a=>({contents:readFileSync(a.path,'utf8'),loader:'text'}));}}]});
  const exporter=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].contents).toString('base64'));
  const py=`import json,sys,types,importlib.util,pathlib\nroot=pathlib.Path(sys.argv[1]); p=types.ModuleType('sonic');p.__path__=[str(root)];sys.modules['sonic']=p\nspec=importlib.util.spec_from_file_location('sonic.compiler',root/'compiler.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)\nsys.stdout.buffer.write(m.compile_ts_hook(json.loads(sys.argv[2]),enable_css_vars=True).encode('utf-8'))`;
  const result=spawnSync('python3',['-c',py,root,JSON.stringify(patch)],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const actual=exporter.compileWorkbenchHook(patch), expected=result.stdout;
  const mismatch=[...actual].findIndex((char,i)=>char!==expected[i]);
  assert.equal(mismatch,-1,`first mismatch ${mismatch}: ${JSON.stringify(actual.slice(mismatch-30,mismatch+80))} vs ${JSON.stringify(expected.slice(mismatch-30,mismatch+80))}`);
  assert.equal(actual.length,expected.length);
  const ts=await import('typescript');
  const virtual=resolve(root,'assets','hook.generated.ts');
  const options={strict:true,noEmit:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,lib:['lib.es2022.d.ts','lib.dom.d.ts'],types:[],skipLibCheck:true};
  const host=ts.createCompilerHost(options), read=host.readFile.bind(host), exists=host.fileExists.bind(host);
  const same=f=>f.replaceAll('\\','/').toLowerCase()===virtual.replaceAll('\\','/').toLowerCase();
  host.readFile=f=>same(f)?actual:read(f);
  host.fileExists=f=>same(f)||exists(f);
  const source=host.getSourceFile.bind(host);
  host.getSourceFile=(f,languageVersion,onError,shouldCreateNewSourceFile)=>same(f)?ts.createSourceFile(f,actual,languageVersion,true):source(f,languageVersion,onError,shouldCreateNewSourceFile);
  const diagnostics=ts.getPreEmitDiagnostics(ts.createProgram([virtual],options,host));
  assert.deepEqual(diagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')),[]);
});
test('CSS target can move between scoped elements and releases old styles',async()=>{
  const make=()=>({style:{values:new Map(),setProperty(k,v){this.values.set(k,v)},removeProperty(k){this.values.delete(k)}}});
  const first=make(),second=make();
  const e=new SonicEngine(patch,{enableCssVars:true,cssTarget:first});await e.enable();e.trigger('onCommit');
  assert.ok(first.style.values.has('--sonic-energy'));
  e.setCssTarget(second);assert.equal(first.style.values.has('--sonic-energy'),false);
  assert.ok(second.style.values.has('--sonic-energy'));await e.dispose();
  assert.equal(second.style.values.has('--sonic-energy'),false);
});
test('explicit CSS opt-in without target writes root energy only until dispose',async()=>{
  const style={values:new Map(),setProperty(k,v){this.values.set(k,v)},removeProperty(k){this.values.delete(k)}};
  globalThis.document={documentElement:{style}};
  try {
    const e=new SonicEngine(patch,{enableCssVars:true}); await e.enable();e.trigger('onCommit');
    assert.ok(style.values.has('--sonic-energy')); await e.dispose();assert.equal(style.values.has('--sonic-energy'),false);
  } finally {delete globalThis.document;}
});
test('reduced motion disables animated CSS updates',async()=>{
  globalThis.matchMedia=()=>({matches:true});
  const style={values:new Map(),setProperty(k,v){this.values.set(k,v)},removeProperty(k){this.values.delete(k)}};
  try {const e=new SonicEngine(patch,{enableCssVars:true,cssTarget:{style}});await e.enable();e.trigger('onCommit');
    assert.equal(e.getSnapshot().energy,0);assert.equal(style.values.has('--sonic-energy'),false);await e.dispose();}
  finally{delete globalThis.matchMedia;}
});
test('legacy CSS meter keeps frame updates while snapshot energy is bounded',async()=>{
  let frame; globalThis.requestAnimationFrame=fn=>{frame=fn;return 1};globalThis.cancelAnimationFrame=()=>{};
  const style={writes:0,setProperty(){this.writes++},removeProperty(){}};
  const e=new SonicEngine(patch,{enableCssVars:true,cssTarget:{style},volume:1});
  let energyNotices=0,last=e.getSnapshot().energy;
  e.subscribe(()=>{if(e.getSnapshot().energy!==last){last=e.getSnapshot().energy;energyNotices++;}});
  await e.enable();e.trigger('onCommit');const c=contexts[0],baseline=style.writes;
  for(let i=0;i<60;i++){c.currentTime=10+i*.005;frame();}
  assert.ok(style.writes-baseline>=60,'CSS keeps smooth frames');
  assert.ok(energyNotices<=6,`React snapshot publication too frequent: ${energyNotices}`);
  await e.dispose();
});
test('snapshot notifications remain stable and CSS target is scoped',async()=>{
  const style={values:new Map(),setProperty(k,v){this.values.set(k,v)},removeProperty(k){this.values.delete(k)}};
  const target={style}; const e=new SonicEngine(patch,{enableCssVars:true,cssTarget:target});
  const a=e.getSnapshot(); assert.equal(e.getSnapshot(),a); let calls=0; const off=e.subscribe(()=>calls++);
  await e.enable(); e.trigger('onCommit'); assert.ok(calls>0); assert.ok(style.values.has('--sonic-energy'));
  e.setMuted(true); assert.equal(style.values.get('--sonic-energy'),'0'); off(); await e.dispose(); assert.equal(style.values.has('--sonic-energy'),false);
});
