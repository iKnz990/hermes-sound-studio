import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,`evidence/full-plan-v1/audio-onset-repair/live-${Date.now()}-${process.pid}`);
await mkdir(out,{recursive:true});
const result=await build({stdin:{contents:`export * from './desktop-src/compose-audio';export * from './desktop-src/compose-model';export * from './desktop-src/compose-live-cache';`,resolveDir:root},bundle:true,write:false,platform:'node',format:'cjs'});
const file=path.join(out,'live-test.cjs');await writeFile(file,result.outputFiles[0].contents);const api=createRequire(import.meta.url)(file);
const clone=c=>structuredClone(c),flush=async()=>{for(let i=0;i<80;i++)await Promise.resolve();};
const pcm=(frames=48000,channels=2)=>({length:frames,numberOfChannels:channels,duration:frames/48000});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
function fixture(){const c=api.createComposition();for(const l of c.layers)l.notes=[0,1,3.75,4,6].map((beat,i)=>({...l.notes[0],id:`${l.id}-${i}`,beat,duration:.25}));return c;}
function rig(render=async()=>pcm()){
 let clock=10,serial=0,intervalStarts=0;const intervals=new Map(),timeouts=new Map(),sources=[],gains=[],renders=[];
 const ctx={state:'suspended',destination:{},get currentTime(){return clock},resume:async()=>{ctx.state='running'},close:async()=>{ctx.state='closed'},createGain(){const g={gain:{value:0,events:[],setValueAtTime(v,t){this.value=v;this.events.push([v,t])}},connect(to){g.to=to},disconnect(){}};gains.push(g);return g},createDynamicsCompressor:()=>({threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0},connect(){},disconnect(){}}),createBufferSource(){const s={buffer:null,at:null,stops:[],onended:null,connect(to){s.to=to},disconnect(){},start(t){assert.ok(t>=clock,`source start ${t} before ${clock}`);s.at=t},stop(t=clock){s.stops.push(t)}};sources.push(s);return s}};
 const audio=new api.ComposeAudio({createContext:()=>ctx,render:async(...args)=>{renders.push(args);return render(...args)},setInterval(fn){intervalStarts++;const id=++serial;intervals.set(id,fn);return id},clearInterval:id=>intervals.delete(id),setTimeout(fn,ms){const id=++serial;timeouts.set(id,{fn,at:clock+ms/1000});return id},clearTimeout:id=>timeouts.delete(id)});
 return {audio,ctx,sources,gains,renders,get intervalStarts(){return intervalStarts},get intervals(){return intervals.size},get now(){return clock},elapse(seconds){clock+=seconds},async advance(seconds){clock+=seconds;for(const [id,t]of [...timeouts])if(t.at<=clock){timeouts.delete(id);t.fn()}await flush();for(const fn of intervals.values())fn();await flush()},async boot(c=fixture()){audio.setComposition(c);assert.equal(await audio.enable(),true);assert.equal(await audio.play(),true);return c}};
}
function changed(c,pitch){const n=clone(c);n.layers[0].notes[0].pitch=pitch;return n;}
function scheduled(r){return r.sources.filter(s=>s.at!==null&&!s.stops.length);}
function noDuplicates(r){const identities=scheduled(r).map(s=>`${s.at}/${s.buffer.key}/${s.to.layerId??r.gains.indexOf(s.to)}`);assert.equal(new Set(identities).size,identities.length);}
test('live patch revision preserves epoch, ticker, accepted tails and commits on a safe bar boundary',async()=>{
 const r=rig(async p=>({...pcm(),key:p.baseFreq})),c=await r.boot(),first=r.sources[0],rev=r.audio.getSnapshot().appliedRevision;
 r.audio.setComposition(changed(c,50));assert.equal(r.audio.getSnapshot().playing,true);assert.equal(first.stops.length,0);assert.equal(r.audio.getSnapshot().updating,true);
 await r.advance(.12);const staged=r.audio.getSnapshot();assert.ok(staged.requestedRevision>rev);assert.equal(staged.appliedRevision,rev);assert.equal(staged.applyAtBeat,4);assert.equal(r.intervalStarts,1);
 await r.advance(1.78);const at=12.06;assert.ok(scheduled(r).filter(s=>s.at>=at).every(s=>s.at>=at));assert.equal(first.stops.length,0);
 await r.advance(.2);assert.equal(r.audio.getSnapshot().appliedRevision,staged.requestedRevision);assert.equal(r.audio.getSnapshot().updating,false);assert.ok(Math.abs(r.audio.getSnapshot().positionBeat-4.08)<.001);assert.equal(r.intervalStarts,1);noDuplicates(r);
});
test('100 rapid revisions coalesce to latest entire candidate with no intermediate render',async()=>{
 const r=rig(),c=await r.boot(),baseline=r.renders.length;for(let i=0;i<100;i++)r.audio.setComposition(changed(c,40+i%40));await r.advance(.119);assert.equal(r.renders.length,baseline);await r.advance(.0011);assert.equal(r.renders.length,baseline+1);assert.equal(r.renders.at(-1)[0].baseFreq,440*2**((59-69)/12));assert.equal(r.intervalStarts,1);
});
test('B ready then C failure discards B, retaining accepted A including future onsets',async()=>{
 let fail=false;const r=rig(async p=>{if(fail)throw Error('C refused');return {...pcm(),key:p.baseFreq}}),c=await r.boot(),rev=r.audio.getSnapshot().appliedRevision;
 r.audio.setComposition(changed(c,50));await r.advance(.12);assert.equal(r.audio.getSnapshot().applyAtBeat,4);await r.advance(1.9);const bQueued=scheduled(r).filter(s=>s.at>=12.06); // May include staged B lookahead.
 fail=true;r.audio.setComposition(changed(c,51));assert.equal(r.audio.getSnapshot().applyAtBeat,null);await r.advance(.12);assert.match(r.audio.getSnapshot().updateError,/C refused/);assert.equal(r.audio.getSnapshot().appliedRevision,rev);assert.equal(r.audio.getSnapshot().playing,true);assert.ok(bQueued.every(s=>s.stops.length||s.buffer.key!==440*2**((50-69)/12)));await r.advance(2);assert.equal(r.audio.getSnapshot().appliedRevision,rev);
});
test('deferred obsolete render cannot replace newest request and Stop after ready cannot cut over',async()=>{
 const gate=deferred();let hold=false;const r=rig(async()=>hold?gate.promise:pcm()),c=await r.boot();hold=true;r.audio.setComposition(changed(c,50));await r.advance(.12);r.audio.setComposition(changed(c,51));hold=false;gate.resolve(pcm());await r.advance(.12);assert.equal(r.audio.getSnapshot().applyAtBeat,4);const count=r.sources.length;r.audio.stop();await r.advance(4);assert.equal(r.sources.length,count);assert.equal(r.audio.getSnapshot().playing,false);assert.equal(r.audio.getSnapshot().applyAtBeat,null);assert.equal(r.intervals,0);
});
test('boundary is strictly beyond already scheduled horizon, even when render completes near bar edge',async()=>{
 const gate=deferred();let hold=false;const r=rig(async()=>hold?gate.promise:pcm()),c=await r.boot();hold=true;r.audio.setComposition(changed(c,50));await r.advance(.12);await r.advance(1.8);gate.resolve(pcm());await flush();assert.equal(r.audio.getSnapshot().applyAtBeat,8);assert.equal(r.intervalStarts,1);
});
test('cutover never replays a preceding onset and preserves sounding tails',async()=>{
 const r=rig(async p=>({...pcm(),key:p.baseFreq})),c=await r.boot(),old=r.sources[0];const next=changed(c,50);next.layers[0].notes=[{...next.layers[0].notes[0],beat:3.75}];r.audio.setComposition(next);await r.advance(.12);await r.advance(1.84);await r.advance(.15);assert.equal(old.stops.length,0);assert.equal(scheduled(r).filter(s=>s.buffer.key===440*2**((50-69)/12)).length,0);noDuplicates(r);
});
test('layer gain, metadata, root and selection updates render no PCM or restart clock',async()=>{
 const r=rig(),c=await r.boot(),count=r.renders.length,next=clone(c);next.layers[0].gainDb=-20;next.layers[0].name='renamed';next.layers[0].patch.name='renamed sound';next.root=60;next.selectedLayer=next.layers[1].id;r.audio.setComposition(next);assert.equal(r.sources[0].to.gain.value,10**(-20/20));assert.equal(r.renders.length,count);await r.advance(.12);assert.equal(r.renders.length,count);assert.equal(r.intervalStarts,1);assert.equal(r.audio.getSnapshot().playing,true);
});
test('layer mute/solo immediately silence buses and cancel queued sources without stopping others; clearing restores accepted future',async()=>{
 const r=rig(),c=await r.boot();await r.advance(.45);const future=scheduled(r).filter(s=>s.at>r.now),other=r.sources.find(s=>s.at===10.06&&s!==r.sources[0]);assert.ok(future.length);
 const next=clone(c);next.layers[0].muted=true;r.audio.setComposition(next);assert.equal(r.intervalStarts,1);assert.equal(other.stops.length,0);assert.ok(r.gains.some(g=>g.gain.value===0));assert.ok(future.some(s=>s.stops.length));const count=r.renders.length;r.audio.setSoloLayers(new Set([c.layers[0].id]));assert.equal(r.audio.getSnapshot().playing,true);r.audio.setSoloLayers(new Set());r.audio.setComposition(c);await r.advance(.01);assert.equal(r.renders.length,count);assert.equal(r.audio.getSnapshot().enabled,true);assert.equal(r.audio.getSnapshot().muted,false);assert.ok(scheduled(r).some(s=>s.at===10.56));noDuplicates(r);
 r.audio.mute();r.audio.setSoloLayers(new Set());r.audio.setComposition(c);assert.equal(r.audio.getSnapshot().muted,true);assert.equal(await r.audio.play(),false);
});
test('empty live content commits to a silent running clock; initial empty Play reports error',async()=>{
 const r=rig(),c=await r.boot(),next=clone(c);next.layers.forEach(l=>l.notes=[]);r.audio.setComposition(next);await r.advance(.12);await r.advance(2);assert.equal(r.audio.getSnapshot().playing,true);assert.equal(r.audio.getSnapshot().updating,false);assert.equal(r.intervalStarts,1);r.audio.stop();assert.equal(await r.audio.play(),false);assert.match(r.audio.getSnapshot().error,/notes/i);
});
test('only timing, document identity, explicit stop and suspension end a running clock',async()=>{
 for(const mutate of [c=>c.tempo=130,c=>c.meter=3,c=>c.bars=1,c=>c.id='other-document']){const r=rig(),c=await r.boot(),n=clone(c);mutate(n);r.audio.setComposition(n);assert.equal(r.audio.getSnapshot().playing,false);assert.equal(r.intervals,0)}
 const r=rig();await r.boot();r.ctx.state='suspended';r.ctx.onstatechange();assert.equal(r.audio.getSnapshot().playing,false);assert.equal(r.intervals,0);
});
test('stalled audio-clock ticks skip missed notes rather than scheduling catch-up or past starts',async()=>{
 const r=rig(),c=await r.boot();r.audio.setComposition(changed(c,50));await r.advance(.12);const before=r.sources.length;await r.advance(100);assert.ok(r.sources.length-before<=4);assert.ok(r.sources.slice(before).every(s=>s.at>=r.now));noDuplicates(r);
});
test('canonical cache reuses metadata/layer-gain/onset edits and revisited DSP, distinguishes seed and rate-independent actual bytes',async()=>{
 const r=rig(),c=await r.boot(),baseline=r.renders.length;let next=clone(c);next.layers[0].notes[0].beat=.5;r.audio.setComposition(next);await r.advance(.12);assert.equal(r.renders.length,baseline);await r.advance(2);next=changed(c,50);r.audio.setComposition(next);await r.advance(.12);assert.equal(r.renders.length,baseline+1);await r.advance(2);r.audio.setComposition(c);await r.advance(.12);assert.equal(r.renders.length,baseline+1);await r.advance(2);next=clone(c);next.layers[0].patch.seed++;r.audio.setComposition(next);await r.advance(.12);assert.equal(r.renders.length,baseline+2);assert.equal(r.audio.getCacheSnapshot().bytes,(baseline+2)*48000*2*4);
});
test('identical canonical patches across layers share resolved PCM and concurrent plays share in-flight work',async()=>{
 const gate=deferred(),r=rig(async()=>gate.promise),c=fixture();c.layers[1].patch=clone(c.layers[0].patch);c.layers[1].notes=c.layers[1].notes.map(n=>({...n,pitch:c.layers[0].notes[0].pitch,velocity:c.layers[0].notes[0].velocity}));r.audio.setComposition(c);await r.audio.enable();const a=r.audio.play();await flush();const b=r.audio.play();await flush();gate.resolve(pcm(200,1));await Promise.all([a,b]);assert.equal(r.renders.length,1);assert.equal(r.audio.getCacheSnapshot().bytes,800);assert.equal(r.intervals,1);
});
test('render allocation is serial, rejected entries retry and actual mono frame counts enforce aggregate budget',async()=>{
 let active=0,max=0,fail=true;const r=rig(async()=>{active++;max=Math.max(max,active);await Promise.resolve();active--;if(fail)throw Error('retry me');return pcm(13*1024*1024,1)}),c=fixture();r.audio.setComposition(c);await r.audio.enable();assert.equal(await r.audio.play(),false);fail=false;assert.equal(await r.audio.play(),false);assert.match(r.audio.getSnapshot().error,/96 MiB.*memory budget/);assert.equal(max,1);assert.equal(r.sources.length,0);assert.ok(r.audio.getCacheSnapshot().bytes<=96*1024*1024);assert.ok(r.renders.length>=3);
});
test('stale render after Stop/dispose cannot repopulate cache authority or schedule',async()=>{
 for(const action of ['stop','dispose']){const gate=deferred(),r=rig(async()=>gate.promise);r.audio.setComposition(fixture());await r.audio.enable();const p=r.audio.play();await flush();await r.audio[action]();gate.resolve(pcm());assert.equal(await p,false);await flush();assert.equal(r.audio.getCacheSnapshot().bytes,0);assert.equal(r.audio.getCacheSnapshot().pending,0);assert.equal(r.sources.length,0)}
});
test('delayed consent resume is lifetime and revision guarded; clearing solo cannot enable',async()=>{
 for(const action of ['mute','stop','revision']){const gate=deferred(),r=rig(),c=fixture();r.audio.setComposition(c);r.ctx.resume=async()=>{await gate.promise;r.ctx.state='running'};const p=r.audio.enable();if(action==='revision')r.audio.setComposition(changed(c,50));else r.audio[action]();r.audio.setSoloLayers(new Set());gate.resolve();assert.equal(await p,false);assert.equal(r.audio.getSnapshot().enabled,false);assert.equal(r.audio.getSnapshot().muted,true);assert.equal(await r.audio.play(),false)}
});

