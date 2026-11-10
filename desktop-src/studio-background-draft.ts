import {validateSoundPatch,type SoundPatch,type SoundEvent} from '../assets/studio-engine';
import {soundDraftPrompt} from './studio-draft-session';

export type DraftRoute={connectionId:string;profile:string;targetProfile:string;mode:'local'|'remote';primary?:true};
type Scope={profile:string;connection:string|null};
export type BackgroundDraftHost={
 profileRoutes:()=>Promise<DraftRoute[]>;
 retainProfile:(route:DraftRoute)=>Promise<()=>void>;
 requestProfile:(route:DraftRoute,method:string,params:Record<string,unknown>,timeoutMs?:number)=>Promise<any>;
};
export type BackgroundDraftSnapshot={status:'idle'|'running'|'ready'|'error'|'cancelling'|'cancelled';busy:boolean;stage:string;requestId:string;description:string;event:SoundEvent;source:string;patch:SoundPatch|null;raw:string;error:string};
export const EMPTY_BACKGROUND_DRAFT:BackgroundDraftSnapshot={status:'idle',busy:false,stage:'',requestId:'',description:'',event:'onCommit',source:'',patch:null,raw:'',error:''};
export function parseDraftReply(raw:unknown):SoundPatch {
 if(typeof raw!=='string'||raw.length>100000)throw Error('The draft response was empty or too large.');
 const text=raw.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i,'$1').trim();
 try{return validateSoundPatch(JSON.parse(text));}catch{throw Error('The model did not return a valid SoundPatch/v1. Your current sound was kept. Try a clearer description or review the returned JSON.');}
}

