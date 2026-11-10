import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import fs from 'node:fs';
const built=await build({entryPoints:['desktop-src/studio-generation.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {createDraftRequester}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const patch=JSON.parse(fs.readFileSync('assets/studio-palettes.json'))[0].events.onCommit;
Error.stackTraceLimit=0;
const tick=()=>new Promise(r=>setTimeout(r,0));
test('late cancelled POST cannot unlock a different active generation',async()=>{
 let key='A';const posts=[],listeners=new Set();
 const ctx={onEvent:(_,fn)=>{listeners.add(fn);return()=>listeners.delete(fn);},rest:async(path,opt)=>{
  if(opt?.method==='POST')return new Promise(resolve=>posts.push({body:opt.body,resolve}));
  return {...posts.at(-1).body,status:'running'};
 }};
 const api=createDraftRequester({ctx,readScope:()=>({key,sessionId:'s',admitted:true}),timeoutMs:100});
 const first=api.requestDraft('soft','onCommit',patch);const cancelled=assert.rejects(first,/scope/);await tick();
 key='B';api.invalidate();await cancelled;
 const second=api.requestDraft('soft','onCommit',patch);await tick();
 posts[0].resolve({...posts[0].body,status:'completed',patch});await tick();
 await assert.rejects(api.requestDraft('soft','onCommit',patch),/already pending/);
 posts[1].resolve({...posts[1].body,status:'completed',patch});await second;
 assert.equal(posts.length,2);assert.equal(listeners.size,0);api.dispose();
});
test('ambiguous POST failure is recovered by exact-ID GET, never another provider submission',async()=>{
 const calls=[];let body;
 const ctx={onEvent:()=>()=>{},async rest(path,opt){calls.push({path,opt});if(opt?.method==='POST'){body=opt.body;throw Error('Transport timeout');}return {...body,status:'completed',patch};}};
 const api=createDraftRequester({ctx,readScope:()=>({key:'A',sessionId:'s',admitted:true}),timeoutMs:100});
 await assert.rejects(api.requestDraft('soft','onCommit',patch),/timeout/);
 await assert.rejects(api.requestDraft('different','onCommit',patch),/pending draft/);
 const result=await api.requestDraft('soft','onCommit',patch);
 assert.equal(result.requestId,body.request_id);assert.equal(calls.filter(x=>x.opt?.method==='POST').length,1);
 assert.ok(calls.at(-1).path.includes(body.request_id));api.dispose();
});