test('invalid adapted live DSP is a truthful non-destructive update error, not a synchronous setter failure',async()=>{
 const r=rig(),c=await r.boot(),old=r.sources[0],revision=r.audio.getSnapshot().appliedRevision,next=clone(c);
 next.layers[0].patch.chords=[24];next.layers[0].patch.osc1.tune=24;next.layers[0].notes[0].pitch=84;
 assert.doesNotThrow(()=>r.audio.setComposition(next));await r.advance(.12);assert.match(r.audio.getSnapshot().updateError,/frequency/);assert.equal(r.audio.getSnapshot().appliedRevision,revision);assert.equal(old.stops.length,0);assert.equal(r.audio.getSnapshot().playing,true);assert.equal(r.intervalStarts,1);
});
test('initial invalid adapted DSP fails Play visibly without creating partial sources',async()=>{
 const r=rig(),c=fixture();c.layers[0].patch.chords=[24];c.layers[0].patch.osc1.tune=24;c.layers[0].notes[0].pitch=84;
 assert.doesNotThrow(()=>r.audio.setComposition(c));await r.audio.enable();assert.equal(await r.audio.play(),false);assert.match(r.audio.getSnapshot().error,/frequency/);assert.equal(r.sources.length,0);assert.equal(r.intervals,0);
});
test('newer enable supersedes older resume error without revoking valid consent',async()=>{
 const r=rig(),first=deferred(),second=deferred();r.audio.setComposition(fixture());let n=0;r.ctx.resume=async()=>{await (++n===1?first.promise:second.promise);r.ctx.state='running'};
 const a=r.audio.enable(),b=r.audio.enable();second.resolve();assert.equal(await b,true);first.reject(Error('obsolete device error'));assert.equal(await a,false);assert.equal(r.audio.getSnapshot().enabled,true);assert.equal(r.audio.getSnapshot().muted,false);assert.equal(r.audio.getSnapshot().error,'');
});
test('whole-arrangement failure in a second dirty layer never schedules a partially successful first layer',async()=>{
 let fail=false;const r=rig(async p=>{if(fail&&p.seed===0x434f4d51)throw Error('second layer failed');return {...pcm(),key:p.baseFreq}}),c=await r.boot(),next=changed(c,50);next.layers[1].notes[0].pitch=60;fail=true;
 r.audio.setComposition(next);await r.advance(.12);assert.match(r.audio.getSnapshot().updateError,/second layer failed/);assert.equal(r.audio.getSnapshot().applyAtBeat,null);await r.advance(4);assert.equal(scheduled(r).filter(s=>s.buffer.key===440*2**((50-69)/12)).length,0);assert.equal(r.audio.getSnapshot().playing,true);
});
test('cache measures unique returned buffers, not duration, channels assumed stereo, or logical key count',async()=>{
 const buffer={...pcm(123,1),duration:9999},cache=new api.ComposePcmCache(async()=>buffer),p=fixture().layers[0].patch;
 const a=cache.acquire('a',p),b=cache.acquire('b',p);assert.equal(await a.ready,buffer);assert.equal(await b.ready,buffer);assert.equal(cache.snapshot().bytes,492);a.release();b.release();assert.equal(cache.snapshot().bytes,492);
});
test('cache LRU bounds unreferenced entries, preserves recent hits, and rerenders an evicted oldest key',async()=>{
 let count=0;const cache=new api.ComposePcmCache(async()=>{count++;return pcm(1,1)}),p=fixture().layers[0].patch;
 for(let i=0;i<130;i++){const lease=cache.acquire(String(i),p);await lease.ready;lease.release()}
 assert.equal(cache.snapshot().entries,128);assert.equal(cache.snapshot().bytes,512);let lease=cache.acquire('129',p);await lease.ready;lease.release();assert.equal(count,130);lease=cache.acquire('0',p);await lease.ready;lease.release();assert.equal(count,131);assert.equal(cache.snapshot().entries,128);
});
test('cache shares in-flight leases, cancels unowned queued jobs, and never resurrects a late canceled result',async()=>{
 let calls=0,active=0,max=0;const gate=deferred(),cache=new api.ComposePcmCache(async()=>{calls++;active++;max=Math.max(max,active);await gate.promise;active--;return pcm(100,1)}),p=fixture().layers[0].patch;
 const a=cache.acquire('a',p),a2=cache.acquire('a',p);await flush();assert.equal(calls,1);a.release();const b=cache.acquire('b',p);b.release();const settled=Promise.allSettled([a.ready,a2.ready,b.ready]);a2.release();gate.resolve();await settled;assert.equal(cache.snapshot().bytes,0);assert.equal(cache.snapshot().entries,0);assert.equal(calls,1);const retry=cache.acquire('a',p);await retry.ready;assert.equal(calls,2);assert.equal(max,1);retry.release();
});
test('source tail leases prevent eviction until ended, and rejected live candidates can retry',async()=>{
 const r=rig(async p=>({...pcm(10*1024*1024,1),key:p.baseFreq})),c=fixture();c.layers=c.layers.slice(0,1);c.layers[0].notes=c.layers[0].notes.filter(n=>n.beat===0||n.beat===4);await r.boot(c);
 const a=r.sources[0];let next=clone(c);next.layers[0].notes.forEach(n=>n.pitch=50);r.audio.setComposition(next);await r.advance(.12);await r.advance(1.9);await r.advance(.1);const rev=r.audio.getSnapshot().appliedRevision;
 const third=clone(c);third.layers[0].notes.forEach(n=>n.pitch=51);r.audio.setComposition(third);await r.advance(.12);assert.match(r.audio.getSnapshot().updateError,/memory budget/);assert.equal(r.audio.getSnapshot().appliedRevision,rev);assert.equal(r.audio.getCacheSnapshot().bytes,80*1024*1024);assert.equal(a.stops.length,0);
 a.onended();r.audio.setComposition(third);await r.advance(.12);assert.equal(r.audio.getSnapshot().updateError,'');assert.ok(r.audio.getSnapshot().applyAtBeat!==null);assert.ok(r.audio.getCacheSnapshot().bytes<=96*1024*1024);
});


