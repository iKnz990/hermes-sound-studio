import React,{useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {renderSoundPatch,type SoundPatch} from '../assets/studio-engine';
import {SoundStudioView} from './studio-ui';
import type {BackgroundDrafts} from './studio-background-draft';
import type {StudioStore} from './studio-store';
import type {StudioAudioBridge} from './studio-audio-bridge';
import type {StudioAudioSession} from './studio-audio-session';
import type {DesktopSoundTarget} from './studio-desktop-target';
import {ComposeSoundEditor} from './compose-sound-editor';
import {NumericControl,ParameterScope,DragValue,ParameterKnob} from './studio-components';
import {useInlineConfirmation} from './studio-confirmation';
import {notesInCell,gridAction,visibleDuration,cellCoverage,pitchTop,layerColor,layerAudible,transposeRoot,timingChanged} from './compose-view-model';
import {parsePitchName} from './studio-musical';
import {StudioTopbar} from './studio-topbar';
import {TrackMeter,LoopBrace} from './studio-feedback';
import {createLayer,duplicateLayer,MAX_COMPOSE_LAYERS,validateComposition,loopWindow,type Composition,type ComposeLayer,type ComposeNote} from './compose-model';
import {JsonFileImport} from './studio-json-picker';
import type {ComposeStore} from './compose-store';
import {ComposeAudio,adaptComposeNote} from './compose-audio';
import {renderCompositionWav,compositionExportKey} from './compose-export';
import {createCompositionWavExporter,EMPTY_COMPOSITION_EXPORT} from './compose-export-controller';

const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
export const composePitchName=(midi:number)=>`${names[midi%12]}${Math.floor(midi/12)-1}`;
/** Only new layers receive a disambiguated name; stored names are never rewritten. */
function newLayerName(layers:readonly ComposeLayer[],requested:string){
 const base=requested.slice(0,80);let candidate=base,index=2;
 while(layers.some(l=>l.name===candidate)){const suffix=` ${index++}`;candidate=base.slice(0,80-suffix.length)+suffix;}
 return candidate;
}
const beatsLabel=(value:number)=>`${Number(value.toFixed(2))} ${value===1?'beat':'beats'}`;
export type StudioTask='sound-design'|'compose';
type WorkspaceProps={store:StudioStore;composeStore:ComposeStore;writeClipboard:(text:string)=>Promise<boolean>;backgroundDrafts?:BackgroundDrafts;previewBridge?:StudioAudioBridge;scopeKey?:string;initialTask?:StudioTask;desktopTarget?:DesktopSoundTarget;audioSession?:StudioAudioSession};
/** Task changes never load a palette, mutate an event or implicitly create a saved composition. */
export function SoundWorkspace({store,composeStore,writeClipboard,backgroundDrafts,previewBridge,scopeKey,initialTask='sound-design',desktopTarget,audioSession}:WorkspaceProps){
 const [task,setTask]=useState(initialTask);
 const useSound=()=>{const patch=store.state.theme.events[store.state.selected];const layer=createLayer(patch,newLayerName(composeStore.state.composition.layers,patch.name));composeStore.update(c=>({...c,layers:[...c.layers,layer],selectedLayer:layer.id}));setTask('compose');};
 const taskNavigation=<><button type="button" aria-pressed={task==='sound-design'} onClick={()=>setTask('sound-design')}>Sound Design</button><button type="button" aria-pressed={task==='compose'} onClick={()=>setTask('compose')}>Compose</button></>;
 return <div className="sound-workspace"><div className="cp-task-body">{task==='sound-design'?<SoundStudioView previewEngine={audioSession?.studio} desktopTarget={desktopTarget} store={store} writeClipboard={writeClipboard} backgroundDrafts={backgroundDrafts} previewBridge={previewBridge} scopeKey={scopeKey} onUseInCompose={useSound} taskNavigation={taskNavigation}/>:<ComposeWorkspace audioInstance={audioSession?.compose} key={scopeKey} scopeKey={scopeKey} store={composeStore} eventStore={store} writeClipboard={writeClipboard} taskNavigation={taskNavigation}/>}</div></div>;
}

type GridDrag={pointer:number;beat:number;pitch:number;left:number;width:number;startX:number;duration:number;moved:boolean;store:ComposeStore;revision:number;document:string;layer:string;scope:string};
export function ComposeWorkspace({store,eventStore,writeClipboard,taskNavigation,scopeKey='compose',audioInstance}:{store:ComposeStore;eventStore:StudioStore;writeClipboard:(text:string)=>Promise<boolean>;taskNavigation?:React.ReactNode;scopeKey?:string;audioInstance?:ComposeAudio}){
 useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
 useSyncExternalStore(eventStore.subscribe,eventStore.getSnapshot,eventStore.getSnapshot);
 const state=store.state,c=state.composition,layer=c.layers.find(l=>l.id===c.selectedLayer)!;
 const [audio]=useState(()=>audioInstance??new ComposeAudio()),snapshot=useSyncExternalStore(audio.subscribe,audio.getSnapshot,audio.getSnapshot);
 const [gridOpen,setGridOpen]=useState(true),[fold,setFold]=useState(false),[scale,setScale]=useState<'minor'|'major'>('minor'),[helpOpen,setHelpOpen]=useState(false);
 const [statusHint,setStatusHint]=useState('Drag values vertically · double-click to type · edits are silent');
 useEffect(()=>{if(!helpOpen||typeof document==='undefined')return;const dismiss=(e:PointerEvent|KeyboardEvent)=>{if(e instanceof KeyboardEvent){if(e.key!=='Escape')return;setHelpOpen(false);document.querySelector<HTMLButtonElement>('[data-studio-help-toggle]')?.focus();}else if(!(e.target as HTMLElement).closest('.cp-help-pop,[data-studio-help-toggle]'))setHelpOpen(false);};document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',dismiss);return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',dismiss);};},[helpOpen]);
 const [notice,setNotice]=useState(''),[error,setError]=useState(''),[saveName,setSaveName]=useState(c.name),[drawer,setDrawer]=useState(false);
 const [noteId,setNoteId]=useState<string|null>(null),[noteDuration,setNoteDuration]=useState(1),[octave,setOctave]=useState(3),[preset,setPreset]=useState(''),[tailSeconds,setTailSeconds]=useState<Record<string,number>>({}),[showTails,setShowTails]=useState(false);
 const note=layer.notes.find(n=>n.id===noteId)??null,loopBeats=c.bars*c.meter,steps=loopBeats*2;
 const previousLayer=useRef(layer.id),editorOpener=useRef<HTMLButtonElement>(null);
 const [solo,setSolo]=useState<ReadonlySet<string>>(()=>new Set()),[preview,setPreview]=useState<ComposeNote|null>(null),[overlapCell,setOverlapCell]=useState<{beat:number;pitch:number}|null>(null);
 const drag=useRef<GridDrag|null>(null),suppressClick=useRef<{beat:number;pitch:number}|null>(null);
 const live=useRef({store,scope:scopeKey,document:c.id,layer:layer.id,note:noteId,solo,saveName,mounted:true});live.current={store,scope:scopeKey,document:c.id,layer:layer.id,note:noteId,solo,saveName,mounted:true};
 const [wavState,setWavState]=useState(EMPTY_COMPOSITION_EXPORT);
 const [wavExporter]=useState(()=>createCompositionWavExporter({
  read:()=>{const owner=live.current;if(!owner.mounted)throw new Error('Compose workspace closed.');return {composition:{...owner.store.state.composition,name:owner.saveName.trim()||owner.store.state.composition.name},soloLayers:owner.solo,scopeKey:owner.scope,owner:owner.store};},
  render:renderCompositionWav,key:compositionExportKey,onState:setWavState,
  download:(result,filename)=>{const url=URL.createObjectURL(new Blob([new Uint8Array(result.wav)],{type:'audio/wav'})),link=document.createElement('a');try{link.href=url;link.download=filename;document.body.appendChild(link);link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}},
 }));
 useEffect(()=>{wavExporter.checkCurrent();return store.subscribe(wavExporter.checkCurrent);},[store,wavExporter]);
 useEffect(()=>wavExporter.checkCurrent(),[wavExporter,c,solo,scopeKey,saveName]);
 useEffect(()=>()=>wavExporter.dispose(),[wavExporter]);
 const review=useInlineConfirmation(`${scopeKey}:${c.id}`);
 const cancelDrag=()=>{const d=drag.current;if(d)suppressClick.current={beat:d.beat,pitch:d.pitch};drag.current=null;setPreview(null);};
 const closeEditor=()=>{store.endGesture();setDrawer(false);editorOpener.current?.focus({preventScroll:true});};
 const arrangement=useRef<HTMLDivElement>(null),selectedLane=useRef<HTMLDivElement>(null),ruler=useRef<HTMLDivElement>(null),sessionContext=useRef<HTMLDivElement>(null),gridAnchor=useRef<HTMLElement>(null);
 // Navigation is view-only: reveal within the arrangement, never scrollIntoView's ancestor chain.
 const revealSelected=()=>{const container=arrangement.current,row=selectedLane.current;if(!container||!row)return;const bounds=container.getBoundingClientRect(),lane=row.getBoundingClientRect(),top=bounds.top+container.clientTop+(ruler.current?.getBoundingClientRect().height??0),bottom=bounds.top+container.clientTop+container.clientHeight;let delta=0;if(lane.top<top||lane.height>bottom-top)delta=lane.top-top;else if(lane.bottom>bottom)delta=lane.bottom-bottom;if(delta)container.scrollTo({top:Math.max(0,container.scrollTop+delta),left:container.scrollLeft,behavior:'auto'});};
 useEffect(()=>revealSelected(),[layer.id]);
 const jumpToGrid=()=>{setGridOpen(true);const target=gridAnchor.current,owner=target?.closest<HTMLElement>('.cp-task-body');if(!target||!owner)return;const context=sessionContext.current,offset=context&&getComputedStyle(context).position==='sticky'?context.getBoundingClientRect().height:0;owner.scrollTo({top:Math.max(0,owner.scrollTop+target.getBoundingClientRect().top-owner.getBoundingClientRect().top-owner.clientTop-offset-12),left:owner.scrollLeft,behavior:'auto'});target.focus({preventScroll:true});};
 const needsAudio=!snapshot.enabled||snapshot.muted||snapshot.contextState==='suspended'||snapshot.contextState==='closed',transportBusy=snapshot.pending||snapshot.playing;
 const readiness=!snapshot.enabled?'Audio off · Enable audio first':snapshot.muted?'Audio muted · Enable audio to unmute':needsAudio?'Audio paused · Enable audio again':snapshot.pending?'Audio ready · Preparing loop':snapshot.playing?'Audio ready · Loop playing':'Audio ready · Play loop to start';
 useEffect(()=>{audio.setSoloLayers(solo);},[audio,solo]);
 useEffect(()=>{setSolo(current=>{const next=new Set([...current].filter(id=>c.layers.some(l=>l.id===id)));return next.size===current.size?current:next;});},[c.layers]);
 useEffect(()=>{setSolo(new Set());cancelDrag();setNoteId(null);setOverlapCell(null);review.cancel();},[store,scopeKey,c.id]);
 useEffect(()=>{cancelDrag();store.endGesture();},[store,scopeKey,c.id,layer.id]);
 useEffect(()=>{live.current.mounted=true;audio.stop();return()=>{live.current.mounted=false;store.endGesture();drag.current=null;review.cancel();};},[store,scopeKey]);
 useEffect(()=>{audio.setComposition(c);},[audio,c]);
 useEffect(()=>()=>{audio.stop();if(!audioInstance)void audio.dispose();},[audio,audioInstance]);
 useEffect(()=>{if(previousLayer.current!==layer.id){if(!layer.notes.some(n=>n.id===noteId)){setNoteId(null);setOverlapCell(null);}previousLayer.current=layer.id;}const first=layer.notes[0];if(first)setOctave(Math.floor(first.pitch/12)-1);},[layer.id]);
 useEffect(()=>setSaveName(c.name),[c.id,c.name]);
 // Optional offline PCM analysis: representative buffer allowance, not measured audible duration.
 const analysisKey=JSON.stringify(c.layers.map(l=>({id:l.id,patch:l.patch})));
 useEffect(()=>{let live=true;setTailSeconds({});if(!showTails)return;const timer=setTimeout(()=>{void (async()=>{const result:Record<string,number>={};try{for(const l of c.layers){const representative={id:'analysis',beat:0,duration:1,pitch:57,velocity:1};const p=adaptComposeNote(l.patch,representative,120).patch;const pcm=await renderSoundPatch(p,{sampleRate:48000,masterGain:1});if(!live)return;result[l.id]=Math.max(0,pcm.duration-p.duration);}if(live)setTailSeconds(result);}catch(e){if(live)setError(`Buffer analysis unavailable: ${e instanceof Error?e.message:String(e)}`);}})();},160);return()=>{live=false;clearTimeout(timer);};},[analysisKey,showTails]);
 // Persistence success and edit acceptance differ: always propagate actual retained store state.
 const change=(make:(value:Composition)=>Composition)=>{try{const before=store.state.composition,next=validateComposition(make(structuredClone(before)));setError('');if(timingChanged(before,next))audio.stop();store.update(()=>next);audio.setComposition(store.state.composition);}catch(e){setError(e instanceof Error?e.message:String(e));}};
 const editLayer=(make:(value:ComposeLayer)=>ComposeLayer)=>change(value=>({...value,layers:value.layers.map(l=>l.id===value.selectedLayer?make(l):l)}));
 const edit=(make:(p:SoundPatch)=>SoundPatch)=>{try{editLayer(l=>({...l,patch:make(l.patch)}));}catch(e){setError(e instanceof Error?e.message:String(e));}};
 const add=(next:ComposeLayer)=>change(value=>({...value,layers:[...value.layers,{...next,name:newLayerName(value.layers,next.name)}],selectedLayer:next.id}));
 const undo=()=>{const before=store.state.composition;store.undo();if(timingChanged(before,store.state.composition))audio.stop();audio.setComposition(store.state.composition);};
 const removeNote=(id:string)=>{editLayer(l=>({...l,notes:l.notes.filter(n=>n.id!==id)}));if(noteId===id)setNoteId(null);};
 const createNote=(beat:number,pitch:number,duration:number)=>{const bounded=visibleDuration(beat,loopBeats,duration);if(bounded===null)return;const next:ComposeNote={id:crypto.randomUUID(),beat,duration:bounded,pitch,velocity:.8};editLayer(l=>({...l,notes:[...l.notes,next]}));if(store.state.composition.layers.find(l=>l.id===layer.id)?.notes.some(n=>n.id===next.id))setNoteId(next.id);};
 const activateCell=(beat:number,pitch:number,remove=false)=>{const current=store.state.composition.layers.find(l=>l.id===layer.id);if(!current)return;setOverlapCell({beat,pitch});const action=gridAction(current.notes,noteId,beat,pitch,remove);if(action.kind==='delete')removeNote(action.id);else if(action.kind==='select')setNoteId(action.id);else if(action.kind==='create')createNote(beat,pitch,noteDuration);};
 const ownsDrag=(d:GridDrag)=>live.current.mounted&&live.current.store===d.store&&live.current.scope===d.scope&&live.current.document===d.document&&live.current.layer===d.layer&&d.store.getSnapshot()===d.revision;
 const pointerDown=(e:React.PointerEvent<HTMLButtonElement>,beat:number,pitch:number)=>{suppressClick.current=null;if(e.button!==0||e.shiftKey||pitch<28||pitch>84||notesInCell(layer.notes,beat,pitch,noteId).length)return;const duration=visibleDuration(beat,loopBeats,noteDuration);if(duration===null)return;const box=e.currentTarget.getBoundingClientRect();drag.current={pointer:e.pointerId,beat,pitch,left:box.left,width:box.width,startX:e.clientX,duration,moved:false,store,revision:store.getSnapshot(),document:c.id,layer:layer.id,scope:scopeKey};e.currentTarget.setPointerCapture(e.pointerId);};
 const pointerMove=(e:React.PointerEvent<HTMLButtonElement>)=>{const d=drag.current;if(!d||e.pointerId!==d.pointer)return;if(!ownsDrag(d)){cancelDrag();return;}if(Math.abs(e.clientX-d.startX)<5&&!d.moved)return;d.moved=true;d.duration=visibleDuration(d.beat,loopBeats,Math.max(.25,(Math.floor((e.clientX-d.left)/d.width)+1)*.5))??.25;setPreview({id:'preview',beat:d.beat,pitch:d.pitch,duration:d.duration,velocity:.8});};
 const pointerUp=(e:React.PointerEvent<HTMLButtonElement>)=>{const d=drag.current;if(!d||e.pointerId!==d.pointer)return;const owns=ownsDrag(d);drag.current=null;setPreview(null);suppressClick.current={beat:d.beat,pitch:d.pitch};if(owns)createNote(d.beat,d.pitch,d.duration);try{e.currentTarget.releasePointerCapture(e.pointerId);}catch{/* Capture can already be lost. */}};
 const editNote=(make:(n:ComposeNote)=>ComposeNote)=>editLayer(l=>({...l,notes:l.notes.map(n=>n.id===noteId?make(n):n)}));
 const captureOwnership=()=>{const owner={store,scope:scopeKey,document:store.state.composition.id,selection:store.state.composition.selectedLayer,note:noteId,revision:store.getSnapshot()};return()=>live.current.mounted&&live.current.store===owner.store&&live.current.scope===owner.scope&&store.state.composition.id===owner.document&&store.state.composition.selectedLayer===owner.selection&&live.current.note===owner.note&&store.getSnapshot()===owner.revision;};
 const replaceDocument=async(id?:string)=>{const current=captureOwnership();let candidate:Composition|undefined;if(id){const saved=store.state.compositions.find(row=>row.id===id);if(!saved)return;try{candidate=validateComposition(saved.composition);}catch(e){setError(String(e));return;}}const message=id?`Open “${candidate!.name}” and replace the complete arrangement? Save or export first. Undo can restore this session; event sounds stay unchanged.`:'Create a new composition and replace the complete arrangement? Save or export first. Undo can restore this session; event sounds stay unchanged.';
  if(!await review.request(message,current)||!current())return;
  if(id){const saved=store.state.compositions.find(row=>row.id===id);if(!saved)return;try{validateComposition(saved.composition);}catch{return;}}
  if(!current())return;audio.stop();store.endGesture();cancelDrag();setSolo(new Set());audio.setSoloLayers(new Set());if(id)store.open(id);else store.newComposition();audio.setComposition(store.state.composition);setNoteId(null);setOverlapCell(null);
 };
 const exportJson=async()=>{try{const text=store.exportJson();if(await writeClipboard(text))setNotice('Composition JSON copied. Keep it outside this app if local saving is unavailable.');else throw Error('Clipboard unavailable. Use Download JSON.');}catch(e){setError(e instanceof Error?e.message:String(e));}};
 const download=()=>{const blob=new Blob([store.exportJson()],{type:'application/json'}),url=URL.createObjectURL(blob);try{const a=document.createElement('a');a.href=url;a.download='composition.json';a.click();}finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}};
  const importControl=<JsonFileImport<Composition> help="Composition/v1: replaces the complete arrangement, not event sounds. Detaches the previous named save." options={{
   snapshot:()=>({target:store,revision:store.getSnapshot(),scope:scopeKey,selection:JSON.stringify([store.state.composition.selectedLayer,live.current.note])}),inScope:()=>live.current.mounted&&live.current.store===store&&live.current.scope===scopeKey,validate:validateComposition,
   cancelConfirmation:review.cancel,
   confirm:(_incoming,isCurrent)=>{const owns=captureOwnership();return review.request('Import Composition/v1 and replace the complete arrangement: layers, sounds, notes, timing, loop and selection? Detaches the previous named save. Saved compositions and event sounds stay unchanged. Save or export first; Undo restores this session.',()=>owns()&&(isCurrent?.()??true));},
   apply:incoming=>{const valid=validateComposition(incoming);audio.stop();store.endGesture();cancelDrag();setSolo(new Set());audio.setSoloLayers(new Set());const saved=store.importComposition(valid);audio.setComposition(store.state.composition);setNoteId(null);setOverlapCell(null);return saved;},
   report:(message,failed)=>{setError(failed?message:'');setNotice(failed?'':message);},
  }}/>;
  const selectedTiming=note?{patch:{duration:Math.min(2.5,note.duration*60/c.tempo)},clamped:note.duration*60/c.tempo>2.5}:null;
 const unsavedComposition=state.dirty||saveName.trim()!==c.name;
 const saveStatus=state.error||state.blocked?'Edits not verified in local storage · export before closing':unsavedComposition?'Unsaved draft':state.activeId?'Named composition saved':'Unsaved draft';
 const overlaps=overlapCell?notesInCell(layer.notes,overlapCell.beat,overlapCell.pitch,null):[];
 const cycleOverlap=(delta:number)=>{if(!overlaps.length)return;const index=overlaps.findIndex(n=>n.id===noteId);setNoteId(overlaps[(index+delta+overlaps.length)%overlaps.length].id);};
 const retained=layer.notes.filter(n=>n.beat+n.duration>loopBeats),noteLimit=note?visibleDuration(note.beat,loopBeats,4):null,noteOut=!!note&&note.beat+note.duration>loopBeats;
 const window=loopWindow(c),scaleNotes=scale==='minor'?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11];
 const setLoop=(start:number,end:number)=>change(value=>({...value,loopStart:start,loopEnd:end}));
 const setTiming=(bars:number,meter:3|4)=>change(value=>{const {loopStart,loopEnd,...rest}=value;return {...rest,bars,meter};});
 const deleteLayer=(id:string)=>{if(c.layers.length<2)return;change(value=>{const layers=value.layers.filter(l=>l.id!==id);return {...value,layers,selectedLayer:value.selectedLayer===id?layers[0].id:value.selectedLayer};});};
 const mixLayer=(id:string,patch:Partial<ComposeLayer>)=>change(value=>({...value,layers:value.layers.map(l=>l.id===id?{...l,...patch}:l)}));
 const wavAction=<><button type="button" title="48 kHz stereo float WAV · active loop and effect tails · respects Mute and Solo" disabled={wavState.busy} onClick={()=>void wavExporter.start()}>{wavState.busy?'Exporting…':'↗ Export WAV'}</button>{wavState.busy&&<button onClick={()=>wavExporter.cancel()}>Cancel</button>}</>;
 return <ParameterScope identity={`${scopeKey}:${c.id}`}><div data-sound-studio="" data-compose="" onMouseOver={e=>{const target=(e.target as HTMLElement).closest<HTMLElement>('[title]');if(target?.title)setStatusHint(target.title);}} onFocusCapture={e=>{const target=(e.target as HTMLElement).closest<HTMLElement>('[title]');if(target?.title)setStatusHint(target.title);}}>
  <StudioTopbar taskNavigation={taskNavigation} documentName={<input className="ss-document-name" type="text" aria-label="Composition name" value={saveName} onChange={e=>setSaveName(e.target.value)}/>} saveStatus={`${saveStatus} · ${state.status}`} unsaved={unsavedComposition}
   saveAction={<button className="ss-primary" type="button" onClick={()=>store.save(saveName)}>Save composition</button>}
   documentActions={<><button type="button" onClick={()=>replaceDocument()}>New composition</button><button type="button" disabled={!state.canUndo} onClick={undo}>Undo</button><button type="button" onClick={()=>void exportJson()}>Copy JSON</button><button type="button" onClick={download}>Download JSON</button>{importControl}<h3>Saved compositions</h3>{state.compositions.length?state.compositions.map(row=><button key={row.id} type="button" onClick={()=>replaceDocument(row.id)}>{row.name}</button>):<small>No named compositions yet.</small>}<small>Recovery: {state.recovery}. Save creates a named composition.</small></>}/>
  {review.prompt}
  <div className="ss-shell">
   {(state.error||error||snapshot.error||snapshot.updateError||wavState.error)&&<div className="ss-alert" role="alert">{[state.error,error,snapshot.error,snapshot.updateError,wavState.error].filter(Boolean).join(' · ')}</div>}
   {wavState.message&&<div className="ss-notice" role="status">{wavState.message}</div>}
   <div ref={sessionContext} className="cp-session-context">
    <section className="cp-transport" aria-label="Composition transport"><div className="cp-actions">
     {needsAudio&&<button type="button" title="Enable local audio · silent until Play" disabled={snapshot.pending} onClick={()=>void audio.enable()}>Enable audio</button>}
     <button type="button" className="cp-play" aria-label="Play loop" title="Play loop" aria-pressed={snapshot.playing} disabled={needsAudio||transportBusy} onClick={()=>{audio.setComposition(store.state.composition);void audio.play();}}>▶</button>
     <button type="button" aria-label="Stop" title="Stop loop and reset playhead" disabled={!transportBusy} onClick={()=>audio.stop()}>■</button>
     <button type="button" aria-label="Mute audio" title="Mute local audio" disabled={snapshot.muted} onClick={()=>audio.mute()}>◖×</button>
     <span className="cp-ready-dot" data-playing={snapshot.playing} title={readiness}/>
    </div></section>
    <section className="cp-lcds" aria-label="Musical timing">
     <DragValue id="cp-tempo" label="Tempo" value={c.tempo} min={60} max={200} step={1} unit=" BPM" onGestureStart={()=>store.beginGesture()} onGestureEnd={()=>store.endGesture()} onChange={v=>change(value=>({...value,tempo:v}))}/>
     <DragValue id="cp-meter" label="Meter" value={c.meter} min={3} max={4} step={1} display={v=>`${v}/4`} onChange={v=>setTiming(c.bars,v as 3|4)}/>
     <DragValue id="cp-root" label="Root" value={c.root} min={36} max={72} step={1} display={composePitchName} parse={parsePitchName} onGestureStart={()=>store.beginGesture()} onGestureEnd={()=>store.endGesture()} onChange={v=>change(value=>transposeRoot(value,v))}/>
     <DragValue id="cp-bars" label="Loop length" value={c.bars} min={1} max={4} step={1} unit=" Bars" onChange={v=>setTiming(v,c.meter)}/>
    </section><div className="cp-export-actions">{wavAction}<button type="button" aria-label="Studio help" data-studio-help-toggle="" aria-expanded={helpOpen} onClick={()=>setHelpOpen(!helpOpen)}>?</button></div>
   </div>
   {helpOpen&&<aside className="cp-help-pop" aria-label="Studio help"><button type="button" onClick={()=>setHelpOpen(false)}>Close help ×</button><h3>Arrangement &amp; notes</h3><p>Click an empty cell to add, or drag to set its length. First click selects a note; click its selected onset again to delete. Sustain clicks select. Shift-click or right-click deletes one note. Delete / Backspace acts only inside the grid.</p><p>Drag the loop brace handles to set the active range; click the ruler to seek. Notes outside the range stay in your composition. WAV exports the active range with effect tails. Timing changes stop playback.</p><p>Solid clips show musical duration. Optional dashed tails show representative buffer allowance, not measured audible duration. Layer levels feed the master; Solo is session-only and Mute wins.</p><p>Fold uses the displayed root and Minor/Major scale. Existing out-of-scale notes stay visible. Velocity stalks set note strength; overlapping notes keep separate stalks.</p></aside>}
   <section className="ss-panel cp-arrangement-panel"><div className="ss-section-head"><h2>Arrangement</h2><span className="ss-muted">{c.layers.length}/{MAX_COMPOSE_LAYERS}</span><button ref={editorOpener} type="button" aria-expanded={drawer} onClick={()=>drawer?closeEditor():setDrawer(true)}>{drawer?'Close sound editor':'Edit sound'}</button><label className="cp-tail-toggle"><input type="checkbox" checked={showTails} onChange={e=>setShowTails(e.target.checked)}/> FX tails</label></div>
    <div ref={arrangement} className="cp-arrangement" tabIndex={0} aria-label="Scrollable arrangement"><div className="cp-timeline" style={{minWidth:220+loopBeats*32}}>
     <div ref={ruler} className="cp-ruler" aria-label="Bar and beat ruler"><span>TRACK / MIX</span><div className="cp-arrangement-scale" style={{gridTemplateColumns:`repeat(${loopBeats},minmax(32px,1fr))`}}>
      {Array.from({length:c.bars},(_,bar)=><span key={`bar-${bar}`} className="cp-arrangement-bar" style={{gridColumn:`span ${c.meter}`}}>Bar {bar+1}</span>)}
      {Array.from({length:loopBeats},(_,i)=><span className="cp-arrangement-beat" data-bar={i%c.meter===0} key={i}>{i%c.meter+1}</span>)}
      <LoopBrace key={`${scopeKey}:${c.id}:${c.bars}:${c.meter}`} start={window.start} end={window.end} total={loopBeats} position={snapshot.positionBeat} onChange={setLoop} onSeek={beat=>audio.seek(beat)} begin={()=>store.beginGesture()} finish={()=>store.endGesture()}/>
     </div></div>
     {c.layers.map((l,index)=><div ref={l.id===layer.id?selectedLane:undefined} className="cp-lane" key={l.id} data-selected={l.id===layer.id} data-audible={layerAudible(l,solo)} style={{'--cp-layer-color':/chord|pad|harmony/i.test(l.name)?'#55d9de':/lead|melod/i.test(l.name)?'#ad91ef':layerColor(l.id)} as React.CSSProperties}>
      <div className="cp-track" data-selected={l.id===layer.id}><div className="cp-track-top"><button className="cp-track-select" type="button" aria-pressed={l.id===layer.id} onClick={()=>store.select(l.id)}><strong>{String(index+1).padStart(2,'0')} · {l.name}</strong><small>{l.patch.name}</small></button>
       <details className="cp-track-menu" onClick={e=>{if((e.target as HTMLElement).closest('button:not(:disabled)'))e.currentTarget.open=false;}}><summary aria-label={`Actions for ${l.name}`} title="Duplicate or delete this layer">···</summary><div><button disabled={c.layers.length>=MAX_COMPOSE_LAYERS} onClick={()=>add({...duplicateLayer(l,false),name:`${l.name.slice(0,75)} copy`})}>Duplicate sound</button><button disabled={c.layers.length>=MAX_COMPOSE_LAYERS} onClick={()=>add({...duplicateLayer(l,true),name:`${l.name.slice(0,75)} copy`})}>Duplicate sound + pattern</button><button className="ss-danger" disabled={c.layers.length===1} onClick={()=>deleteLayer(l.id)}>Delete layer</button></div></details></div>
       <div className="cp-track-controls"><button type="button" title={`Mute ${l.name}`} aria-label={`Mute ${l.name}`} aria-pressed={l.muted} onClick={()=>mixLayer(l.id,{muted:!l.muted})}>M</button><button type="button" title={`Solo ${l.name}`} aria-label={`Solo ${l.name}`} aria-pressed={solo.has(l.id)} onClick={()=>setSolo(current=>{const next=new Set(current);if(next.has(l.id))next.delete(l.id);else next.add(l.id);return next;})}>S</button>
        <DragValue id={`cp-level-${l.id}`} label="Level" value={l.gainDb} min={-48} max={6} step={.1} unit=" dB" onGestureStart={()=>store.beginGesture()} onGestureEnd={()=>store.endGesture()} onChange={v=>mixLayer(l.id,{gainDb:v})}/>
        <ParameterKnob id={`cp-pan-${l.id}`} label="Pan" help="Stereo position, after the layer level and before master output. Center = 0." value={l.pan??0} min={-1} max={1} step={.01} onGestureStart={()=>store.beginGesture()} onGestureEnd={()=>store.endGesture()} onChange={v=>mixLayer(l.id,{pan:v})}/>
       </div><TrackMeter read={audio.readLevel} id={l.id}/>
      </div>
      <div className="cp-clips" style={{'--cp-beat-width':`${100/loopBeats}%`,'--cp-bar-width':`${100/c.bars}%`} as React.CSSProperties}>
       {l.notes.filter(n=>n.beat<loopBeats).map(n=>{const body=n.duration,tail=showTails?(tailSeconds[l.id]??0)*c.tempo/60:0,total=body+tail;return <button key={n.id} type="button" className="cp-note" aria-label={`${l.name}: ${composePitchName(n.pitch)}, bar ${Math.floor(n.beat/c.meter)+1}, ${beatsLabel(n.duration)}`} aria-pressed={l.id===layer.id&&n.id===noteId} onClick={()=>{if(l.id!==layer.id)store.select(l.id);setNoteId(n.id);setGridOpen(true);setOverlapCell({beat:n.beat,pitch:n.pitch});setOctave(Math.floor(n.pitch/12)-1);}} style={{left:`${n.beat/loopBeats*100}%`,width:`${total/loopBeats*100}%`,top:pitchTop(n.pitch),zIndex:l.id===layer.id&&n.id===noteId?2:1}}><span data-compose-body="" style={{width:`${body/total*100}%`}}>{composePitchName(n.pitch)}</span><span data-compose-tail="" hidden={!showTails} style={{width:`${tail/total*100}%`}}/></button>})}
       <i className="cp-playhead" style={{left:`${snapshot.positionBeat/loopBeats*100}%`}}/>
      </div>
     </div>)}
     <div className="cp-add-row"><details className="cp-add-menu" onClick={e=>{if((e.target as HTMLElement).closest('button:not(:disabled)'))e.currentTarget.open=false;}}><summary>+ Add Layer</summary><div><button type="button" disabled={c.layers.length>=MAX_COMPOSE_LAYERS} onClick={()=>add(createLayer(undefined,'Blank sound'))}>Add blank layer</button><select aria-label="New layer from sound preset" value={preset} onChange={e=>setPreset(e.target.value)}><option value="">Saved sound…</option>{eventStore.state.presets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><button disabled={!preset||c.layers.length>=MAX_COMPOSE_LAYERS} onClick={()=>{const p=eventStore.state.presets.find(item=>item.id===preset);if(p)add(createLayer(p.patch,p.name));}}>Add preset layer</button></div></details><small>{c.layers.length>=MAX_COMPOSE_LAYERS?'Layer limit reached':'Select a track to edit its pattern below'}</small></div>
    </div></div>
   </section>
   <div className="cp-editing-dock" data-editor-open={drawer} data-grid-open={gridOpen}>
    <section ref={gridAnchor} className="ss-panel cp-grid-panel" tabIndex={-1} aria-label="Step grid editor" style={{'--cp-layer-color':layerColor(layer.id)} as React.CSSProperties}>
     <div className="ss-section-head"><button type="button" className="cp-drawer-toggle" aria-expanded={gridOpen} onClick={()=>setGridOpen(!gridOpen)}>{gridOpen?'▾':'▸'} Step Grid · {layer.name}</button><label className="cp-layer-name">Name <input aria-label="Layer name" type="text" value={layer.name} onChange={e=>editLayer(l=>({...l,name:e.target.value}))}/></label></div>
     {gridOpen&&<div className="cp-grid-content"><div className="cp-entry"><div className="cp-grid-area"><div className="cp-actions cp-grid-toolbar">
      <DragValue id="cp-octave" label="Octave" value={octave} min={1} max={6} step={1} onChange={v=>{cancelDrag();setOctave(v);}}/>
      <DragValue id="cp-note-length" label="New note" value={noteDuration} min={.25} max={4} step={.25} unit=" beats" onChange={setNoteDuration}/>
      <button type="button" aria-pressed={fold} onClick={()=>setFold(!fold)} title="Fold to scale · existing out-of-scale notes stay visible">Fold to Scale</button>
      <select aria-label="Scale" value={scale} onChange={e=>setScale(e.target.value as 'minor'|'major')}><option value="minor">{names[c.root%12]} Minor</option><option value="major">{names[c.root%12]} Major</option></select>
      <small>{note?`${composePitchName(note.pitch)} · ${Math.round(note.velocity*100)}% velocity`:'Select a note'}</small>
     </div>
     <div className="cp-grid-scroll" onScroll={e=>{const lane=e.currentTarget.nextElementSibling;if(lane)lane.scrollLeft=e.currentTarget.scrollLeft;}} tabIndex={0} aria-label="Step grid" onKeyDown={e=>{const target=e.target as HTMLElement;if((e.key==='Delete'||e.key==='Backspace')&&!['INPUT','TEXTAREA','SELECT'].includes(target.tagName)&&!target.isContentEditable&&note){e.preventDefault();removeNote(note.id);}}}>
     <div className="cp-grid" style={{gridTemplateColumns:`52px repeat(${steps},minmax(32px,1fr))`,minWidth:52+steps*32}}><span className="cp-grid-corner">Bar</span>{Array.from({length:c.bars},(_,bar)=><span key={`bar-${bar}`} className="cp-grid-bar" style={{gridColumn:`span ${c.meter*2}`}}>Bar {bar+1}</span>)}<span className="cp-grid-corner cp-grid-beat-label">Beat / &amp;</span>{Array.from({length:steps},(_,i)=><span key={i} className="cp-grid-subdivision" data-bar={i%(c.meter*2)===0}>{i%2===0?(i/2)%c.meter+1:'&'}</span>)}
      {Array.from({length:12},(_,i)=>(octave+1)*12+11-i).filter(pitch=>!fold||scaleNotes.includes((pitch-c.root%12+12)%12)||layer.notes.some(n=>n.pitch===pitch)).map(pitch=><React.Fragment key={pitch}><span className="cp-grid-pitch" data-black={[1,3,6,8,10].includes(pitch%12)} data-outscale={!scaleNotes.includes((pitch-c.root%12+12)%12)}>{composePitchName(pitch)}</span>{Array.from({length:steps},(_,step)=>{const beat=step/2,hits=notesInCell(layer.notes,beat,pitch,noteId),hit=hits[0],coverage=hit?cellCoverage(hit,beat):null,ghost=preview?.pitch===pitch?cellCoverage(preview,beat):null,selected=!!hit&&hit.id===noteId;return <button key={step} type="button" aria-label={`${hit?'Select':'Add'} ${composePitchName(pitch)} at bar ${Math.floor(beat/c.meter)+1} beat ${beat%c.meter+1}${hit?`, ${coverage?.onset?'onset':'sustain'}, ${beatsLabel(hit.duration)}${hits.length>1?`, ${hits.length} overlapping notes`:''}`:''}`} aria-pressed={selected} disabled={pitch<28||pitch>84} data-black={[1,3,6,8,10].includes(pitch%12)} data-outscale={!scaleNotes.includes((pitch-c.root%12+12)%12)} data-grid-beat={beat} data-grid-pitch={pitch} data-note-id={hit?.id} data-on={!!hit} data-selected={selected} data-bar={step%(c.meter*2)===0}
       onClick={e=>{if(suppressClick.current&&e?.detail!==0){const skip=suppressClick.current;suppressClick.current=null;if(skip.beat===beat&&skip.pitch===pitch)return;}activateCell(beat,pitch,!!e?.shiftKey);}}
       onContextMenu={e=>{if(notesInCell(layer.notes,beat,pitch,noteId).length){e.preventDefault();activateCell(beat,pitch,true);}}}
       onPointerDown={e=>pointerDown(e,beat,pitch)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}>
       {coverage&&<span className="cp-grid-body" data-note-onset={coverage.onset} style={{left:`${coverage.left*100}%`,width:`${coverage.width*100}%`}} aria-hidden="true">{coverage.onset?(selected?'◆':'●'):'━'}</span>}{ghost&&<span className="cp-grid-preview" data-note-preview="" style={{left:`${ghost.left*100}%`,width:`${ghost.width*100}%`}} aria-hidden="true"/>}{hits.length>1&&<small className="cp-overlap-count" aria-hidden="true">{hits.length}</small>}
      </button>;})}</React.Fragment>)}
     <i className="cp-grid-playhead" aria-hidden="true" style={{left:`calc(52px + (100% - 52px) * ${snapshot.positionBeat/loopBeats})`}}/>
     </div>
    </div>

     <div className="cp-velocity-scroll"><div className="cp-velocity-lane" aria-label="Note velocity lane" style={{minWidth:52+steps*32}}><span>VEL</span><div>{layer.notes.filter(n=>n.beat<loopBeats).map((n,index,all)=>{const group=all.filter(other=>other.beat===n.beat),offset=group.findIndex(other=>other.id===n.id);return <input key={n.id} type="range" aria-label={`Velocity ${composePitchName(n.pitch)} at beat ${Number(n.beat.toFixed(2))}`} title={`${composePitchName(n.pitch)} · ${Math.round(n.velocity*100)}% · drag stalk to set velocity`} min={.1} max={1} step={.05} value={n.velocity} style={{left:`calc(${n.beat/loopBeats*100}% + ${offset*8}px)`, '--velocity':`${n.velocity*100}%`} as React.CSSProperties} onPointerDown={()=>{store.beginGesture();setNoteId(n.id);}} onPointerUp={()=>store.endGesture()} onPointerCancel={()=>store.endGesture()} onBlur={()=>store.endGesture()} onChange={e=>editLayer(l=>({...l,notes:l.notes.map(row=>row.id===n.id?{...row,velocity:Number(e.target.value)}:row)}))}/>;})}</div></div></div>
     {overlaps.length>1&&<div className="cp-actions"><span>{overlaps.findIndex(n=>n.id===noteId)+1}/{overlaps.length} overlapping</span><button onClick={()=>cycleOverlap(-1)}>Previous</button><button onClick={()=>cycleOverlap(1)}>Next</button></div>}
     </div>
   <aside className="cp-note-editor" aria-label="Selected note"><h3>{note?`${composePitchName(note.pitch)} · selected note`:'Select a note in the grid or arrangement'}</h3>{note?<>
    <NumericControl key={`${layer.id}-${note.id}-pitch`} scopeIdentity={`${scopeKey}:${c.id}:${layer.id}:${note.id}`} id="cp-note-pitch" label="Pitch (MIDI)" value={note.pitch} min={28} max={84} step={1} help="Absolute pitch before effects." onChange={v=>editNote(n=>({...n,pitch:v}))}/>
    {noteOut?<div className="cp-stored-length"><strong>Stored length: {beatsLabel(note.duration)}</strong><p>Crossing / outside loop; not trimmed. {noteLimit===null?'Fit moves its onset to the final eighth-note step.':'Fit shortens to the visible loop end.'}</p><button type="button" onClick={()=>editNote(n=>{const beat=n.beat>loopBeats-.25?loopBeats-.5:n.beat;return {...n,beat,duration:visibleDuration(beat,loopBeats,n.duration)!};})}>Fit selected note to loop</button></div>:<NumericControl key={`${layer.id}-${note.id}-duration`} scopeIdentity={`${scopeKey}:${c.id}:${layer.id}:${note.id}`} id="cp-note-duration" label="Length" value={note.duration} min={.25} max={noteLimit!} step={.25} unit={note.duration===1?' beat':' beats'} help="Quarter-beat lengths, bounded to four beats and the visible loop." onChange={v=>editNote(n=>({...n,duration:visibleDuration(n.beat,loopBeats,v)!}))}/>}
    <NumericControl key={`${layer.id}-${note.id}-velocity`} scopeIdentity={`${scopeKey}:${c.id}:${layer.id}:${note.id}`} id="cp-note-velocity" label="Velocity" value={note.velocity} min={.1} max={1} step={.05} help="Note intensity, independent of layer balance." onChange={v=>editNote(n=>({...n,velocity:v}))}/><p className="cp-note-summary">Note body incl. release {selectedTiming!.patch.duration.toFixed(2)} s{showTails?` · representative buffer allowance ${tailSeconds[layer.id]===undefined?'pending':`${tailSeconds[layer.id].toFixed(2)} s`}`:''}{selectedTiming!.clamped?' · musical body clamped to renderer limit':''}</p><button type="button" onClick={()=>removeNote(note.id)}>Delete selected note</button>
   </>:null}</aside>
     </div>{retained.length>0&&<small className="ss-notice">{retained.length} notes crossing / outside the full timeline retained. Select in Arrangement to inspect.</small>}</div>}
    </section>
    {drawer&&<div className="cp-editor-anchor"><ParameterScope key={`${scopeKey}:${c.id}:${layer.id}`} identity={`${scopeKey}:${c.id}:${layer.id}`}><ComposeSoundEditor key={layer.id} layer={layer} edit={edit} begin={()=>store.beginGesture()} end={()=>store.endGesture()} onUndo={undo} onClose={closeEditor}/></ParameterScope></div>}
   </div>
   <footer className="cp-statusbar"><span role="status">{notice||statusHint}</span><span title={`Playback revision ${snapshot.appliedRevision} → ${snapshot.requestedRevision}`}>{snapshot.playing?'PLAYING':snapshot.pending?'PREPARING':readiness.split(' · ')[0]} · {snapshot.positionBeat.toFixed(1)} beats{snapshot.updating?(snapshot.applyAtBeat===null?' · Preparing update':' · Updating next bar'):''}</span></footer>
  </div>
 </div></ParameterScope>;
}