/** One isolated conversation per explicit request; never navigates or writes the composer. */
export function createBackgroundDrafts({host,readScope,timeoutMs=180000,pollMs=1500,now=()=>Date.now(),wait=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms))}:{host:BackgroundDraftHost;readScope:()=>Scope;timeoutMs?:number;pollMs?:number;now?:()=>number;wait?:(ms:number)=>Promise<void>}) {
 let snapshot:BackgroundDraftSnapshot=Object.freeze({...EMPTY_BACKGROUND_DRAFT}),disposed=false;
 const listeners=new Set<()=>void>();
 let active:{cancelled:boolean;owner:Scope}|null=null;
 const publish=(change:Partial<BackgroundDraftSnapshot>)=>{if(disposed)return;snapshot=Object.freeze({...snapshot,...change});listeners.forEach(fn=>fn());};
 const sameOwner=(owner:Scope)=>{const scope=readScope();return scope.profile===owner.profile&&scope.connection===owner.connection;};
 const start=async(description:string,event:SoundEvent,patch:SoundPatch)=>{
  if(disposed)throw Error('Sound Studio is closed.');
  if(active)throw Error('A sound draft is already running or finishing.');
  const prompt=soundDraftPrompt(description,event,patch),source=JSON.stringify(validateSoundPatch(patch));
  if(typeof host.profileRoutes!=='function'||typeof host.retainProfile!=='function'||typeof host.requestProfile!=='function')throw Error('Update Hermes Desktop to generate Sound Draft in the background. Manual JSON import still works.');
  const job=active={cancelled:false,owner:{...readScope()}},requestId=crypto.randomUUID();
  publish({...EMPTY_BACKGROUND_DRAFT,status:'running',busy:true,stage:'Connecting to your model…',requestId,description:description.trim(),event,source});
  let route:DraftRoute|undefined,release:(()=>void)|undefined,sessionId='',subscriptionId='',admissionId='',submitted=false,terminal=false,createAttempted=false;
  const title=`Sound Draft · ${description.trim().slice(0,44)} · ${requestId.slice(0,16)}`;
  const current=()=>{if(disposed||job.cancelled||!sameOwner(job.owner))throw Error('Draft cancelled. Your current sound was kept.');};
  const rpc=(method:string,params:Record<string,unknown>={},timeout=15000)=>host.requestProfile(route!,method,params,timeout);
  try{
   const routes=await host.profileRoutes();current();
   const candidates=routes.filter(r=>r.profile===job.owner.profile);
   const primary=candidates.filter(r=>r.primary===true);
   const matches=job.owner.connection?candidates.filter(r=>r.connectionId===job.owner.connection):primary.length?primary:candidates.length===1?candidates:[];
   if(matches.length!==1)throw Error('The active profile route is unavailable or ambiguous. Reconnect and try again.');
   route={...matches[0]};release=await host.retainProfile(route);current();
   const runtime=await rpc('runtime.describe');current();
   const descriptor=runtime?.session_create;
   if(!Array.isArray(descriptor?.sources)||!Array.isArray(descriptor.parameters))throw Error('This Hermes backend does not advertise background session support. Update Hermes; manual JSON import still works.');
   const sourceKind=['desktop','gui','tool'].find(s=>descriptor.sources.includes(s));
   if(!sourceKind)throw Error('This backend cannot create a Sound Draft conversation.');
   const supported=new Set<string>(descriptor.parameters);
   const parameters:Record<string,unknown>={profile:route.targetProfile,source:sourceKind,hidden:true,title};
   for(const [key,value] of Object.entries({follow_profile_config:true,request_id:requestId,idempotency_key:requestId,toolsets:[],close_on_disconnect:true}))if(supported.has(key))parameters[key]=value;
   createAttempted=true;
   const created=await rpc('session.create',parameters,90000);sessionId=typeof created?.session_id==='string'?created.session_id:'';subscriptionId=typeof created?.subscription_id==='string'?created.subscription_id:'';current();
   if(!sessionId)throw Error('Hermes did not return a draft session identity. No prompt was sent.');
   publish({stage:'Designing your sound…'});
   submitted=true;
   const admitted=await rpc('prompt.submit',{session_id:sessionId,text:prompt,submission_id:requestId},30000);admissionId=typeof admitted?.admission_id==='string'?admitted.admission_id:'';current();
   if(admitted?.voice_stopped||!['streaming','queued','started','accepted','completed','terminal'].includes(admitted?.status))throw Error('The model did not accept the sound request. No automatic retry was made.');
   let sequence=Number.isSafeInteger(created.last_sequence)?created.last_sequence:0;
   let replayEpoch=typeof created.replay_epoch==='string'?created.replay_epoch:undefined;
   const started=now();
   while(now()-started<timeoutMs){
    current();
    const replay=await rpc('session.events.since',{session_id:sessionId,last_seen:sequence,...(replayEpoch?{replay_epoch:replayEpoch}:{})});current();
    if(!Array.isArray(replay?.events))throw Error('Could not read the background draft. No request was replayed.');
    sequence=Number.isSafeInteger(replay.latest_seq)?Math.max(sequence,replay.latest_seq):sequence;
    if(typeof replay.replay_epoch==='string')replayEpoch=replay.replay_epoch;
    for(const frame of replay.events){
     if(frame.session_id!==sessionId)continue;
     if(admissionId&&frame.admission_id&&frame.admission_id!==admissionId)continue;
     const payload=frame.payload??{};
     if(frame.type==='approval.request'||frame.type==='clarify.request')throw Error('The model requested an interactive action. Try a more specific sound description; no action was approved.');
     if(frame.type!=='message.complete')continue;
     terminal=true;
     if(payload.status&&payload.status!=='complete')throw Error(typeof payload.error==='string'?payload.error.slice(0,300):'The sound draft was interrupted or failed. Your current sound was kept.');
     let raw=typeof payload.text==='string'?payload.text:typeof payload.rendered==='string'?payload.rendered:'';
     if(!raw.trim()){
      const history=await rpc(subscriptionId?'session.resume':'session.history',{session_id:sessionId});
      if(typeof history?.subscription_id==='string')subscriptionId=history.subscription_id;current();
      const last=Array.isArray(history?.messages)?[...history.messages].reverse().find(m=>m.role==='assistant'&&typeof (m.text??m.content)==='string'):null;
      raw=last?.text??last?.content??'';
     }
     publish({raw:raw.slice(0,100000)});
     const result=parseDraftReply(raw);current();publish({status:'ready',stage:'Ready to fine tune',patch:result});return;
    }
    if(replay.truncated||replay.snapshot_required)throw Error('The draft event history changed. Your current sound was kept; no request was replayed.');
    await wait(pollMs);
   }
   throw Error('The sound draft timed out. Its conversation was stopped; no automatic retry was made.');
  }catch(error){
   if(!disposed)publish({status:job.cancelled||!sameOwner(job.owner)?'cancelled':'error',stage:'',error:job.cancelled?'':error instanceof Error?error.message:'Could not generate the draft. Your sound was kept.'});
  }finally{
   // A lost create reply may still have minted a row. Resolve this request's
   // unique title without another create or prompt before releasing its lease.
   if(createAttempted&&!sessionId&&route)try{
    const found=await rpc('session.list',{title},10000);
    const matches=Array.isArray(found?.sessions)?found.sessions.filter((s:any)=>s.title===title&&typeof (s.session_id??s.id)==='string'):[];
    if(matches.length===1){
     const recovered=await rpc('session.resume',{session_id:matches[0].session_id??matches[0].id,omit_messages:true},30000);
     sessionId=typeof recovered?.session_id==='string'?recovered.session_id:'';subscriptionId=typeof recovered?.subscription_id==='string'?recovered.subscription_id:'';
    }
   }catch{publish({error:`${snapshot.error} Could not confirm cleanup of the draft conversation. No prompt was resubmitted.`.trim()});}
   // Close only the exact runtime this request minted, on its captured route.
   if(sessionId&&route)try{
    if(subscriptionId){
     if(submitted&&!terminal){
      if(admissionId)await rpc('prompt.cancel',{session_id:sessionId,admission_id:admissionId},5000);
      else{
       const state=await rpc('session.resume',{session_id:sessionId,omit_messages:true},5000);
       if(typeof state?.subscription_id==='string')subscriptionId=state.subscription_id;
       if(state.running&&Number.isSafeInteger(state.execution_generation))await rpc('session.interrupt',{session_id:sessionId,execution_generation:state.execution_generation},5000);
      }
     }
     await rpc('session.detach',{session_id:sessionId,subscription_id:subscriptionId,end_reason:terminal?'sound_draft_complete':'sound_draft_cancelled'},5000);
    }else await rpc('session.close',{session_id:sessionId},5000);
   }catch{if(snapshot.status!=='ready')publish({error:`${snapshot.error} The background conversation could not be confirmed stopped. No request was replayed.`.trim()});}
   release?.();if(active===job)active=null;publish(sameOwner(job.owner)?{busy:false}:{...EMPTY_BACKGROUND_DRAFT});
  }
 };
 return {
  subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};},getSnapshot:()=>snapshot,start,
  cancel(){if(active&&snapshot.status==='running'){active.cancelled=true;publish({status:'cancelling',stage:'Stopping draft…'});}},
  scopeChanged(){if(active&&!sameOwner(active.owner)){active.cancelled=true;publish({status:'cancelling',stage:'Stopping draft after profile change…'});}else if(!active)publish({...EMPTY_BACKGROUND_DRAFT});},
  setPatch(patch:SoundPatch){if(snapshot.status==='ready')publish({patch:validateSoundPatch(patch)});},
  dismiss(){if(!active||snapshot.status==='ready')publish({...EMPTY_BACKGROUND_DRAFT,busy:!!active});},
  dispose(){disposed=true;if(active)active.cancelled=true;listeners.clear();},
 };
}
export type BackgroundDrafts=ReturnType<typeof createBackgroundDrafts>;
