import React from 'react';
import type {DesktopSoundTarget} from './studio-desktop-target';
import {EVENT_LABELS} from './studio-data';

export function DesktopSoundControls({target}:{target:DesktopSoundTarget}) {
 const state=React.useSyncExternalStore(target.subscribe,target.getSnapshot,target.getSnapshot),ready=state.enabled&&state.audio.contextState==='running';
 const status=state.error|| (state.pending?'Enabling desktop audio…':state.enabled?state.audio.muted?'Desktop sounds muted':ready?`Assignments active${state.lastEvent?` · ${EVENT_LABELS[state.lastEvent]}`:''}`:'Audio paused · enable again':'Enable to use these six sounds across Hermes.');
 return <section className="ss-desktop-target" data-desktop-sound-controls="" aria-label="Event assignment target">
  <span className="ss-target-caption">TARGET</span><strong>{state.enabled?'Hermes Desktop':'Local preview'}</strong>
  <div className="ss-target-actions">{!ready&&!state.pending&&<button type="button" onClick={()=>void target.enable()}>Enable desktop sounds</button>}
   {state.enabled&&ready&&<button type="button" aria-pressed={state.audio.muted} onClick={()=>target.setMuted(!state.audio.muted)}>{state.audio.muted?'Unmute desktop':'Mute desktop'}</button>}
   {(state.enabled||state.pending)&&<button type="button" onClick={()=>target.disable()}>{state.pending?'Cancel enabling':'Disable'}</button>}</div>
  <small role="status">{status}</small>
 </section>;
}
