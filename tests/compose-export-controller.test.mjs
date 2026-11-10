import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const r=await build({stdin:{contents:"export * from './desktop-src/compose-export-controller';export {createComposition} from './desktop-src/compose-model';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const api=await import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const result={wav:new Uint8Array([1,2,3]),duration:4.1,loopSeconds:4,sampleRate:48000,noteCount:6};
function rig(){
 const initial={composition:api.createComposition(),soloLayers:new Set(),scopeKey:'scope-a',owner:{}};
 let snapshot=initial;const states=[],downloads=[],jobs=[];
 const key=(c,solo)=>JSON.stringify([{...c,selectedLayer:undefined},[...solo].sort()]);
 const control=api.createCompositionWavExporter({read:()=>snapshot,key,render:(c,options)=>{const d=deferred();jobs.push({c,options,...d});return d.promise},download:(...args)=>downloads.push(args),onState:s=>states.push(s)});
 return {control,jobs,states,downloads,get snapshot(){return snapshot},set snapshot(value){snapshot=value}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('explicit export snapshots current composition and Solo, reports progress, downloads once',async()=>{
 const f=rig(),before=JSON.stringify(f.snapshot.composition);const p=f.control.start();assert.equal(f.jobs.length,1);assert.notEqual(f.jobs[0].c,f.snapshot.composition);assert.equal(f.states.at(-1).busy,true);f.jobs[0].options.onProgress(2,6);assert.equal(f.states.at(-1).completed,2);f.jobs[0].resolve(result);assert.equal(await p,true);assert.equal(f.downloads.length,1);assert.equal(f.states.at(-1).busy,false);assert.match(f.states.at(-1).message,/WAV/);assert.equal(JSON.stringify(f.snapshot.composition),before);
});
test('duplicate export clicks cannot allocate or download twice',async()=>{
 const f=rig(),p=f.control.start(),duplicate=f.control.start();assert.equal(f.jobs.length,1);assert.equal(await duplicate,false);f.jobs[0].resolve(result);assert.equal(await p,true);assert.equal(f.downloads.length,1);
});
for(const field of ['music','solo','scope','owner','document','name'])test(`changed ${field} fences late download and supports a deliberate retry`,async()=>{
 const f=rig(),p=f.control.start();assert.equal(f.jobs.length,1);
 if(field==='music')f.snapshot.composition.layers[0].gainDb=-18;
 if(field==='solo')f.snapshot.soloLayers=new Set([f.snapshot.composition.layers[0].id]);
 if(field==='scope')f.snapshot.scopeKey='scope-b';
 if(field==='owner')f.snapshot.owner={};
 if(field==='document')f.snapshot.composition.id='another-document';
 if(field==='name')f.snapshot.composition.name='renamed';
 f.control.checkCurrent();assert.equal(f.jobs[0].options.signal.aborted,true);f.jobs[0].resolve(result);assert.equal(await p,false);assert.equal(f.downloads.length,0);
 const retry=f.control.start();assert.equal(f.jobs.length,2);f.jobs[1].resolve(result);assert.equal(await retry,true);assert.equal(f.downloads.length,1);
});
test('view-only layer selection preserves a valid export',async()=>{const f=rig(),p=f.control.start();assert.equal(f.jobs.length,1);f.snapshot.composition.selectedLayer=f.snapshot.composition.layers[1].id;f.control.checkCurrent();assert.equal(f.jobs[0].options.signal.aborted,false);f.jobs[0].resolve(result);assert.equal(await p,true);});
test('cancelled old completion cannot clear or deliver a newer request',async()=>{
 const f=rig(),old=f.control.start();assert.equal(f.jobs.length,1);f.control.cancel();const next=f.control.start();assert.equal(f.jobs.length,2);f.jobs[0].options.onProgress(5,6);f.jobs[0].resolve(result);assert.equal(await old,false);assert.equal(f.states.at(-1).busy,true);assert.equal(f.downloads.length,0);f.jobs[1].resolve(result);assert.equal(await next,true);assert.equal(f.downloads.length,1);
});
test('dispose aborts pending work and suppresses future state updates and downloads',async()=>{
 const f=rig(),p=f.control.start();assert.equal(f.jobs.length,1);f.control.dispose();const count=f.states.length;assert.equal(f.jobs[0].options.signal.aborted,true);f.jobs[0].options.onProgress(5,6);f.jobs[0].resolve(result);assert.equal(await p,false);assert.equal(f.states.length,count);assert.equal(f.downloads.length,0);assert.equal(await f.control.start(),false);
});
test('render failure is explicit and retry remains usable',async()=>{const f=rig(),p=f.control.start();assert.equal(f.jobs.length,1);f.jobs[0].reject(Error('render unavailable'));assert.equal(await p,false);assert.match(f.states.at(-1).error,/render unavailable/);assert.equal(f.states.at(-1).busy,false);const retry=f.control.start();f.jobs[1].resolve(result);assert.equal(await retry,true);});
test('completion rechecks live identity even without a React effect or subscription callback',async()=>{const f=rig(),p=f.control.start();assert.equal(f.jobs.length,1);f.snapshot.composition.tempo=180;f.jobs[0].resolve(result);assert.equal(await p,false);assert.equal(f.downloads.length,0);});
test('filenames cannot become paths, Windows device names, or empty basenames',()=>{
 for(const name of ['../outside','CON','nul.wav','bad:name?','   ','track.']){const filename=api.compositionWavFilename(name);assert.match(filename,/\.wav$/);assert.doesNotMatch(filename,/[<>:"/\\|?*]|\.\./);assert.doesNotMatch(filename,/^(con|prn|aux|nul|com[1-9]|lpt[1-9])\.wav$/i);assert.ok(filename.length>4);}
 assert.equal(api.compositionWavFilename('My song.wav'),'My song.wav');
});
