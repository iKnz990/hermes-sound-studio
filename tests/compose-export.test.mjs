import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile,access} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const out=path.join(root,`evidence/compose-wav-v1/renderer/tests-${Date.now()}-${process.pid}`);
await mkdir(out,{recursive:true});
let available=true;try{await access(path.join(root,'desktop-src/compose-export.ts'));}catch{available=false;}
const result=await build({stdin:{contents:`export * from './desktop-src/compose-model';export * from './desktop-src/compose-audio';export * from './desktop-src/compose-live-cache';${available?"export * from './desktop-src/compose-export';export * from './desktop-src/compose-mix';":''}`,resolveDir:root},bundle:true,write:false,platform:'node',format:'cjs'});
const file=path.join(out,'export-test.cjs');await writeFile(file,result.outputFiles[0].contents);
const api=createRequire(import.meta.url)(file);
function render(...args){assert.equal(typeof api.renderCompositionWav,'function','canonical Compose WAV renderer is not implemented');return api.renderCompositionWav(...args);}
function key(...args){assert.equal(typeof api.compositionExportKey,'function','export snapshot identity is not implemented');return api.compositionExportKey(...args);}
const clone=value=>structuredClone(value);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function fixture(){const c=api.createComposition();c.layers=c.layers.slice(0,1);c.bars=1;c.layers[0].gainDb=0;c.layers[0].notes=[{...c.layers[0].notes[0],id:'note-a',beat:0,duration:.5}];return c;}
function pcm(frames=480,channels=2,rate=48000,value=.125){const data=Array.from({length:channels},()=>new Float32Array(frames).fill(value));return {length:frames,numberOfChannels:channels,sampleRate:rate,duration:frames/rate,getChannelData:c=>data[c]};}
function rig(renderPatch=async()=>pcm()){
 const calls=[],contexts=[];
 const deps={render:async(...args)=>{calls.push(args);return renderPatch(...args);},createContext(channels,length,sampleRate){
  const nodes=[],sources=[],ctx={length,sampleRate,destination:{kind:'destination'},nodes,sources,started:false,
   createGain(){const node={kind:'gain',gain:{value:1},connect(to){node.to=to;},disconnect(){node.disconnected=true;}};nodes.push(node);return node;},
   createDynamicsCompressor(){const node={kind:'compressor',threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0},connect(to){node.to=to;},disconnect(){node.disconnected=true;}};nodes.push(node);return node;},
   createBufferSource(){const node={kind:'source',buffer:null,connect(to){node.to=to;},start(at){node.at=at;node.renderedBuffer=node.buffer;},disconnect(){node.disconnected=true;}};sources.push(node);return node;},
   async startRendering(){ctx.started=true;return ctx.output??pcm(length,channels,sampleRate,0);}};
  contexts.push(ctx);return ctx;
 }};
 return {deps,calls,contexts};
}
function riff(wav){const view=new DataView(wav.buffer,wav.byteOffset,wav.byteLength),text=(o,n)=>new TextDecoder().decode(wav.subarray(o,o+n));return {view,text};}
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;}

