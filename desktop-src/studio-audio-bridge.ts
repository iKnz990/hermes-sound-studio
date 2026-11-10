import type { SoundStudioEngine, StudioSnapshot } from '../assets/studio-engine';

/** Context state is not equivalent to consent or mute; both surfaces share this label. */
export function studioAudioStatus(audio:StudioSnapshot|null|undefined):string {
  if(!audio)return 'off';
  if(audio.error)return 'error';
  if(audio.contextState==='uninitialized')return 'off';
  if(audio.contextState!=='running')return audio.contextState;
  if(audio.muted)return 'muted';
  return audio.enabled?'ready':'off';
}

/** Snapshot and mute-only authority for the currently mounted local preview. */
export type StudioAudioBridge = ReturnType<typeof createStudioAudioBridge>;
export function createStudioAudioBridge() {
  type Snapshot = { scopeKey:string|null; audio:ReturnType<SoundStudioEngine['getSnapshot']>|null };
  let snapshot:Snapshot=Object.freeze({scopeKey:null,audio:null});
  let current:SoundStudioEngine|null=null, scope:string|null=null, off:(()=>void)|null=null;
  let muteOwner:((value:boolean)=>void)|null=null;
  const listeners=new Set<()=>void>();
  const publish=()=>{
    snapshot=Object.freeze({scopeKey:scope,audio:current?.getSnapshot()??null});
    for(const listener of listeners)listener();
  };
  const clear=()=>{off?.();off=null;current?.stopAll();current=null;scope=null;muteOwner=null;publish();};
  return {
    subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);}},
    getSnapshot:()=>snapshot,
    isCurrent:(engine:SoundStudioEngine,scopeKey:string)=>current===engine&&scope===scopeKey,
    attach:(engine:SoundStudioEngine,scopeKey:string,onMute?:(value:boolean)=>void)=>{
      clear();current=engine;scope=scopeKey;muteOwner=onMute??null;off=engine.subscribe(publish);publish();
      return ()=>{if(current===engine&&scope===scopeKey)clear();};
    },
    clear,
    /** Never creates/resumes audio. Captured scope and snapshot must still own this mount. */
    setMuted:(scopeKey:string,expected:Snapshot,value:boolean):boolean=>{
      if(!current||scope!==scopeKey||snapshot!==expected)return false;
      const state=current.getSnapshot();
      if(state.contextState!=='running'||(!value&&!!state.error))return false;
      if(muteOwner)muteOwner(value);else current.setMuted(value);
      publish();return true;
    },
  };
}
