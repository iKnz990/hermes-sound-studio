import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform,build} from 'esbuild';
import {fileURLToPath} from 'node:url';

const source=(await readFile(new URL('../assets/studio-engine.ts',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
const stub=source.replace(/export async function renderSoundPatch\([\s\S]*?\n}\n\n\/\*\* Analysis/,`export async function renderSoundPatch(patch,options={}) { globalThis.__studioRenders.push({patch,options}); return new Promise((resolve,reject)=>globalThis.__studioPending.push({resolve,reject})); }\n\n/** Analysis`);
assert.notEqual(stub,source);
const compiled=await transform(stub,{loader:'ts',format:'esm'});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
const dataBuild=await build({entryPoints:[fileURLToPath(new URL('../desktop-src/studio-data.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false,loader:{'.json':'json'}});
const data=await import('data:text/javascript;base64,'+Buffer.from(dataBuild.outputFiles[0].contents).toString('base64'));
const event='onCommit';
const patch=api.createSoundPatch();
const theme=()=>api.validateSoundTheme({schemaVersion:'SoundTheme/v1',engineVersion:'sound-studio-dsp/v1',name:'Test',sampleRate:48000,masterGain:.7,events:Object.fromEntries(api.SOUND_EVENTS.map(e=>[e,patch]))});
const buffer=()=>({length:256,numberOfChannels:2,sampleRate:48000,getChannelData:()=>new Float32Array(256)});
class FakeSource {buffer=null;stopped=0;onended=null;connect(){}disconnect(){}start(){this.started=true;}stop(){this.stopped++;}}
class FakeContext {state='running';destination={};currentTime=1; sources=[];closed=0; constructor(){globalThis.__studioContexts.push(this);} createBufferSource(){let s=new FakeSource();this.sources.push(s);return s;} async resume(){this.state='running';} async close(){this.closed++;this.state='closed';}}
const setup=()=>{globalThis.__studioRenders=[];globalThis.__studioPending=[];globalThis.__studioContexts=[];globalThis.AudioContext=FakeContext;};
const settle=(i=0)=>{globalThis.__studioPending[i].resolve(buffer());};
const tick=()=>new Promise(r=>setTimeout(r,0));

test('playback position uses context time and exact analysis inputs; old endings cannot clear newer voice',async()=>{
 setup();const e=new api.SoundStudioEngine(theme());
 assert.equal(typeof e.getPlaybackPosition,'function');assert.equal(e.getPlaybackPosition(),null);
 const analysisPromise=e.getAnalysis(event);await tick();settle();const analysis=await analysisPromise;
 assert.equal(e.getAnalysisIdentity(analysis),e.getRenderIdentity(event));
 await e.enable();assert.equal(await e.trigger(event),true);
 const ctx=globalThis.__studioContexts[0],first=e.getPlaybackPosition(),oldEnd=ctx.sources[0].onended;
 assert.equal(first.startedAt,1);assert.equal(first.contextTime,1);assert.equal(first.event,event);assert.equal(first.renderIdentity,e.getAnalysisIdentity(analysis));assert.equal(first.renderedDuration,256/48000);
 const snapshot=e.getSnapshot();ctx.currentTime=1.001;assert.equal(e.getPlaybackPosition().contextTime,1.001);assert.strictEqual(e.getSnapshot(),snapshot);
 assert.equal(await e.trigger(event),true);const second=e.getPlaybackPosition();assert.ok(second.voiceId>first.voiceId);oldEnd();assert.equal(e.getPlaybackPosition().voiceId,second.voiceId);
 e.setEventPatch(event,{...patch,baseFreq:440});assert.notEqual(e.getRenderIdentity(event),second.renderIdentity);assert.equal(e.getAnalysisIdentity(analysis),first.renderIdentity);
 ctx.currentTime=2;assert.equal(e.getPlaybackPosition(),null);await e.dispose();
});

test('stop mute suspension and dispose clear latest metadata without resurrection',async()=>{
 for(const action of ['stop','mute','suspend','dispose']){
  setup();const e=new api.SoundStudioEngine(theme());await e.enable();const start=e.trigger(event);await tick();assert.equal(e.getPlaybackPosition?.()??null,null);settle();await start;
  assert.equal(typeof e.getPlaybackPosition,'function');assert.ok(e.getPlaybackPosition());const ctx=globalThis.__studioContexts[0],ended=ctx.sources[0].onended;
  if(action==='stop')e.stopAll();if(action==='mute')e.setMuted(true);if(action==='dispose')await e.dispose();if(action==='suspend'){ctx.state='suspended';ctx.onstatechange();ctx.state='running';ctx.onstatechange();}
  assert.equal(e.getPlaybackPosition(),null);ended();assert.equal(e.getPlaybackPosition(),null);await e.dispose();
 }
});

test('duration retains the old hold fraction across full UI range, including zero envelope',()=>{
  const p=api.createSoundPatch();
  const resized=data.setDuration(p,2.5);
  assert.equal(resized.duration,2.5);
  assert.ok(resized.duration-(resized.adsr.a+resized.adsr.d+resized.adsr.r)/1000>.25,'sustain hold must remain');
  assert.deepEqual(p.adsr,patch.adsr,'original unchanged');
  const zero={...p,adsr:{a:0,d:0,s:.6,r:0}};
  assert.deepEqual(data.setDuration(zero,.02).adsr,zero.adsr);
  assert.equal(data.setDuration(zero,.02).duration,.02);
  assert.throws(()=>data.setDuration(p,.019));
  assert.throws(()=>data.setDuration(p,2.501));
  const expanded=data.setAdsrStage(p,'r',800);
  assert.ok(expanded.duration>=.908);
  assert.equal(expanded.adsr.r,800);
  assert.equal(p.adsr.r,210);
  assert.throws(()=>data.setAdsrStage(p,'r',2100));
  assert.throws(()=>data.setAdsrStage(p,'alien',4));
});

test('pending waveform, analysis and playback coalesce per event and cache completion',async()=>{
  setup();const e=new api.SoundStudioEngine(theme());
  const first=e.getBuffer(event),analysis=e.getAnalysis(event),again=e.getBuffer(event);
  await tick();assert.equal(globalThis.__studioRenders.length,1);
  settle();const b=await first;assert.strictEqual(await again,b);
  assert.equal((await analysis).sampleRate,48000);
  assert.strictEqual(await e.getBuffer(event),b);
  assert.equal(globalThis.__studioRenders.length,1);
  await e.enable();const scheduled=e.trigger(event);assert.equal(await scheduled,true);
  assert.equal(globalThis.__studioRenders.length,1);
  assert.strictEqual(globalThis.__studioContexts[0].sources[0].buffer,b);
  await e.dispose();
});

test('selective edits keep unrelated cache and voices, stale pending playback never starts',async()=>{
  setup();const e=new api.SoundStudioEngine(theme());await e.enable();
  const old=e.trigger(event);await tick();assert.equal(globalThis.__studioRenders.length,1);
  const unrelated=e.getBuffer('onError');await tick();settle(1);const other=await unrelated;
  e.setEventPatch(event,{...patch,baseFreq:440});
  settle(0);assert.equal(await old,false);
  assert.equal(globalThis.__studioContexts[0].sources.length,0);
  assert.strictEqual(await e.getBuffer('onError'),other);
  const next=e.trigger(event);await tick();assert.equal(globalThis.__studioRenders.length,3);settle(2);assert.equal(await next,true);
  const active=globalThis.__studioContexts[0].sources[0];
  e.setTheme({...theme(),name:'Renamed',events:{...theme().events,onCommit:{...patch,baseFreq:440}}});
  assert.equal(active.stopped,0,'name-only edit does not stop playback');
  assert.equal(await e.trigger(event),true);assert.equal(globalThis.__studioRenders.length,3);
  e.setEventPatch(event,{...patch,baseFreq:500});
  assert.equal(active.stopped,0,'real edit lets already scheduled voice finish');
  await e.dispose();assert.ok(active.stopped);
});

test('snapshot is stable/frozen, enabled explicit, mute/dispose block late enable and pending playback',async()=>{
  setup();const e=new api.SoundStudioEngine(theme());
  assert.deepEqual([e.getSnapshot().enabled,e.getSnapshot().muted,e.getSnapshot().contextState,e.getSnapshot().energy],[false,true,'uninitialized',0]);
  assert.ok(Object.isFrozen(e.getSnapshot()));const initial=e.getSnapshot();let notices=0;const off=e.subscribe(()=>notices++);
  assert.strictEqual(e.getSnapshot(),initial);assert.equal(await e.trigger(event),false);assert.equal(globalThis.__studioContexts.length,0);
  await e.enable();assert.equal(e.getSnapshot().enabled,true);assert.equal(e.getSnapshot().muted,false);
  const pending=e.trigger(event);await tick();e.setMuted(true);settle();assert.equal(await pending,false);
  assert.equal(e.getSnapshot().activeVoices,0);assert.equal(e.getSnapshot().energy,0);
  assert.ok(notices>0);off();await e.dispose();assert.equal(e.getSnapshot().enabled,false);
  assert.equal(globalThis.__studioContexts[0].closed,1);
});

test('late enable canceled by mute cannot grant first consent; strict edits reject malformed input',async()=>{
 setup();globalThis.AudioContext=class extends FakeContext{constructor(){super();this.state='suspended';}};const e=new api.SoundStudioEngine(theme());
 let resume;FakeContext.prototype.resume=function(){return new Promise(resolve=>{resume=()=>{this.state='running';resolve();};});};
 try{
   const initial=globalThis.__studioContexts.length;
   const gate=e.enable();await tick();assert.equal(globalThis.__studioContexts.length,initial+1);
   e.setMuted(true);resume();await assert.rejects(gate,/cancelled/);
   e.setMuted(false);assert.equal(e.getSnapshot().enabled,false);
   assert.equal(await e.trigger(event),false);
   assert.throws(()=>e.setEventPatch(event,{...patch,alien:true}));
   assert.throws(()=>e.setTheme({...theme(),masterGain:99}));
   await e.dispose();
 }finally{FakeContext.prototype.resume=async function(){this.state='running';};}
});

test('master gain invalidates all slots and stopAll cancels pending playback',async()=>{
 setup();const e=new api.SoundStudioEngine(theme());await e.enable();
 const pending=e.trigger(event);await tick();e.stopAll();settle();assert.equal(await pending,false);
 const a=e.getBuffer(event),b=e.getBuffer('onHover');await tick();settle(1);await Promise.all([a,b]);
 e.setTheme({...theme(),masterGain:.8});
 const again=e.getBuffer('onHover');await tick();assert.equal(globalThis.__studioRenders.length,3);settle(2);await again;
 await e.dispose();
});

test('external context suspension updates snapshot and gates subsequent playback',async()=>{
 setup();const e=new api.SoundStudioEngine(theme());await e.enable();
 const ctx=globalThis.__studioContexts[0];ctx.state='suspended';ctx.onstatechange?.();
 assert.equal(e.getSnapshot().contextState,'suspended');
 assert.equal(e.getSnapshot().enabled,false);assert.equal(await e.trigger(event),false);
 assert.equal(globalThis.__studioRenders.length,0);await e.dispose();
});

test('failed analysis evicts its event for retry',async()=>{
 setup();const e=new api.SoundStudioEngine(theme());
 const pending=e.getAnalysis(event);await tick();globalThis.__studioPending[0].resolve({...buffer(),length:0});
 await assert.rejects(pending,/audio buffer/);
 const next=e.getBuffer(event);await tick();assert.equal(globalThis.__studioRenders.length,2);
 settle(1);await next;await e.dispose();
});

test('failed render evicts only failed event for retry',async()=>{
 setup();const e=new api.SoundStudioEngine(theme());
 const failed=e.getBuffer(event);await tick();globalThis.__studioPending[0].reject(Error('render failed'));
 await assert.rejects(failed,/render failed/);
 const retry=e.getBuffer(event);await tick();assert.equal(globalThis.__studioRenders.length,2);settle(1);await retry;await e.dispose();
});