test('one active loop starts at beat zero with exact bar/meter/tempo timing, never wrapped onsets',async()=>{
 const c=fixture();c.tempo=150;c.meter=3;c.bars=2;c.layers[0].notes=[0,1.5,5.75,6].map((beat,i)=>({...c.layers[0].notes[0],id:`n${i}`,beat}));
 const r=rig(),progress=[];const result=await render(c,{onProgress:(done,total)=>progress.push([done,total])},r.deps);
 assert.ok(Math.abs(result.loopSeconds-2.4)<1e-12);assert.equal(result.noteCount,3);assert.equal(result.sampleRate,48000);
 assert.deepEqual(r.contexts[0].sources.map(s=>Math.round(s.at*48000)),[0,28800,110400]);assert.equal(r.calls.length,1,'same adapted patch is rendered once');
 assert.ok(result.duration>=2.4);assert.equal(result.duration,r.contexts[0].length/48000);assert.deepEqual(progress,[[0,2],[1,2],[2,2]]);
 const {view,text}=riff(result.wav);assert.equal(text(0,4),'RIFF');assert.equal(text(8,4),'WAVE');assert.equal(text(12,4),'fmt ');assert.equal(text(36,4),'data');assert.equal(view.getUint16(20,true),3);assert.equal(view.getUint16(22,true),2);assert.equal(view.getUint32(24,true),48000);assert.equal(view.getUint16(34,true),32);assert.equal(view.getUint32(40,true),r.contexts[0].length*8);assert.equal(view.getUint32(4,true),result.wav.length-8);
});
test('mute and transient Solo select only eligible layers, with layer gain ahead of shared output graph',async()=>{
 const c=api.createComposition();c.layers[0].gainDb=-7;c.layers[1].gainDb=3;c.layers[0].muted=true;
 const r=rig();const result=await render(c,{soloLayers:new Set([c.layers[1].id])},r.deps);
 assert.equal(result.noteCount,2);assert.equal(r.calls.length,1);const ctx=r.contexts[0],master=ctx.nodes.find(n=>n.kind==='gain'&&n.gain.value===.22),limiter=ctx.nodes.find(n=>n.kind==='compressor');
 assert.ok(master);assert.equal(master.to,limiter);assert.equal(limiter.to,ctx.destination);assert.deepEqual(['threshold','knee','ratio','attack','release'].map(p=>limiter[p].value),[-5,0,20,.003,.1]);
 for(const source of ctx.sources){assert.equal(source.to.gain.value,10**(3/20));assert.equal(source.to.to,master);assert.equal(source.renderedBuffer,r.calls.length?ctx.sources[0].renderedBuffer:null);}
 const none=rig();await assert.rejects(render(c,{soloLayers:new Set([c.layers[0].id])},none.deps),/no.*notes|unmuted/i);assert.equal(none.calls.length,0);assert.equal(none.contexts.length,0);
});
test('canonical adapted patches preserve positive/negative pre-FX patch gain; no per-note gain multiplier',async()=>{
 for(const gain of [6,-12]){const c=fixture();c.layers[0].patch.playback.gainDb=gain;c.layers[0].patch.fx.saturation=true;c.layers[0].patch.fx.compressor=true;
  const r=rig();await render(c,{},r.deps);assert.deepEqual(r.calls[0],[api.adaptComposeNote(c.layers[0].patch,c.layers[0].notes[0],c.tempo).patch,{sampleRate:48000,masterGain:1}]);assert.equal(r.calls[0][0].playback.gainDb,gain);assert.equal(r.contexts[0].nodes.filter(n=>n.kind==='gain').length,2);
 }
});
test('overlapping late notes retain actual rendered tails beyond loop end without repeats',async()=>{
 const c=fixture();c.layers[0].notes=[0,3.75].map((beat,i)=>({...c.layers[0].notes[0],id:`n${i}`,beat}));const r=rig(async()=>pcm(144000));const result=await render(c,{},r.deps);
 assert.equal(result.noteCount,2);assert.equal(result.loopSeconds,2);assert.ok(result.duration>=4.875);assert.ok(result.duration<4.925,'only a small documented output-compressor padding is allowed');assert.equal(r.contexts[0].sources.length,2);
});
test('detached validation preserves immutable inputs and snapshots edits made during awaits',async()=>{
 const c=fixture(),before=clone(c),gate=deferred(),r=rig(async()=>gate.promise),solo=new Set([c.layers[0].id]);const pending=render(c,{soloLayers:solo},r.deps);await flush();assert.equal(r.calls.length,1);
 c.layers[0].notes[0].beat=2;c.layers[0].gainDb=-20;solo.clear();gate.resolve(pcm());await pending;assert.equal(r.contexts[0].sources[0].at,0);assert.equal(r.contexts[0].sources[0].to.gain.value,1);
 const frozen=freeze(before),f=rig();await render(frozen,{},f.deps);assert.deepEqual(frozen,before);
});
test('empty/out-of-loop/all-muted selections reject before rendering; deliberate silent patch is valid',async()=>{
 for(const change of [c=>c.layers[0].notes=[],c=>c.layers[0].notes[0].beat=4,c=>c.layers[0].muted=true]){const c=fixture();change(c);const r=rig();await assert.rejects(render(c,{},r.deps),/no.*notes|unmuted/i);assert.equal(r.calls.length,0);assert.equal(r.contexts.length,0);}
 const c=fixture();c.layers[0].patch.osc1.enabled=false;c.layers[0].patch.osc2.enabled=false;c.layers[0].patch.noise=0;const r=rig(async()=>pcm(480,2,48000,0));assert.ok((await render(c,{},r.deps)).wav.length>44);
});
test('export key binds document identity/name/music/mix and Solo but excludes selected layer and Set order',()=>{
 const c=api.createComposition(),baseline=key(c),selection=clone(c);selection.selectedLayer=selection.layers[1].id;assert.equal(key(selection),baseline);
 for(const mutate of [c=>c.id+='-other',c=>c.name+=' changed',c=>c.tempo++,c=>c.bars++,c=>c.meter=3,c=>c.root++,c=>c.layers[0].notes[0].pitch++,c=>c.layers[0].patch.seed++,c=>c.layers[0].gainDb--,c=>c.layers[0].muted=true,c=>c.layers[0].name+=' changed']){const next=clone(c);mutate(next);assert.notEqual(key(next),baseline);}
 const ids=c.layers.map(l=>l.id);assert.equal(key(c,new Set(ids)),key(c,new Set(ids.toReversed())));assert.notEqual(key(c,new Set([ids[0]])),baseline);assert.throws(()=>key(c,new Set(['missing'])),/solo|layer/i);
 const bad=clone(c);bad.tempo=NaN;assert.throws(()=>key(bad),/range/i);assert.deepEqual(c,api.validateComposition(c));
});
test('aborted before dispatch makes no render or offline-context allocation',async()=>{
 const abort=new AbortController();abort.abort();const r=rig();await assert.rejects(render(fixture(),{signal:abort.signal},r.deps),{name:'AbortError'});assert.equal(r.calls.length,0);assert.equal(r.contexts.length,0);
});
test('abort after first pending PCM prevents subsequent unique rendering and mix',async()=>{
 const c=api.createComposition(),gate=deferred(),abort=new AbortController(),r=rig(async()=>gate.promise);const pending=render(c,{signal:abort.signal},r.deps);await flush();assert.equal(r.calls.length,1);abort.abort();gate.resolve(pcm());await assert.rejects(pending,{name:'AbortError'});assert.equal(r.calls.length,1);assert.equal(r.contexts.length,0);
});
test('progress callback cancellation between completed PCM and next job stops preparation',async()=>{
 const c=api.createComposition(),abort=new AbortController(),r=rig();await assert.rejects(render(c,{signal:abort.signal,onProgress:done=>{if(done===1)abort.abort();}},r.deps),{name:'AbortError'});assert.equal(r.calls.length,1);assert.equal(r.contexts.length,0);
});
test('abort while offline mix is pending refuses late output and supports fresh retry',async()=>{
 const gate=deferred(),abort=new AbortController(),r=rig(),original=r.deps.createContext;r.deps.createContext=(...args)=>{const ctx=original(...args);ctx.startRendering=()=>{ctx.started=true;return gate.promise;};return ctx;};
 const pending=render(fixture(),{signal:abort.signal},r.deps);await flush();assert.equal(r.contexts[0].started,true);abort.abort();gate.resolve(pcm(r.contexts[0].length));await assert.rejects(pending,{name:'AbortError'});const retry=rig();assert.ok((await render(fixture(),{},retry.deps)).wav.length>44);
});
test('abort from final progress cannot deliver a WAV',async()=>{
 const abort=new AbortController(),r=rig();await assert.rejects(render(fixture(),{signal:abort.signal,onProgress:(done,total)=>{if(done===total)abort.abort();}},r.deps),{name:'AbortError'});
});
test('render failures and final mix failures propagate without poisoning retries or creating partial output',async()=>{
 const c=fixture(),r=rig(async()=>{throw Error('canonical render failed');});await assert.rejects(render(c,{},r.deps),/canonical render failed/);assert.equal(r.contexts.length,0);
 r.deps.render=async()=>pcm();assert.ok((await render(c,{},r.deps)).wav.length>44);
 const m=rig(),original=m.deps.createContext;m.deps.createContext=(...args)=>{const ctx=original(...args);ctx.startRendering=async()=>{throw Error('offline mix failed');};return ctx;};await assert.rejects(render(c,{},m.deps),/offline mix failed/);assert.ok(m.contexts[0].sources.every(s=>s.disconnected));
});
test('PCM preparation is serial and deduplicates equivalent canonical keys across layers',async()=>{
 const c=api.createComposition();c.layers[1].patch=clone(c.layers[0].patch);c.layers[1].patch.name='metadata only';c.layers[1].notes=c.layers[1].notes.map(n=>({...n,pitch:c.layers[0].notes[0].pitch,duration:1,velocity:c.layers[0].notes[0].velocity}));
 let active=0,max=0;const r=rig(async()=>{active++;max=Math.max(max,active);await Promise.resolve();active--;return pcm();});await render(c,{},r.deps);assert.equal(r.calls.length,1);assert.equal(max,1);
 c.layers[1].patch.seed++;const second=rig(async()=>{active++;max=Math.max(max,active);await Promise.resolve();active--;return pcm();});await render(c,{},second.deps);assert.equal(second.calls.length,2);assert.equal(max,1);
});
test('invalid PCM dimensions, rate, duration, channels and non-finite data reject before final mix',async()=>{
 for(const invalid of [()=>({...pcm(),length:0}),()=>({...pcm(),length:1.5}),()=>pcm(480,1),()=>pcm(480,2,44100),()=>({...pcm(),duration:Infinity}),()=>({...pcm(),duration:999}),()=>({...pcm(),getChannelData:()=>new Float32Array(1)}),()=>{const p=pcm();p.getChannelData(1)[100]=NaN;return p;},()=>{const p=pcm();p.getChannelData(0)[479]=Infinity;return p;}]){const r=rig(async()=>invalid());await assert.rejects(render(fixture(),{},r.deps),/PCM|sample|dimension|duration|channel|finite/i);assert.equal(r.contexts.length,0);}
});
test('wrong-sized/non-finite final offline result rejects rather than encoding corrupt WAV',async()=>{
 for(const invalid of [length=>pcm(length-1),length=>pcm(length,1),length=>pcm(length,2,44100),length=>{const p=pcm(length);p.getChannelData(1)[length-1]=NaN;return p;}]){const r=rig(),original=r.deps.createContext;r.deps.createContext=(...args)=>{const ctx=original(...args);ctx.output=invalid(ctx.length);return ctx;};await assert.rejects(render(fixture(),{},r.deps),/PCM|sample|dimension|channel|finite/i);}
});
test('96 MiB unique canonical PCM budget rejects before scanning oversize data',async()=>{
 const r=rig(async()=>({length:13*1024*1024,numberOfChannels:2,sampleRate:48000,duration:13*1024*1024/48000,getChannelData(){throw Error('budget check must precede scan');}}));await assert.rejects(render(fixture(),{},r.deps),/96 MiB/);assert.equal(r.contexts.length,0);
});
test('separate 192 MiB known-buffer budget includes retained PCM plus mixed and encoded stereo output',async()=>{
 const frames=10*1024*1024,buffer=pcm(frames),r=rig(async()=>buffer);await assert.rejects(render(fixture(),{},r.deps),/192 MiB/);assert.equal(r.contexts.length,0);
});
test('default implementation uses only OfflineAudioContext, never a real-time audio device',async()=>{
 const c=fixture(),r=rig();let offline=0,realtime=0;const savedOffline=globalThis.OfflineAudioContext,savedAudio=globalThis.AudioContext;
 globalThis.AudioContext=class{constructor(){realtime++;throw Error('must not open device');}};globalThis.OfflineAudioContext=class{constructor(...args){offline++;return r.deps.createContext(...args);}};
 try{const result=await render(c,{}, {render:r.deps.render});assert.ok(result.wav.length>44);assert.equal(offline,1);assert.equal(realtime,0);}finally{globalThis.OfflineAudioContext=savedOffline;globalThis.AudioContext=savedAudio;}
});
test('aggregate budget counts distinct buffers across unique keys before reading rejected PCM',async()=>{
 const c=api.createComposition();let calls=0;const r=rig(async()=>++calls===1?pcm():{length:12*1024*1024,numberOfChannels:2,sampleRate:48000,duration:12*1024*1024/48000,getChannelData(){throw Error('aggregate budget must precede scan');}});
 await assert.rejects(render(c,{},r.deps),/96 MiB/);assert.equal(calls,2);assert.equal(r.contexts.length,0);
});
test('equivalent returned AudioBuffer identities are validated and retained once across distinct keys',async()=>{
 const c=api.createComposition(),shared=pcm(),get=shared.getChannelData;let reads=0;shared.getChannelData=channel=>{reads++;return get(channel);};const r=rig(async()=>shared);
 await render(c,{},r.deps);assert.equal(r.calls.length,2);assert.equal(reads,2,'one finite scan per actual unique buffer');assert.ok(r.contexts[0].sources.every(s=>s.renderedBuffer===shared));
});
test('actual canonical encoder interleaves final mix samples without hidden gain/normalization',async()=>{
 const r=rig(),original=r.deps.createContext;r.deps.createContext=(...args)=>{const ctx=original(...args),p=pcm(ctx.length,2,48000,0);p.getChannelData(0).set([.25,-.5]);p.getChannelData(1).set([-.125,.75]);ctx.output=p;return ctx;};
 const result=await render(fixture(),{},r.deps),{view}=riff(result.wav);assert.deepEqual([44,48,52,56].map(o=>view.getFloat32(o,true)),[.25,-.125,-.5,.75]);
});
test('invalid documents and canonical note adaptation fail before PCM work',async()=>{
 const malformed=fixture();malformed.tempo=NaN;const r=rig();await assert.rejects(render(malformed,{},r.deps),/range/);assert.equal(r.calls.length,0);
 const invalid=fixture();invalid.layers[0].patch.chords=[24];invalid.layers[0].patch.osc1.tune=24;invalid.layers[0].notes[0].pitch=84;await assert.rejects(render(invalid,{},r.deps),/frequency/);assert.equal(r.calls.length,0);assert.equal(r.contexts.length,0);
});
