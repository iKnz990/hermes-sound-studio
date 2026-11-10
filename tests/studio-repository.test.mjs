import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import fs from 'node:fs';
const file='desktop-src/studio-repository.ts';
let api={};
if(fs.existsSync(file)){
 const r=await build({entryPoints:[file],bundle:true,write:false,format:'cjs',platform:'node'});
 const box={module:{exports:{}},exports:{},crypto:webcrypto,structuredClone,console};vm.runInNewContext(r.outputFiles[0].text,box);api=box.module.exports;
}
const base={name:'Test project',events:{onCommit:{name:'Bell',gain:.1},onHover:{name:'Hover',gain:.01}}};
const clone=x=>JSON.parse(JSON.stringify(x));
const validateTheme=x=>{assert.equal(typeof x?.name,'string');assert.equal(Object.keys(x.events).length,2);return clone(x)};
const validatePatch=x=>{assert.equal(typeof x?.name,'string');assert.ok(Number.isFinite(x.gain)&&x.gain>=0&&x.gain<=1);return clone(x)};
function storage(){const data=new Map();return {data,get:(k,d)=>data.has(k)?clone(data.get(k)):d,set:(k,v)=>data.set(k,clone(v))};}
function make(s){assert.equal(typeof api.createRepository,'function','durable repository is implemented');return api.createRepository(s,base,validateTheme,validatePatch,['onHover','onCommit']);}
test('an actual edit survives a new repository and never persists consent',()=>{
 const s=storage(),a=make(s);a.select('onCommit');a.setPatch({name:'Changed',gain:.23});const b=make(s);assert.equal(b.state.theme.events.onCommit.name,'Changed');assert.equal(b.state.theme.events.onCommit.gain,.23);assert.equal(b.state.selected,'onCommit');assert.ok(!JSON.stringify([...s.data.values()]).includes('muted'));assert.ok(!JSON.stringify([...s.data.values()]).includes('enabled'));
});
test('explicit project and preset save survives reload and can be loaded',()=>{
 const s=storage(),a=make(s);a.setPatch({name:'Saved bell',gain:.22});assert.equal(a.saveProject('Project A'),true);assert.equal(a.savePreset('Preset A'),true);const pid=a.state.projects[0].id,qid=a.state.presets[0].id;a.setPatch({name:'Unsaved edit',gain:.31});const b=make(s);assert.equal(b.state.theme.events.onCommit.name,'Unsaved edit');b.loadProject(pid);assert.equal(b.state.theme.events.onCommit.name,'Saved bell');b.loadPreset(qid);assert.equal(b.state.theme.events.onCommit.name,'Preset A');assert.equal(b.state.theme.events.onCommit.gain,.22);
});
test('undo redo crosses edits and palette changes; a new edit clears redo',()=>{
 const a=make(storage());a.setPatch({name:'First',gain:.2});a.setTheme({...base,name:'Second theme'});a.undo();assert.equal(a.state.theme.events.onCommit.name,'First');a.redo();assert.equal(a.state.theme.name,'Second theme');a.undo();a.setPatch({name:'Third',gain:.3});assert.equal(a.state.canRedo,false);
});
test('failed storage write stays visibly unsaved and preserves last durable edit',()=>{
 const s=storage(),a=make(s);a.setPatch({name:'Durable',gain:.2});const original=s.set;s.set=()=>{throw Error('quota')};a.setPatch({name:'Not durable',gain:.3});assert.equal(a.state.theme.events.onCommit.name,'Not durable');assert.ok(a.state.error);assert.equal(a.saveProject(),false);s.set=original;const b=make(s);assert.equal(b.state.theme.events.onCommit.name,'Durable');assert.equal(b.state.projects.length,0);
});
test('silent SDK write failure is detected by exact readback',()=>{
 const s=storage(),a=make(s);s.set=()=>{};a.setPatch({name:'Lost',gain:.2});assert.ok(a.state.error);assert.notEqual(a.state.status,'Saved');assert.equal(a.savePreset(),false);
});
test('corrupt primary recovers backup without destroying the bad primary',()=>{
 const s=storage(),a=make(s);a.setPatch({name:'Older',gain:.2});a.setPatch({name:'Newer',gain:.3});s.data.set(api.STUDIO_STORE_KEY,{bad:'preserve me'});const b=make(s);assert.equal(b.state.theme.events.onCommit.name,'Older');assert.ok(b.state.error);b.setPatch({name:'In memory',gain:.4});assert.equal(b.saveProject(),false);assert.deepEqual(s.data.get(api.STUDIO_STORE_KEY),{bad:'preserve me'});
});
test('SDK JSON parse fallback cannot silently erase a previously saved primary',()=>{
 const s=storage(),a=make(s);a.setPatch({name:'Older',gain:.2});a.setPatch({name:'Newer',gain:.3});
 const real=s.get;s.get=(key,fallback)=>key===api.STUDIO_STORE_KEY?fallback:real(key,fallback);
 const b=make(s);assert.equal(b.state.theme.events.onCommit.name,'Older');assert.ok(b.state.error);assert.equal(b.saveProject(),false);
 assert.equal(s.data.get(api.STUDIO_STORE_KEY).theme.events.onCommit.name,'Newer');
});
test('parallel stale view cannot overwrite a newer durable revision',()=>{
 const s=storage(),a=make(s),b=make(s);a.setPatch({name:'New revision',gain:.2});b.setPatch({name:'Stale write',gain:.3});assert.ok(b.state.error);assert.equal(make(s).state.theme.events.onCommit.name,'New revision');
});
test('malformed edits and nonexistent loads fail without changing current sound',()=>{
 const a=make(storage()),before=JSON.stringify(a.state.theme);assert.equal(a.setPatch({name:'Bad',gain:Infinity}),false);assert.equal(a.select('unknown'),false);assert.equal(a.loadProject('missing'),false);assert.equal(a.loadPreset('missing'),false);assert.equal(JSON.stringify(a.state.theme),before);
});
test('one pointer gesture across persisted edits is one undo step, keyboard edits remain separate',()=>{
 const a=make(storage());a.beginGesture();a.setPatch({name:'Bell',gain:.2});a.setPatch({name:'Bell',gain:.35});a.setPatch({name:'Bell',gain:.5});a.endGesture();assert.equal(a.state.theme.events.onCommit.gain,.5);a.undo();assert.equal(a.state.theme.events.onCommit.gain,.1);a.redo();assert.equal(a.state.theme.events.onCommit.gain,.5);a.setPatch({name:'Bell',gain:.6});a.setPatch({name:'Bell',gain:.7});a.undo();assert.equal(a.state.theme.events.onCommit.gain,.6);
});

test('state is immutable and unavailable storage never claims a save',()=>{
 const a=make(undefined);assert.throws(()=>{a.state.theme.name='illegal'});a.setPatch({name:'Memory-only',gain:.2});assert.equal(a.saveProject(),false);assert.ok(a.state.error);
});
