import React,{useSyncExternalStore} from 'react';
import {host,ROUTES_AREA,SIDEBAR_NAV_AREA,STATUSBAR_AREAS} from '@hermes/plugin-sdk';
import {SoundWorkspace} from './compose-workspace';
import {installPluginStyles} from './plugin-styles';
import {createComposeStore,type ComposeStore} from './compose-store';
import {createStudioStore,type StudioStore} from './studio-store';
import {createStudioAudioBridge,studioAudioStatus,type StudioAudioBridge} from './studio-audio-bridge';
import {createDesktopSoundTarget,type DesktopSoundTarget} from './studio-desktop-target';
import {createBackgroundDrafts,type BackgroundDrafts,type BackgroundDraftHost} from './studio-background-draft';
import {createStudioAudioSession,type StudioAudioSession} from './studio-audio-session';
import type {StudioStorage} from './studio-repository';

const scopeAtoms=()=>[host.state.focusedSessionOwner,host.state.focusedSessionId,host.state.gateway,host.state.profile,host.state.connectionId,host.state.cwd].filter((atom):atom is NonNullable<typeof atom>=>!!atom);
function scope(){
 const profile=host.state.profile.get()||'default',connection=host.state.connectionId.get()??'local',session=host.state.focusedSessionId.get(),owner=host.state.focusedSessionOwner.get(),gateway=host.state.gateway.get(),cwd=host.state.cwd?.get?.()??'';
 return {profile,connection,key:JSON.stringify([profile,connection,session,owner,gateway,cwd])};
}
function useScopeKey(){return useSyncExternalStore(fn=>{const offs=scopeAtoms().map(atom=>atom.listen(fn));return()=>offs.forEach(off=>off());},()=>scope().key,()=>scope().key);}

function StatusChip({previewBridge,desktopTarget}:{previewBridge:StudioAudioBridge;desktopTarget:DesktopSoundTarget}){
 const preview=useSyncExternalStore(previewBridge.subscribe,previewBridge.getSnapshot,previewBridge.getSnapshot),desktop=useSyncExternalStore(desktopTarget.subscribe,desktopTarget.getSnapshot,desktopTarget.getSnapshot),scopeKey=useScopeKey();
 if(desktop.enabled||desktop.pending){
  const audio=desktop.audio,active=!audio.muted&&audio.activeVoices>0,status=desktop.error?'Error':desktop.pending?'Enabling':audio.muted?'Muted':audio.contextState==='running'?'On':'Paused';
  return <span data-sonic-chip="" data-desktop-sound-controls="" data-active={active} title="Hermes Desktop · Sound Design event assignments"><span className="sonic-chip-led" data-active={active} aria-hidden="true"/><span>Desktop sounds: {status}</span><button type="button" aria-label={audio.muted?'Unmute desktop sounds':'Mute desktop sounds'} disabled={audio.contextState!=='running'||desktop.pending} aria-pressed={audio.muted} onClick={()=>desktopTarget.setMuted(!audio.muted)}>{audio.muted?'⊘':'♪'}</button><button type="button" aria-label="Disable desktop sounds" onClick={()=>desktopTarget.disable()}>×</button></span>;
 }
 const audio=preview.scopeKey===scopeKey?preview.audio:null,active=!!audio?.enabled&&!audio.muted&&audio.activeVoices>0,status=active?'playing':studioAudioStatus(audio),disabled=!audio||audio.contextState!=='running'||!!audio.error;
 return <span data-sonic-chip="" data-active={active} title={`Local Sound Studio preview · ${status}`}><span className="sonic-chip-led" data-active={active} aria-hidden="true"/><span>Studio preview: {status}</span><button type="button" disabled={disabled} aria-label={audio?.muted?'Unmute Studio preview':'Mute Studio preview'} aria-pressed={audio?.muted??true} onClick={()=>{if(audio&&scope().key===scopeKey)previewBridge.setMuted(scopeKey,preview,!audio.muted);}}>{audio?.muted?'⊘':'♪'}</button></span>;
}

