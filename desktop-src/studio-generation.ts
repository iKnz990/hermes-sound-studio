import {validateSoundPatch,type SoundPatch,type SoundEvent} from '../assets/studio-engine';
type Scope={key:string;sessionId:string;admitted:boolean};
type Bridge={rest:(path:string,options?:{method?:string;body?:unknown;timeoutMs?:number})=>Promise<unknown>;onEvent:(name:string,fn:(event:any)=>void)=>()=>void};
type Job={request_id:string;status:string;patch?:unknown};
/** Event-driven jobs: one POST, exact-ID reads; no polling loop or provider replay. */
export function createDraftRequester({ctx,readScope,rpc,timeoutMs=65_000}:{ctx:Bridge;readScope:()=>Scope;rpc?:(method:string,params:unknown)=>Promise<any>;timeoutMs?:number}){
 let closed=false,active:{cancel:(error:Error)=>void}|null=null;
 let unresolved:{body:any;key:string;fingerprint:string;nativeRpc:boolean}|null=null;
 const invalidate=()=>{active?.cancel(Error('Studio scope changed. No draft was applied.'));unresolved=null;};
 const requestDraft=(description:string,event:SoundEvent,currentPatch:SoundPatch):Promise<{requestId:string;patch:SoundPatch}>=>{
  const scope=readScope();
  if(closed||!scope.admitted||!scope.sessionId)return Promise.reject(Error('Generation requires a local default-profile session.'));
  if(active)return Promise.reject(Error('A sound draft is already pending.'));
  let patch:SoundPatch;try{patch=validateSoundPatch(currentPatch);}catch{return Promise.reject(Error('Current patch is invalid.'));}
  if(typeof description!=='string'||!description.trim()||[...description].length>1500)return Promise.reject(Error('Describe the sound in 1–1500 characters.'));
  const fingerprint=JSON.stringify({description:description.trim(),event,current_patch:patch});
  if(unresolved&&(unresolved.key!==scope.key||unresolved.fingerprint!==fingerprint))return Promise.reject(Error('Check the pending draft before requesting a different sound.'));
  return new Promise((resolve,reject)=>{
   let finished=false,timer:ReturnType<typeof setTimeout>|undefined,off=()=>{},reading=false;
   const cleanup=()=>{if(timer!==undefined)clearTimeout(timer);off();};
   const finish=(error?:Error,result?:{requestId:string;patch:SoundPatch})=>{if(finished)return;finished=true;cleanup();active=null;if(error)reject(error);else resolve(result!);};
   active={cancel:finish};
   const assertScope=()=>{if(closed||readScope().key!==scope.key||!readScope().admitted)throw Error('Studio scope changed. No draft was applied.');};
   const consume=(value:any)=>{
    assertScope();if(!unresolved||value?.request_id!==unresolved.body.request_id)throw Error('Mismatched sound draft response.');
    if(value.status==='completed'){const valid=validateSoundPatch(value.patch),id=value.request_id;unresolved=null;finish(undefined,{requestId:id,patch:valid});return true;}
    if(['failed','interrupted'].includes(value.status)){unresolved=null;throw Error('No usable draft was generated. Your current sound is unchanged.');}
    if(value.status!=='running')throw Error('Unknown generation status. No request was replayed.');
    return false;
   };
   const read=async(final=false)=>{
    if(finished||reading||!unresolved)return;reading=true;
    try{
     assertScope();const {body,nativeRpc}=unresolved;
     const result=nativeRpc?await rpc!('plugin.hermes-sonic-ui.studio_status',{request_id:body.request_id,session_id:body.session_id}):await ctx.rest(`/generation/${encodeURIComponent(body.request_id)}?session_id=${encodeURIComponent(body.session_id)}`,{timeoutMs:5000});
     if(finished)return;
     if(!consume(result)&&final)finish(Error('Draft is still pending. Press Generate again with the same description to check it; it will not be resubmitted.'));
    }catch(error){if(final||error instanceof Error&&/scope|draft|status|usable|invalid/i.test(error.message))finish(error instanceof Error?error:Error('Could not read sound draft. No request was replayed.'));}
    finally{reading=false;}
   };
   off=ctx.onEvent('plugin.hermes-sonic-ui.studio.draft-ready',(event:any)=>{
    const value=event?.payload??event;
    if(value?.request_id===unresolved?.body.request_id&&value?.session_id===scope.sessionId)void read();
   });
   void(async()=>{
    try{
     assertScope();
     if(unresolved){if(await read(true),finished)return;}
     else{
      let nativeRpc=false;
      if(rpc){try{const d=await rpc('runtime.describe',{});nativeRpc=Array.isArray(d?.capabilities)&&d.capabilities.includes('plugin-rpc-v1');}catch{/* read-only capability lookup; no inference dispatched */}}
      assertScope();
      const body={request_id:crypto.randomUUID(),session_id:scope.sessionId,description:description.trim(),event,current_patch:patch};
      unresolved={body,key:scope.key,fingerprint,nativeRpc};
      const result=nativeRpc?await rpc!('plugin.hermes-sonic-ui.studio_generate',body):await ctx.rest('/generation',{method:'POST',body,timeoutMs:8000});
      if(finished)return;if(consume(result))return;
     }
     timer=setTimeout(()=>{void read(true);},timeoutMs);
    }catch(error){finish(error instanceof Error?error:Error('Generation unavailable. Manual editing still works.'));}
   })();
  });
 };
 return {requestDraft,invalidate,dispose(){closed=true;invalidate();}};
}
