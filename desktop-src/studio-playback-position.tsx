import React from 'react';
import type {PcmAnalysis} from './studio-components';
import type {SoundEvent,SoundStudioEngine,StudioPlaybackPosition} from '../assets/studio-engine';
type PlaybackEngine=Pick<SoundStudioEngine,'getPlaybackPosition'|'getAnalysisIdentity'|'getRenderIdentity'|'subscribe'>;
/** Never attach an old audition to an edited patch, another event, or an untrusted/cloned analysis. */
export function matchPlaybackPosition(engine:Pick<PlaybackEngine,'getPlaybackPosition'|'getAnalysisIdentity'|'getRenderIdentity'>,event:SoundEvent,analysis:PcmAnalysis|null):StudioPlaybackPosition|null {
 if(!analysis)return null;
 const position=engine.getPlaybackPosition(),identity=engine.getAnalysisIdentity(analysis);
 return position&&identity&&position.event===event&&position.renderIdentity===identity&&engine.getRenderIdentity(event)===identity?position:null;
}
/** Mount beside analysis with its actual engine-returned analysis object and current selected event.
 * Scope change MUST dispose/stop the old engine (existing workspace ownership contract).
 * Only this component's visibility is React state. Clock ticks update local DOM, not the workspace.
 */
export function PlaybackPosition({engine,event,analysis}:{engine:PlaybackEngine;event:SoundEvent;analysis:PcmAnalysis|null}) {
 const [visible,setVisible]=React.useState(false),marker=React.useRef<HTMLSpanElement>(null),readout=React.useRef<HTMLOutputElement>(null);
 React.useEffect(()=>{
  let frame:number|null=null,disposed=false,wasVisible:boolean|null=null;
  const tick=()=>{
   frame=null;if(disposed)return;
   const position=matchPlaybackPosition(engine,event,analysis);
   if(wasVisible!==!!position){wasVisible=!!position;setVisible(wasVisible);}
   if(!position){if(marker.current)marker.current.style.left='0%';if(readout.current)readout.current.textContent=analysis?`0.00 / ${analysis.duration.toFixed(2)} s`:'— / — s';return;}
   const elapsed=Math.max(0,Math.min(position.renderedDuration,position.contextTime-position.startedAt));
   if(marker.current)marker.current.style.left=`${100*elapsed/position.renderedDuration}%`;
   if(readout.current)readout.current.textContent=`${elapsed.toFixed(2)} / ${position.renderedDuration.toFixed(2)} s`;
   frame=requestAnimationFrame(tick);
  };
  const refresh=()=>{if(frame===null&&!disposed)tick();};
  const off=engine.subscribe(refresh);refresh();
  return()=>{disposed=true;off();if(frame!==null)cancelAnimationFrame(frame);};
 },[engine,event,analysis]);
 const active=visible&&!!matchPlaybackPosition(engine,event,analysis);
 return <div className="ss-playback-position" data-active={active} aria-label="Audition playback timeline" title="Engine clock · rendered buffer including effect tails, not measured audible duration"><output ref={readout} aria-live="off">{analysis?`0.00 / ${analysis.duration.toFixed(2)} s`:'— / — s'}</output><div className="ss-playback-track" aria-hidden="true"><span ref={marker}/></div></div>;
}
