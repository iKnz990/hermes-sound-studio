import type {Composition,ComposeNote} from './compose-model';

/** Session/view policy only. Never adds fields to Composition/v1. */
export function notesAtBeat(notes:readonly ComposeNote[],beat:number,pitch:number,selected:string|null):ComposeNote[]{
 return notes.filter(n=>n.pitch===pitch&&n.beat<=beat&&beat<n.beat+n.duration).sort((a,b)=>Number(b.id===selected)-Number(a.id===selected)||b.beat-a.beat||(a.id<b.id?-1:a.id>b.id?1:0));
}
/** Cells use interval intersection, so valid imported fractional onsets remain reachable. */
export function notesInCell(notes:readonly ComposeNote[],beat:number,pitch:number,selected:string|null):ComposeNote[]{
 return notes.filter(n=>n.pitch===pitch&&n.beat<beat+.5&&n.beat+n.duration>beat).sort((a,b)=>Number(b.id===selected)-Number(a.id===selected)||b.beat-a.beat||(a.id<b.id?-1:a.id>b.id?1:0));
}
export type GridAction={kind:'select'|'delete';id:string}|{kind:'create'|'none'};
export function gridAction(notes:readonly ComposeNote[],selected:string|null,beat:number,pitch:number,remove:boolean):GridAction{
 const hit=notesInCell(notes,beat,pitch,selected)[0];
 if(!hit)return {kind:remove?'none':'create'};
 return {kind:remove||hit.id===selected&&hit.beat>=beat&&hit.beat<beat+.5?'delete':'select',id:hit.id};
}
/** Null means the onset is outside the visible loop; stored notes are not changed. */
export function visibleDuration(beat:number,loop:number,requested:number):number|null{
 const limit=Math.min(4,loop-beat,16-beat);
 if(limit<.25)return null;
 return Math.max(.25,Math.min(Math.floor(limit*4)/4,Math.round(requested*4)/4));
}
export function cellCoverage(note:ComposeNote,beat:number,span=.5):{left:number;width:number;onset:boolean}|null{
 const start=Math.max(beat,note.beat),end=Math.min(beat+span,note.beat+note.duration);
 return end>start?{left:(start-beat)/span,width:(end-start)/span,onset:note.beat>=beat&&note.beat<beat+span}:null;
}
/** A fixed MIDI 28–84 projection; not dependent on note-array order. */
export const pitchTop=(pitch:number)=>6+(84-Math.max(28,Math.min(84,pitch)))/56*104;
const colors=['#79b8ff','#c4a3ff','#69d6b0','#ffc270','#f59bb6','#83d8e8','#d2d879','#b5b9ff'];
export function layerColor(id:string):string{
 let hash=2166136261;for(let i=0;i<id.length;i++){hash^=id.charCodeAt(i);hash=Math.imul(hash,16777619);}return colors[(hash>>>0)%colors.length];
}
export const layerAudible=(layer:{id:string;muted:boolean},solo:ReadonlySet<string>)=>!layer.muted&&(solo.size===0||solo.has(layer.id));
export function transposeRoot(c:Composition,root:number):Composition{
 const delta=root-c.root;
 if(c.layers.some(l=>l.notes.some(n=>n.pitch+delta<28||n.pitch+delta>84)))throw new RangeError('Root transpose would move a pitch outside MIDI 28–84. No notes changed.');
 return {...c,root,layers:c.layers.map(l=>({...l,notes:l.notes.map(n=>({...n,pitch:n.pitch+delta}))}))};
}
export const timingChanged=(before:Composition,after:Composition)=>before.id!==after.id||before.tempo!==after.tempo||before.meter!==after.meter||before.bars!==after.bars||before.loopStart!==after.loopStart||before.loopEnd!==after.loopEnd;