function SoundStudioRoute({store,composeStore,previewBridge,desktopTarget,backgroundDrafts,writeClipboard,audioSession}:{store:StudioStore;composeStore:ComposeStore;previewBridge:StudioAudioBridge;desktopTarget:DesktopSoundTarget;backgroundDrafts:BackgroundDrafts;writeClipboard:(text:string)=>Promise<boolean>;audioSession:StudioAudioSession}){
 const scopeKey=useScopeKey();
 return <SoundWorkspace key={scopeKey} scopeKey={scopeKey} store={store} composeStore={composeStore} previewBridge={previewBridge} desktopTarget={desktopTarget} backgroundDrafts={backgroundDrafts} writeClipboard={writeClipboard} audioSession={audioSession}/>;
}

export default {
 id:'hermes-sonic-ui',name:'Hermes Sound Studio',defaultEnabled:true,
 register(ctx:{register:(contribution:unknown)=>()=>void;onDispose:(fn:()=>void)=>void;onEvent:(name:string,fn:(event:unknown)=>void)=>()=>void;os:{writeClipboard:(text:string)=>Promise<boolean>};storage?:StudioStorage}){
  const removeStyles=installPluginStyles(),previewBridge=createStudioAudioBridge();
  const storage=ctx.storage?{get:<T,>(key:string,fallback:T)=>ctx.storage!.get('local:default:'+key,fallback),set:(key:string,value:unknown)=>ctx.storage!.set('local:default:'+key,value)}:undefined;
  const store=createStudioStore(storage),composeStore=createComposeStore(storage);
  const audioSession=createStudioAudioSession(store);
  const desktopTarget=createDesktopSoundTarget({store,document,readScope:()=>{const current=scope(),owner=host.state.focusedSessionOwner.get(),gateway=host.state.gateway.get();return {...current,session:owner?.profile===current.profile&&owner?.connectionId===current.connection?host.state.focusedSessionId.get():null,connected:gateway==='connected'||gateway==='open'};}});
  const readDraftScope=()=>({profile:host.state.profile.get()||'default',connection:host.state.connectionId.get()});
  const backgroundDrafts=createBackgroundDrafts({host:host as unknown as BackgroundDraftHost,readScope:readDraftScope});
  let previousDraftOwner=JSON.stringify(readDraftScope());
  let previous=scope().key;
  const syncScope=()=>{const next=scope().key;if(next!==previous){previous=next;const owner=JSON.stringify(readDraftScope());if(owner!==previousDraftOwner){previousDraftOwner=owner;backgroundDrafts.scopeChanged();}previewBridge.clear();audioSession.stop();desktopTarget.scopeChanged();}};
  const offAtoms=scopeAtoms().map(atom=>atom.listen(syncScope)),offEvents=ctx.onEvent('*',event=>desktopTarget.handleEvent(event));
  ctx.register({id:'sound-studio',area:ROUTES_AREA,data:{path:'/sonic-ui'},render:()=> <SoundStudioRoute store={store} composeStore={composeStore} previewBridge={previewBridge} desktopTarget={desktopTarget} backgroundDrafts={backgroundDrafts} writeClipboard={text=>ctx.os.writeClipboard(text)} audioSession={audioSession}/>});
  ctx.register({id:'navigation',area:SIDEBAR_NAV_AREA,data:{path:'/sonic-ui',label:'Sound Studio',codicon:'pulse'}});
  ctx.register({id:'audio-controls',area:STATUSBAR_AREAS.right,order:125,render:()=> <StatusChip previewBridge={previewBridge} desktopTarget={desktopTarget}/>});
  ctx.onDispose(()=>{removeStyles();previewBridge.clear();audioSession.dispose();desktopTarget.dispose();backgroundDrafts.dispose();offEvents();offAtoms.forEach(off=>off());});
 }
};
