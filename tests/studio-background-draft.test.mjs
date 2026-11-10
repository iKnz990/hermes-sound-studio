import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';
const built=await build({stdin:{contents:`export * from './desktop-src/studio-background-draft';export {createSoundPatch} from './assets/studio-engine';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const api=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].contents).toString('base64'));
const patch=api.createSoundPatch(),route={connectionId:'source-a',profile:'music',targetProfile:'remote-music',mode:'remote'};
const defer=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)};};
function fixture(){
 let time=0,scope={profile:'music',connection:'source-a'},releaseCount=0;
 const calls=[],host={profileRoutes:async()=>[route,{...route,connectionId:'source-b'}],retainProfile:async r=>{calls.push(['retain',r]);return()=>{releaseCount++;};},requestProfile:async(r,method,params)=>{calls.push([method,r,params]);if(method==='runtime.describe')return {session_create:{sources:['desktop'],parameters:['follow_profile_config','close_on_disconnect','idempotency_key']}};if(method==='session.create')return {session_id:'draft-runtime',stored_session_id:'stored-draft'};if(method==='prompt.submit')return {status:'streaming'};if(method==='session.events.since')return {latest_seq:2,events:[{session_id:'draft-runtime',type:'message.complete',payload:{status:'complete',text:JSON.stringify({...patch,name:'Generated tone'})}}]};if(method==='session.close')return {closed:true};throw Error(method);}};
 const control=api.createBackgroundDrafts({host,readScope:()=>scope,now:()=>time,wait:async ms=>{time+=ms;},timeoutMs:20,pollMs:5});
 return {control,host,calls,releases:()=>releaseCount,scope:value=>{scope={...scope,...value};}};
}
test('one pinned hidden conversation sends once, validates a patch, closes and releases without changing the source',async()=>{
 const f=fixture(),before=JSON.stringify(patch);await f.control.start('Warm chime','onCommit',patch);
 const result=f.control.getSnapshot();assert.equal(result.status,'ready');assert.equal(result.patch.name,'Generated tone');assert.equal(result.busy,false);assert.equal(JSON.stringify(patch),before);assert.equal(f.releases(),1);
 for(const call of f.calls)assert.equal(call[1].connectionId,'source-a');
 assert.equal(f.calls.filter(c=>c[0]==='session.create').length,1);const create=f.calls.find(c=>c[0]==='session.create')[2];assert.equal(create.hidden,true);assert.equal(create.profile,'remote-music');assert.equal(create.follow_profile_config,true);
 const submits=f.calls.filter(c=>c[0]==='prompt.submit');assert.equal(submits.length,1);assert.match(submits[0][2].text,/Warm chime/);assert.match(submits[0][2].text,/Exact JSON Schema/);assert.equal(submits[0][2].session_id,'draft-runtime');assert.equal(f.calls.at(-1)[0],'session.close');assert.equal(f.calls.at(-1)[2].session_id,'draft-runtime');
});
test('invalid input never dials and missing SDK support fails without a model request',async()=>{
 const f=fixture();for(const description of ['', 'x'.repeat(1501)])await assert.rejects(f.control.start(description,'onCommit',patch));assert.equal(f.calls.length,0);
 f.host.retainProfile=undefined;await assert.rejects(f.control.start('bell','onCommit',patch),/Update Hermes/);assert.equal(f.calls.length,0);
});
test('ambiguous route identity never creates a conversation',async()=>{
 const f=fixture();f.host.profileRoutes=async()=>[route,{...route}];await f.control.start('bell','onCommit',patch);assert.equal(f.control.getSnapshot().status,'error');assert.equal(f.calls.length,0);
});
test('socket stays retained while a draft is pending and duplicate activation cannot dispatch twice',async()=>{
 const f=fixture(),gate=defer(),original=f.host.requestProfile;f.host.requestProfile=async(...args)=>args[1]==='session.events.since'?gate.promise:original(...args);
 const pending=f.control.start('bell','onCommit',patch);await new Promise(r=>setTimeout(r,0));assert.equal(f.releases(),0);await assert.rejects(f.control.start('other','onCommit',patch),/already running/);
 gate.resolve({latest_seq:1,events:[{session_id:'draft-runtime',type:'message.complete',payload:{text:JSON.stringify(patch),status:'complete'}}]});await pending;assert.equal(f.releases(),1);assert.equal(f.calls.filter(c=>c[0]==='prompt.submit').length,1);
});
test('cancel during create closes the late-created exact runtime without submitting',async()=>{
 const f=fixture(),gate=defer(),original=f.host.requestProfile;f.host.requestProfile=async(...args)=>args[1]==='session.create'?gate.promise:original(...args);
 const pending=f.control.start('bell','onCommit',patch);await new Promise(r=>setTimeout(r,0));f.control.cancel();gate.resolve({session_id:'late-runtime'});await pending;
 assert.equal(f.control.getSnapshot().status,'cancelled');assert.equal(f.calls.filter(c=>c[0]==='prompt.submit').length,0);assert.equal(f.calls.at(-1)[2].session_id,'late-runtime');assert.equal(f.releases(),1);
});
test('owner changes cancel on the original route and cannot publish an old result',async()=>{
 const f=fixture(),gate=defer(),original=f.host.requestProfile;f.host.requestProfile=async(...args)=>args[1]==='session.events.since'?gate.promise:original(...args);
 const pending=f.control.start('bell','onCommit',patch);await new Promise(r=>setTimeout(r,0));f.scope({connection:'source-b'});f.control.scopeChanged();gate.resolve({events:[]});await pending;
 assert.equal(f.control.getSnapshot().status,'idle');assert.equal(f.control.getSnapshot().patch,null);assert.equal(f.calls.at(-1)[1].connectionId,'source-a');
});
test('malformed output is preserved for review and cannot become an assigned patch',async()=>{
 const f=fixture(),original=f.host.requestProfile;f.host.requestProfile=async(...args)=>args[1]==='session.events.since'?{events:[{session_id:'draft-runtime',type:'message.complete',payload:{status:'complete',text:'{"oops":1}'}}]}:original(...args);
 await f.control.start('bell','onCommit',patch);assert.equal(f.control.getSnapshot().status,'error');assert.equal(f.control.getSnapshot().raw,'{"oops":1}');assert.equal(f.control.getSnapshot().patch,null);
});
test('wrong-session completion is ignored and a timeout closes without resubmitting',async()=>{
 const f=fixture(),original=f.host.requestProfile;f.host.requestProfile=async(...args)=>args[1]==='session.events.since'?{events:[{session_id:'other-runtime',type:'message.complete',payload:{text:JSON.stringify(patch)}}]}:original(...args);
 await f.control.start('bell','onCommit',patch);assert.equal(f.control.getSnapshot().status,'error');assert.match(f.control.getSnapshot().error,/timed out/);assert.equal(f.calls.filter(c=>c[0]==='prompt.submit').length,1);assert.equal(f.releases(),1);
});
test('an interrupted turn cannot deliver even schema-valid JSON',async()=>{
 const f=fixture(),original=f.host.requestProfile;f.host.requestProfile=async(...args)=>args[1]==='session.events.since'?{events:[{session_id:'draft-runtime',type:'message.complete',payload:{status:'interrupted',text:JSON.stringify(patch)}}]}:original(...args);
 await f.control.start('bell','onCommit',patch);assert.equal(f.control.getSnapshot().status,'error');assert.equal(f.control.getSnapshot().patch,null);
});
test('empty completion reads only the owned transcript and fine tuning validates candidate edits',async()=>{
 const f=fixture(),original=f.host.requestProfile;f.host.requestProfile=async(...args)=>args[1]==='session.events.since'?{events:[{session_id:'draft-runtime',type:'message.complete',payload:{status:'complete',text:''}}]}:args[1]==='session.history'?{messages:[{role:'user',text:'ignored'},{role:'assistant',text:JSON.stringify(patch)}]}:original(...args);
 await f.control.start('bell','onCommit',patch);assert.equal(f.control.getSnapshot().status,'ready');f.control.setPatch({...patch,intensity:82});assert.equal(f.control.getSnapshot().patch.intensity,82);assert.throws(()=>f.control.setPatch({...patch,intensity:101}));assert.equal(f.control.getSnapshot().patch.intensity,82);f.control.dismiss();assert.equal(f.control.getSnapshot().status,'idle');
});
test('SDK-supported tool settings are requested without raw backend run limits',async()=>{
 const f=fixture(),original=f.host.requestProfile;f.host.requestProfile=async(...args)=>args[1]==='runtime.describe'?{session_create:{sources:['gui'],parameters:['toolsets','max_turns','run_budget','request_id']}}:original(...args);
 await f.control.start('bell','onCommit',patch);const body=f.calls.find(c=>c[0]==='session.create')[2];assert.deepEqual(body.toolsets,[]);assert.equal(body.source,'gui');assert.equal(body.max_turns,undefined);assert.equal(body.run_budget,undefined);assert.equal(body.follow_profile_config,undefined);
});
test('single JSON fences are accepted but commentary, oversized output and schema violations fail closed',()=>{
 assert.deepEqual(api.parseDraftReply('```json\n'+JSON.stringify(patch)+'\n```'),patch);for(const value of ['Here is JSON: '+JSON.stringify(patch),'x'.repeat(100001),'{}',null])assert.throws(()=>api.parseDraftReply(value));
});

test('canonical owner detaches its exact subscription after completion rather than using legacy close',async()=>{
 const f=fixture(),original=f.host.requestProfile;
 f.host.requestProfile=async(r,method,params)=>{
  if(method==='session.create'){f.calls.push([method,r,params]);return {session_id:'draft-runtime',subscription_id:'own-subscription',last_sequence:7,replay_epoch:'own-epoch'};}
  if(method==='prompt.submit'){f.calls.push([method,r,params]);return {status:'queued',admission_id:'own-admission'};}
  if(method==='session.detach'){f.calls.push([method,r,params]);return {detached:true};}
  return original(r,method,params);
 };
 await f.control.start('bell','onCommit',patch);assert.equal(f.control.getSnapshot().status,'ready');assert.equal(f.calls.at(-1)[0],'session.detach');assert.equal(f.calls.at(-1)[2].subscription_id,'own-subscription');assert.equal(f.calls.filter(c=>c[0]==='session.close').length,0);
 const replay=f.calls.find(c=>c[0]==='session.events.since')[2];assert.equal(replay.last_seen,7);assert.equal(replay.replay_epoch,'own-epoch');
});

test('canonical cancellation fences the owned admission and detaches its subscription',async()=>{
 const f=fixture(),gate=defer(),original=f.host.requestProfile;
 f.host.requestProfile=async(r,method,params)=>{
  if(method==='session.create')return {session_id:'draft-runtime',subscription_id:'own-subscription'};
  if(method==='prompt.submit')return {status:'started',admission_id:'own-admission'};
  if(method==='session.events.since')return gate.promise;
  if(method==='prompt.cancel'||method==='session.detach'){f.calls.push([method,r,params]);return {};}
  return original(r,method,params);
 };
 const pending=f.control.start('bell','onCommit',patch);await new Promise(r=>setTimeout(r,0));f.control.cancel();gate.resolve({events:[]});await pending;
 assert.equal(f.control.getSnapshot().status,'cancelled');assert.equal(f.calls.at(-2)[0],'prompt.cancel');assert.equal(f.calls.at(-2)[2].admission_id,'own-admission');assert.equal(f.calls.at(-1)[2].subscription_id,'own-subscription');
});

test('lost create reply recovers only its unique title for cleanup and never submits a prompt',async()=>{
 const f=fixture(),original=f.host.requestProfile;let title='';
 f.host.requestProfile=async(r,method,params)=>{
  f.calls.push(['observed:'+method,r,params]);
  if(method==='session.create'){title=params.title;throw Error('create reply timed out');}
  if(method==='session.list')return {sessions:[{title,session_id:'recovered-own-runtime'}]};
  if(method==='session.resume')return {session_id:'recovered-own-runtime',subscription_id:'recovered-own-subscription'};
  if(method==='session.detach')return {detached:true};
  return original(r,method,params);
 };
 await f.control.start('bell','onCommit',patch);assert.equal(f.control.getSnapshot().status,'error');assert.equal(f.calls.filter(c=>c[0]==='observed:session.create').length,1);assert.equal(f.calls.filter(c=>c[0]==='observed:prompt.submit').length,0);assert.equal(f.calls.at(-1)[0],'observed:session.detach');assert.equal(f.calls.at(-1)[2].session_id,'recovered-own-runtime');assert.equal(f.releases(),1);
});