test('exact cutover queues new bar onsets only, leaves pre-boundary sources sounding, and never replays earlier notes',async()=>{
 const r=rig(async p=>({...pcm(),key:p.seed})),c=fixture();c.layers=c.layers.slice(0,1);await r.boot(c);const next=clone(c);next.layers[0].patch.seed++;
 r.audio.setComposition(next);await r.advance(.12);assert.equal(r.audio.getSnapshot().applyAtBeat,4);await r.advance(1.8);
 const at=12.06,queued=scheduled(r).filter(s=>s.at>=at);assert.equal(queued.length,1);assert.equal(queued[0].at,at);assert.equal(queued[0].buffer.key,next.layers[0].patch.seed);assert.ok(scheduled(r).filter(s=>s.at<at).every(s=>s.buffer.key===c.layers[0].patch.seed));
 const before=scheduled(r).filter(s=>s.at<at);await r.advance(.2);assert.ok(before.every(s=>s.stops.length===0));assert.equal(r.intervalStarts,1);assert.equal(scheduled(r).filter(s=>s.buffer.key===next.layers[0].patch.seed&&s.at<at).length,0);noDuplicates(r);
});
test('superseding a prequeued B stops its exact future onset and C failure restores A at that same epoch/bar',async()=>{
 const c=fixture();c.layers=c.layers.slice(0,1);const seed=c.layers[0].patch.seed;
 const r=rig(async p=>{if(p.seed===seed+2)throw Error('latest C failed');return {...pcm(),key:p.seed}});await r.boot(c);
 const b=clone(c);b.layers[0].patch.seed++;r.audio.setComposition(b);await r.advance(.12);await r.advance(1.8);const sourceB=scheduled(r).find(s=>s.at===12.06);assert.ok(sourceB);assert.equal(sourceB.buffer.key,seed+1);
 const latest=clone(c);latest.layers[0].patch.seed+=2;const canceledAt=r.now;r.audio.setComposition(latest);assert.deepEqual(sourceB.stops,[canceledAt]);await r.advance(.12);assert.match(r.audio.getSnapshot().updateError,/latest C failed/);const atBar=scheduled(r).filter(s=>s.at===12.06);assert.equal(atBar.length,1);assert.equal(atBar[0].buffer.key,seed);assert.equal(r.audio.getSnapshot().appliedRevision,1);assert.equal(r.intervalStarts,1);noDuplicates(r);
});
test('initial deferred Play follows latest revision without partial starts, stale acceptance, or a second ticker',async()=>{
 const gate=deferred();let hold=true;const r=rig(async p=>{if(hold)await gate.promise;return {...pcm(),key:p.baseFreq}}),c=fixture();r.audio.setComposition(c);await r.audio.enable();const play=r.audio.play();await flush();assert.equal(r.sources.length,0);r.audio.setComposition(changed(c,50));hold=false;gate.resolve();assert.equal(await play,true);assert.equal(r.audio.getSnapshot().appliedRevision,r.audio.getSnapshot().requestedRevision);assert.equal(r.sources[0].buffer.key,440*2**((50-69)/12));assert.equal(r.intervalStarts,1);
});
test('mute and suspension cancel deferred live preparation; late completion never stages, enables or restarts',async()=>{
 for(const action of ['mute','suspend']){const gate=deferred();let hold=false;const r=rig(async()=>hold?gate.promise:pcm()),c=await r.boot();hold=true;r.audio.setComposition(changed(c,50));await r.advance(.12);const count=r.sources.length;if(action==='mute')r.audio.mute();else{r.ctx.state='suspended';r.ctx.onstatechange()};gate.resolve(pcm());await flush();r.audio.setSoloLayers(new Set());assert.equal(r.audio.getSnapshot().playing,false);assert.equal(r.audio.getSnapshot().applyAtBeat,null);assert.equal(r.sources.length,count);assert.equal(r.intervals,0);assert.equal(await r.audio.play(),false)}
});
test('solo while rendering cancels dirty preparation but restores accepted future without affecting the other layer clock',async()=>{
 const gate=deferred();let hold=false;const r=rig(async()=>hold?gate.promise:pcm()),c=await r.boot(),count=r.renders.length;
 hold=true;r.audio.setComposition(changed(c,50));await r.advance(.12);r.audio.setSoloLayers(new Set([c.layers[1].id]));r.audio.setComposition(c);hold=false;gate.resolve(pcm());await r.advance(.12);assert.equal(r.audio.getSnapshot().playing,true);r.audio.setSoloLayers(new Set());await r.advance(.12);assert.equal(r.renders.length,count+1);assert.equal(r.intervalStarts,1);assert.equal(r.audio.getSnapshot().updateError,'');noDuplicates(r);
});


