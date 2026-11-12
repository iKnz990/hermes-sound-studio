import React,{useSyncExternalStore} from 'react';
import type {ComposeAudio} from './compose-audio';
import {LoopBrace} from './studio-feedback';

const usePosition=(audio:ComposeAudio)=>useSyncExternalStore(audio.subscribe,()=>audio.getSnapshot().positionBeat,()=>0);

/** Only these small views subscribe to the clock; notes and controls stay idle. */
export function ComposePlayhead({audio,total,grid=false}:{audio:ComposeAudio;total:number;grid?:boolean}){
 const position=usePosition(audio);
 return <i className={grid?'cp-grid-playhead':'cp-playhead'} aria-hidden="true" style={{left:grid?`calc(52px + (100% - 52px) * ${position/total})`:`${position/total*100}%`}}/>;
}
export function ComposePosition({audio}:{audio:ComposeAudio}){return <>{usePosition(audio).toFixed(1)} beats</>;}
export function ComposeLoopBrace({audio,...props}:Omit<React.ComponentProps<typeof LoopBrace>,'position'>&{audio:ComposeAudio}){
 return <LoopBrace {...props} position={usePosition(audio)}/>;
}