test('moving a note across cutover schedules its new future onset even while its earlier accepted tail is sounding',async()=>{
 const c=fixture();c.layers=c.layers.slice(0,1);c.layers[0].notes=[c.layers[0].notes.find(n=>n.beat===3.75)];const r=rig(async p=>({...pcm(),key:p.seed}));await r.boot(c);const next=clone(c);next.layers[0].notes[0].beat=4;next.layers[0].patch.seed++;
 r.audio.setComposition(next);await r.advance(.12);await r.advance(1.8);const old=scheduled(r).find(s=>s.at===11.935),future=scheduled(r).find(s=>s.at===12.06);assert.ok(old);assert.ok(future,'a distinct future onset must not be suppressed by the old source tail');assert.equal(future.buffer.key,next.layers[0].patch.seed);assert.equal(old.stops.length,0);noDuplicates(r);
});

test('canonical patch gain reaches render unchanged; only layer gain belongs to the live bus',async()=>{
 for(const gainDb of [6,-12]){
  const c=fixture();c.layers=c.layers.slice(0,1);c.layers[0].patch.playback.gainDb=gainDb;c.layers[0].gainDb=-7;
  const r=rig(async p=>({...pcm(),key:p.playback.gainDb}));await r.boot(c);
  assert.deepEqual(r.renders[0],[api.adaptComposeNote(c.layers[0].patch,c.layers[0].notes[0],c.tempo).patch,{sampleRate:48000,masterGain:1}]);
  assert.equal(r.sources[0].buffer.key,gainDb);assert.equal(r.sources[0].to.gain.value,10**(-7/20));
  const next=clone(c);next.layers[0].gainDb=-19;const renders=r.renders.length,buffer=r.sources[0].buffer;r.audio.setComposition(next);
  assert.equal(r.sources[0].to.gain.value,10**(-19/20));assert.equal(r.sources[0].buffer,buffer);await r.advance(.12);assert.equal(r.renders.length,renders);assert.equal(r.intervalStarts,1);
 }
});
// Reproduce the native boundary with an independently advancing audio clock:
// queue genuine musical B, edit 10.7 ms before its bar, then withhold the ticker 35 ms.
async function queuedMusicalB(r){
 const c=await r.boot(),b=clone(c);b.layers[0].patch.seed++;
 r.audio.setComposition(b);await r.advance(.12);await r.advance(1.8);
 const at=12.06,betaBus=r.sources[1].to,beta=scheduled(r).find(s=>s.to===betaBus&&s.at===at),alpha=scheduled(r).find(s=>s.to!==betaBus&&s.at===at);
 assert.ok(beta);assert.ok(alpha);assert.notEqual(alpha.buffer.key,r.sources[0].buffer.key);r.elapse(at-r.now-.0107);
 return {c,b,at,beta,alpha,betaBus,revision:r.audio.getSnapshot().requestedRevision};
}
for(const edit of ['gain','mute','solo'])test(`late staged ${edit} retains exact unchanged Beta source across 35ms delayed ticker`,async()=>{
 const r=rig(async p=>({...pcm(),key:p.seed})),{b,at,beta,alpha,revision}=await queuedMusicalB(r),renders=r.renders.length;
 if(edit==='solo')r.audio.setSoloLayers(new Set([b.layers[1].id]));else{const next=clone(b);if(edit==='gain')next.layers[0].gainDb=-17;else next.layers[0].muted=true;r.audio.setComposition(next)}
 assert.equal(beta.stops.length,0,'already queued unchanged Beta must never be retracted');assert.equal(r.audio.getSnapshot().requestedRevision,revision,'mix authority is not a musical revision');
 if(edit==='gain')assert.equal(alpha.stops.length,0);else assert.deepEqual(alpha.stops,[r.now]);
 r.elapse(.035);await r.advance(0);assert.ok(r.now>at);assert.equal(scheduled(r).filter(s=>s.to===beta.to&&s.at===at).length,1);assert.ok(scheduled(r).includes(beta));assert.equal(r.renders.length,renders);assert.equal(r.audio.getSnapshot().appliedRevision,revision);assert.equal(r.intervalStarts,1);noDuplicates(r);
});
test('mix-only changes create no musical revision, render or candidate even after debounce',async()=>{
 const r=rig(),c=await r.boot(),revision=r.audio.getSnapshot().requestedRevision,renders=r.renders.length;
 const next=clone(c);next.layers[0].gainDb=-12;next.layers[0].muted=true;r.audio.setComposition(next);r.audio.setSoloLayers(new Set([c.layers[1].id]));await r.advance(.12);
 assert.equal(r.audio.getSnapshot().requestedRevision,revision);assert.equal(r.audio.getSnapshot().appliedRevision,revision);assert.equal(r.audio.getSnapshot().applyAtBeat,null);assert.equal(r.audio.getSnapshot().updating,false);assert.equal(r.renders.length,renders);
});
test('mix changes and explicit retry after a render error retain musical revision and accepted queued rows',async()=>{
 let fail=false;const r=rig(async p=>{if(fail)throw Error('try again');return {...pcm(),key:p.seed}}),c=await r.boot(),next=clone(c);next.layers[0].patch.seed+=10;fail=true;r.audio.setComposition(next);await r.advance(.12);assert.match(r.audio.getSnapshot().updateError,/try again/);
 const revision=r.audio.getSnapshot().requestedRevision;await r.advance(.33);const beta=scheduled(r).find(s=>s.to===r.sources[1].to&&s.at>r.now);assert.ok(beta);const mix=clone(next);mix.layers[0].gainDb=-12;r.audio.setComposition(mix);assert.equal(r.audio.getSnapshot().requestedRevision,revision);assert.equal(beta.stops.length,0);fail=false;await r.advance(.12);assert.ok(r.audio.getSnapshot().applyAtBeat!==null);assert.equal(r.audio.getSnapshot().requestedRevision,revision);assert.equal(r.audio.getSnapshot().updateError,'');noDuplicates(r);
});
for(const fail of [false,true])test(`late B->C musical supersession retains unchanged Beta and synchronously restores only accepted A; C ${fail?'fails':'succeeds'}`,async()=>{
 let failSeed;const r=rig(async p=>{if(p.seed===failSeed)throw Error('C rejected');return {...pcm(),key:p.seed}}),{c,b,at,beta,alpha}=await queuedMusicalB(r),latest=clone(b),tail=r.sources[0];latest.layers[0].patch.seed++;if(fail)failSeed=latest.layers[0].patch.seed;
 r.audio.setComposition(latest);assert.deepEqual(alpha.stops,[r.now]);assert.equal(beta.stops.length,0,'supersession must rebind unchanged source, not cancel/rebuild it');
 const restored=scheduled(r).filter(s=>s.to===alpha.to&&s.at===at);assert.equal(restored.length,1,'restore A synchronously before a delayed ticker can miss its onset');assert.equal(restored[0].buffer.key,c.layers[0].patch.seed);assert.equal(tail.stops.length,0);
 r.elapse(.035);await r.advance(.12);assert.ok(scheduled(r).includes(beta));assert.equal(beta.stops.length,0);assert.ok(scheduled(r).filter(s=>s.at===at&&s.to===alpha.to).every(s=>s.buffer.key!==b.layers[0].patch.seed));assert.equal(r.audio.getSnapshot().appliedRevision,1);
 if(fail){assert.match(r.audio.getSnapshot().updateError,/C rejected/);assert.equal(r.audio.getSnapshot().applyAtBeat,null)}else{assert.equal(r.audio.getSnapshot().applyAtBeat,8);await r.advance(1.75);await r.advance(.2);assert.equal(r.audio.getSnapshot().appliedRevision,r.audio.getSnapshot().requestedRevision)}
 assert.equal(tail.stops.length,0);assert.equal(r.intervalStarts,1);assert.ok(r.audio.getCacheSnapshot().bytes<=96*1024*1024);noDuplicates(r);
});
for(const kind of ['mute','solo'])test(`clearing ${kind} restores accepted queued futures synchronously even 1ms before onset`,async()=>{
 const r=rig(),c=await r.boot();await r.advance(.45);const alphaBus=r.sources[0].to,at=10.56;
 if(kind==='mute'){const muted=clone(c);muted.layers[0].muted=true;r.audio.setComposition(muted)}else r.audio.setSoloLayers(new Set([c.layers[1].id]));
 assert.equal(scheduled(r).filter(s=>s.at===at&&s.to===alphaBus).length,0);r.elapse(at-r.now-.001);
 if(kind==='mute')r.audio.setComposition(c);else r.audio.setSoloLayers(new Set());
 assert.equal(scheduled(r).filter(s=>s.at===at&&s.to===alphaBus).length,1,'no dependence on the next tick or MIN_LEAD');r.elapse(.035);await r.advance(0);noDuplicates(r);
});
test('clearing mute alongside a musical edit restores accepted future immediately while new PCM is pending',async()=>{
 const r=rig(),c=await r.boot();await r.advance(.45);const bus=r.sources[0].to,muted=clone(c);muted.layers[0].muted=true;r.audio.setComposition(muted);r.elapse(10.56-r.now-.0107);
 const latest=clone(c);latest.layers[0].patch.seed+=10;r.audio.setComposition(latest);assert.equal(scheduled(r).filter(s=>s.to===bus&&s.at===10.56).length,1,'unmute must restore valid A even when the same setter also requests B');r.elapse(.035);await r.advance(0);noDuplicates(r);
});
test('immediate restoration skips an onset if the native clock advances past it during source setup',async()=>{
 const r=rig(),c=await r.boot();await r.advance(.45);const muted=clone(c);muted.layers[0].muted=true;r.audio.setComposition(muted);r.elapse(10.56-r.now-.001);
 const create=r.ctx.createBufferSource;r.ctx.createBufferSource=()=>{const source=create();r.elapse(.02);return source};
 r.audio.setComposition(c);assert.equal(r.audio.getSnapshot().playing,true,'a missed just-in-time restoration is skipped, not sent as a past start that stops transport');assert.equal(scheduled(r).filter(s=>s.at===10.56&&s.to===r.sources[0].to).length,0);assert.equal(r.audio.getSnapshot().error,'');r.audio.stop();assert.equal(r.audio.getCacheSnapshot().referenced,0);
});
test('unmuting a never-prepared layer prepares current music without a revision or stale enable authority',async()=>{
 const gate=deferred();let hold=false;const r=rig(async p=>{if(hold)await gate.promise;return {...pcm(),key:p.seed}}),c=fixture();c.layers[1].muted=true;await r.boot(c);
 const revision=r.audio.getSnapshot().requestedRevision,renders=r.renders.length,next=clone(c);next.layers[1].muted=false;hold=true;r.audio.setComposition(next);assert.equal(r.audio.getSnapshot().updating,true);await r.advance(.12);assert.equal(r.renders.length,renders+1);assert.equal(r.audio.getSnapshot().requestedRevision,revision);assert.equal(r.audio.getSnapshot().appliedRevision,revision);
 r.audio.mute();gate.resolve();await flush();r.audio.setSoloLayers(new Set());r.audio.setComposition(next);await r.advance(3);assert.equal(r.audio.getSnapshot().playing,false);assert.equal(r.audio.getSnapshot().muted,true);assert.equal(r.audio.getSnapshot().applyAtBeat,null);assert.equal(await r.audio.play(),false);assert.equal(r.audio.getCacheSnapshot().referenced,0);
});
test('revealing an omitted layer supersedes incomplete staged music without losing accepted futures',async()=>{
 const r=rig(async p=>({...pcm(),key:p.seed})),c=fixture();c.layers[1].muted=true;await r.boot(c);const next=clone(c);next.layers[0].patch.seed+=10;r.audio.setComposition(next);await r.advance(.12);await r.advance(1.8);const at=12.06,queuedB=scheduled(r).find(s=>s.at===at),revision=r.audio.getSnapshot().requestedRevision;
 assert.equal(queuedB.buffer.key,next.layers[0].patch.seed);r.elapse(at-r.now-.0107);const audible=clone(next);audible.layers[1].muted=false;r.audio.setComposition(audible);
 assert.deepEqual(queuedB.stops,[r.now]);assert.equal(r.audio.getSnapshot().requestedRevision,revision);assert.equal(scheduled(r).find(s=>s.at===at).buffer.key,c.layers[0].patch.seed,'incomplete B is not fallback authority');await r.advance(.12);assert.equal(r.audio.getSnapshot().applyAtBeat,8);await r.advance(1.8);const future=scheduled(r).filter(s=>s.at===14.06);assert.equal(future.length,2);assert.ok(future.some(s=>s.buffer.key===audible.layers[1].patch.seed));assert.ok(future.some(s=>s.buffer.key===audible.layers[0].patch.seed));noDuplicates(r);
});
test('a layer revealed after it was skipped during another render is prepared under the same latest musical revision',async()=>{
 const gate=deferred();let heldSeed;const r=rig(async p=>{if(p.seed===heldSeed)await gate.promise;return {...pcm(),key:p.seed}}),c=fixture();c.layers[0].muted=true;await r.boot(c);
 const next=clone(c);next.layers[1].patch.seed+=10;heldSeed=next.layers[1].patch.seed;r.audio.setComposition(next);await r.advance(.12);const revision=r.audio.getSnapshot().requestedRevision,count=r.renders.length;
 const audible=clone(next);audible.layers[0].muted=false;r.audio.setComposition(audible);assert.equal(r.audio.getSnapshot().requestedRevision,revision);heldSeed=undefined;gate.resolve();await flush();
 assert.equal(r.renders.length,count+1,'the skipped Alpha must be filled, without rerendering or revoking pending Beta');assert.equal(r.audio.getSnapshot().applyAtBeat,4);await r.advance(1.8);assert.ok(scheduled(r).some(s=>s.at===12.06&&s.buffer.key===c.layers[0].patch.seed));assert.equal(r.intervalStarts,1);noDuplicates(r);
});
for(const action of ['stop','mute','scope','timing','suspend'])test(`hard ${action} retracts all queued rows and leases without restoration starts after a B->C rebind`,async()=>{
 const r=rig(async p=>({...pcm(),key:p.seed})),{b,beta}=await queuedMusicalB(r),next=clone(b);next.layers[0].patch.seed+=3;r.audio.setComposition(next);assert.equal(beta.stops.length,0);const count=r.sources.length;
 if(action==='scope')await r.audio.dispose();else if(action==='timing'){next.tempo=130;r.audio.setComposition(next)}else if(action==='suspend'){r.ctx.state='suspended';r.ctx.onstatechange()}else r.audio[action]();
 assert.equal(r.sources.length,count,'hard cancel must not refill A before stopping');assert.ok(r.sources.every(s=>s.stops.length));assert.equal(r.audio.getCacheSnapshot().referenced,0);await r.advance(3);assert.equal(r.sources.length,count);assert.equal(r.audio.getSnapshot().playing,false);assert.equal(r.intervals,0);
});
test('rebound native source leases retain exact PCM under 96MiB pressure and release once after hard Stop',async()=>{
 const bytes=32*1024*1024,r=rig(async p=>({...pcm(bytes/4,1),key:p.seed})),{c,b,beta}=await queuedMusicalB(r),latest=clone(b);latest.layers[0].patch.seed+=10;
 r.audio.setComposition(latest);await r.advance(.12);assert.equal(r.audio.getCacheSnapshot().bytes,3*bytes);assert.equal(beta.stops.length,0);await r.advance(1.78);await r.advance(.2);assert.equal(r.audio.getSnapshot().appliedRevision,r.audio.getSnapshot().requestedRevision);
 const d=clone(latest);d.layers[0].patch.seed++;r.audio.setComposition(d);await r.advance(.12);assert.match(r.audio.getSnapshot().updateError,/96 MiB/);assert.equal(beta.stops.length,0);assert.equal(r.audio.getCacheSnapshot().bytes,3*bytes);
 for(const s of r.sources.filter(s=>s.buffer.key===c.layers[0].patch.seed))s.onended();r.audio.setComposition(d);await r.advance(.12);assert.equal(r.audio.getSnapshot().updateError,'');assert.ok(r.audio.getSnapshot().applyAtBeat!==null);assert.equal(beta.stops.length,0);assert.ok(r.audio.getCacheSnapshot().bytes<=96*1024*1024);
 r.audio.stop();assert.equal(r.audio.getCacheSnapshot().referenced,0);for(const s of r.sources){s.onended();s.onended()}assert.equal(r.audio.getCacheSnapshot().referenced,0);
});
test('PCM identity includes patch playback gain but excludes independent layer balance',()=>{
 const c=fixture(),layer=c.layers[0],note=layer.notes[0],key=l=>api.composePcmKey(api.adaptComposeNote(l.patch,note,c.tempo).patch);
 const changedGain=clone(layer);changedGain.patch.playback.gainDb=6;assert.notEqual(key(changedGain),key(layer));
 const balance=clone(layer);balance.gainDb=-20;assert.equal(key(balance),key(layer));
});
test('patch gain revisions coalesce, keep accepted PCM through deferred latest work and adopt only at safe bar',async()=>{
 const gate=deferred();let hold=false;const r=rig(async p=>{if(hold)await gate.promise;return {...pcm(),key:p.playback.gainDb}}),c=fixture();c.layers=c.layers.slice(0,1);c.layers[0].patch.playback.gainDb=-12;c.layers[0].gainDb=-7;await r.boot(c);
 const first=r.sources[0],accepted=r.audio.getSnapshot().appliedRevision,baseline=r.renders.length;
 for(let i=0;i<100;i++){const next=clone(c);next.layers[0].patch.playback.gainDb=i%2?6:-6;r.audio.setComposition(next)}
 assert.equal(first.to.gain.value,10**(-7/20));assert.equal(first.stops.length,0);await r.advance(.119);assert.equal(r.renders.length,baseline);await r.advance(.0011);
 assert.equal(r.renders.length,baseline+1);assert.equal(r.renders.at(-1)[0].playback.gainDb,6);assert.equal(r.audio.getSnapshot().applyAtBeat,4);
 await r.advance(1.8);const queuedB=scheduled(r).find(s=>s.at===12.06);assert.equal(queuedB.buffer.key,6);
 hold=true;const latest=clone(c);latest.layers[0].patch.playback.gainDb=-6;r.audio.setComposition(latest);assert.deepEqual(queuedB.stops,[r.now]);await r.advance(.12);
 assert.equal(r.audio.getSnapshot().appliedRevision,accepted);assert.equal(r.audio.getSnapshot().applyAtBeat,null);assert.equal(r.audio.getSnapshot().playing,true);
 const restored=scheduled(r).find(s=>s.at===12.06);assert.equal(restored.buffer.key,-12);assert.equal(first.stops.length,0);assert.equal(first.to.gain.value,10**(-7/20));
 await r.advance(.2);assert.equal(r.audio.getSnapshot().appliedRevision,accepted);hold=false;gate.resolve();await flush();assert.equal(r.audio.getSnapshot().applyAtBeat,8);
 await r.advance(1.8);const queuedC=scheduled(r).find(s=>s.at===14.06);assert.equal(queuedC.buffer.key,-6);assert.ok(scheduled(r).filter(s=>s.at<14.06).every(s=>s.buffer.key===-12));
 await r.advance(.1);assert.equal(r.audio.getSnapshot().appliedRevision,r.audio.getSnapshot().requestedRevision);assert.ok(Math.abs(r.audio.getSnapshot().positionBeat-((r.now-10.06)/(60/c.tempo))%(c.meter*c.bars))<.001);assert.equal(first.stops.length,0);assert.equal(r.intervalStarts,1);noDuplicates(r);
 const revisit=clone(c);r.audio.setComposition(revisit);const before=r.renders.length;await r.advance(.12);assert.equal(r.renders.length,before,'accepted prior gain reuses canonical PCM');
});

