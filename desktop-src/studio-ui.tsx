import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SOUND_EVENTS, SoundStudioEngine, encodeWav, validateSoundPatch, validateSoundTheme, type FxKey, type SoundEvent, type SoundPatch, type SoundTheme } from '../assets/studio-engine';
import { STUDIO_PALETTES, EVENT_LABELS, STYLE_OPTIONS, applyStyle, setDuration, setAdsrStage } from './studio-data';
import { compileStudioRuntime, serializeTheme } from './studio-export';
import {JsonFileImport} from './studio-json-picker';
import {useInlineConfirmation} from './studio-confirmation';
import {applySoundImport,validateSoundImport,type SoundImport} from './studio-json-import';
import { compileSonicApproximation, describeSonicConversion } from './studio-sonic-export';
import { type StudioAudioBridge } from './studio-audio-bridge';
import type { createStudioStore } from './studio-store';
import { RoutingGraph, EnvelopeCurve, FilterCurve, ShapePreview, EffectsRack, type EditorTarget } from './studio-workspace';
import {StudioXyPad} from './studio-xy-pad';
import {PlaybackPosition} from './studio-playback-position';
import { StudioTopbar } from './studio-topbar';
import {LiveScope} from './studio-feedback';
import {DesktopSoundControls} from './studio-desktop-controls';
import {EMPTY_BACKGROUND_DRAFT,type BackgroundDrafts} from './studio-background-draft';
import {DraftEditor} from './studio-draft-editor';
import {measureDraftLevel,balanceDraftLevel} from './studio-draft-level';
import type {DesktopSoundTarget} from './studio-desktop-target';
import { LocalDeviceDemo, NumericControl, SelectControl, SoundPlot, ToggleControl, ParameterKnob, ParameterGroup, ParameterScope, ModuleCard, ModuleGrid, ModuleMasonry, AuditionTransportBar, EditorNavigation, type PcmAnalysis } from './studio-components';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@hermes/plugin-sdk';
import { OscillatorModule, AdsrEditor, LfoModule } from './studio-modules';
import { gainToDb, dbToGain } from './studio-musical';

export type StudioStore = ReturnType<typeof createStudioStore>;

const noSubscription=()=>()=>{};
const emptyGeneration=()=>EMPTY_BACKGROUND_DRAFT;
const WAVES = ['sine','triangle','square','sawtooth'] as const;
const LFOWAVES = ['sine','triangle','square'] as const;
const FILTERS = ['lowpass','highpass','bandpass','notch'] as const;
const SOURCES = ['LFO 1','LFO 2','Env 1 (ADSR)','Velocity'] as const;
const DESTINATIONS = ['Filter Cutoff','Osc 1 Level','Pan','Filter Resonance','Osc 2 Pitch'] as const;
const shortError=(e:unknown)=> e instanceof Error ? e.message : String(e);
const resizeDuration=(p:SoundPatch,seconds:number)=>setDuration(p,seconds);

function saveDownload(name:string,content:string|Uint8Array,mime:string) {
  const bytes=typeof content==='string' ? content : new Uint8Array(content);
  const blob=new Blob([bytes],{type:mime}),url=URL.createObjectURL(blob);
  try { const a=document.createElement('a'); a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove(); }
  finally { window.setTimeout(()=>URL.revokeObjectURL(url),1000); }
}


function EventPicker({ selected, theme, onSelect, onPlay, playable, cards=false }: {
  selected:SoundEvent;theme:SoundTheme;onSelect:(event:SoundEvent)=>void;onPlay:(event:SoundEvent)=>void;playable:boolean;cards?:boolean;
}) {
  return <div className={cards?'ss-event-grid':'ss-event-list'}>
    {SOUND_EVENTS.map((event:SoundEvent, index:number)=><div className="ss-event" data-selected={selected===event} key={event}>
      <button className="ss-event-select" type="button" aria-pressed={selected===event} onClick={()=>onSelect(event)}><span className="ss-event-number">0{index+1}</span><strong>{EVENT_LABELS[event]}</strong><small title={theme.events[event].name}>{theme.events[event].name}</small><span className="ss-event-key">{event}</span></button>
      <button className="ss-event-play" type="button" aria-label={`${playable?'Audition':'Enable audio and audition'} ${EVENT_LABELS[event]}`} onClick={()=>onPlay(event)}>▶</button>
    </div>)}
  </div>;
}

function BeginnerControls({patch,edit,begin,end}:{patch:SoundPatch;edit:(make:(p:SoundPatch)=>SoundPatch)=>void;begin:()=>void;end:()=>void}) {return <section className="ss-beginner-controls" aria-label="Design a sound"><h2>Design a sound</h2><div className="ss-style-row" role="group" aria-label="Sound style">{STYLE_OPTIONS.map(option=><button key={option.id} type="button" aria-pressed={patch.style===option.id} onClick={()=>edit(p=>applyStyle(p,option.id))}>{option.label}</button>)}</div><ParameterGroup label="Sound design"><SelectControl id="ss-character" label="Character" help="Change the oscillator and filter character." value={patch.character} options={[...new Set([...STYLE_OPTIONS.map(x=>x.character),patch.character])]} onChange={v=>{const option=STYLE_OPTIONS.find(x=>x.character===v);if(option)edit(p=>applyStyle(p,option.id));}}/><div className="ss-duration-control"><NumericControl id="ss-duration" label="Dry note duration" help="Includes release. Scales envelope timing; rendering adds chord staggering and effect-tail allowance." value={patch.duration} min={.02} max={2.5} step={.01} unit=" s" onGestureStart={begin} onGestureEnd={end} onChange={v=>edit(p=>setDuration(p,v))}/><p className="ss-duration-hint">Note body includes release. Scales envelope timing.</p></div><ParameterKnob id="ss-intensity" label="Intensity" help="Velocity strength before sound gain and master output; feeds Velocity modulation." value={patch.intensity} min={0} max={100} step={1} unit="%" onGestureStart={begin} onGestureEnd={end} onChange={v=>edit(p=>({...p,intensity:v}))}/></ParameterGroup></section>;}

export function ModulationMatrix({patch,edit,begin,end}:{patch:SoundPatch;edit:(make:(p:SoundPatch)=>SoundPatch)=>void;begin:()=>void;end:()=>void}) {return <div className="ss-modulation-matrix"><p className="ss-muted">Route supported sources to sound parameters. Signed amount controls direction.</p>{patch.modMatrix.map((row,i)=><div className="ss-matrix-row" key={i}><SelectControl id={`ss-matrix-source-${i}`} label="Source" help="Signal driving this route." value={row.source} options={SOURCES} onChange={v=>edit(p=>({...p,modMatrix:p.modMatrix.map((r,j)=>j===i?{...r,source:v}:r)}))}/><NumericControl id={`ss-matrix-amount-${i}`} label="Amount" help="Strength and direction of modulation." value={row.amount} min={-1} max={1} step={.01} onGestureStart={begin} onGestureEnd={end} onChange={v=>edit(p=>({...p,modMatrix:p.modMatrix.map((r,j)=>j===i?{...r,amount:v}:r)}))}/><SelectControl id={`ss-matrix-dest-${i}`} label="Destination" help="Parameter this route changes." value={row.dest} options={DESTINATIONS} onChange={v=>edit(p=>({...p,modMatrix:p.modMatrix.map((r,j)=>j===i?{...r,dest:v}:r)}))}/><button type="button" aria-label={`Remove modulation route ${i+1}`} onClick={e=>{const add=e.currentTarget.closest('.ss-modulation-matrix')?.querySelector<HTMLButtonElement>('.ss-matrix-add');edit(p=>({...p,modMatrix:p.modMatrix.filter((_,j)=>j!==i)}));requestAnimationFrame(()=>add?.focus());}}>Remove</button></div>)}<button className="ss-matrix-add" type="button" disabled={patch.modMatrix.length>=12} onClick={()=>edit(p=>({...p,modMatrix:[...p.modMatrix,{source:'LFO 1',amount:.25,dest:'Filter Cutoff'}]}))}>Add route</button></div>;}

export function SoundStudioView({store,writeClipboard,backgroundDrafts,previewBridge,scopeKey,onUseInCompose,taskNavigation,desktopTarget,previewEngine}: {store:StudioStore;writeClipboard:(text:string)=>Promise<boolean>;backgroundDrafts?:BackgroundDrafts;previewBridge?:StudioAudioBridge;scopeKey?:string;onUseInCompose?:()=>void;taskNavigation?:React.ReactNode;desktopTarget?:DesktopSoundTarget;previewEngine?:SoundStudioEngine}) {
  const version=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
  void version;
  const state=store.state, theme=state.theme, selected=state.selected, patch=theme.events[selected];
  const [instance]=useState(()=>previewEngine??new SoundStudioEngine(store.state.theme));
  const audio=useSyncExternalStore(instance.subscribe,instance.getSnapshot,instance.getSnapshot);
  const [notice,setNotice]=useState(''),[error,setError]=useState('');
  const [analysis,setAnalysis]=useState<PcmAnalysis|null>(null),[analysisState,setAnalysisState]=useState('Rendering local audio…');
  const generated=useSyncExternalStore(backgroundDrafts?.subscribe??noSubscription,backgroundDrafts?.getSnapshot??emptyGeneration,backgroundDrafts?.getSnapshot??emptyGeneration);
  const [pendingAuditions,setPendingAuditions]=useState(0);
  const [chart,setChart]=useState<'waveform'|'spectrum'|'spectrogram'>('waveform');
  const [frequencyMax,setFrequencyMax]=useState<number|undefined>(undefined);
  const [editorTab,setEditorTab]=useState(0),[libraryOpen,setLibraryOpen]=useState<boolean|null>(null),[inspectorOpen,setInspectorOpen]=useState(false);
  const [libraryTab,setLibraryTab]=useState<'events'|'presets'|'projects'|'palettes'>('events'),[analysisOpen,setAnalysisOpen]=useState(false);
  const [focusedOverlay,setFocusedOverlay]=useState<'matrix'|'routing'|'preview'|'analysis'|'draft'|null>(null);
  const [selectedEffect,setSelectedEffect]=useState<FxKey|null>(null),[focusRequest,setFocusRequest]=useState<{target:EditorTarget}|null>(null);
  const navigationDestination=useRef<EditorTarget|null>(null);
  const overlayOpener=useRef<HTMLElement|null>(null);
  const overlayKind=useRef<'matrix'|'routing'|'preview'|'analysis'|'draft'|null>(null);
  const openOverlay=(kind:'matrix'|'routing'|'preview'|'analysis'|'draft',opener:HTMLElement)=>{overlayOpener.current=opener;overlayKind.current=kind;setFocusedOverlay(kind);};
  const [projectName,setProjectName]=useState(theme.name),[presetName,setPresetName]=useState(patch.name);
  const [soundJson,setSoundJson]=useState('');
  const [exportMode,setExportMode]=useState<'precision'|'approximate'>('precision');
  const [draftText,setDraftText]=useState(''),[draft,setDraft]=useState<{requestId:string;patch:SoundPatch;event:SoundEvent;source:string;sourceRevision:number;background?:boolean;current:()=>boolean}|null>(null),[generating,setGenerating]=useState(false);
  const [draftLevel,setDraftLevel]=useState<{patch:SoundPatch;peakDb:number|null;rmsDb:number|null;error?:string}|null>(null),[balancingDraft,setBalancingDraft]=useState(false);
  const [draftPlaying,setDraftPlaying]=useState(false);
  const liveDraft=useRef(draft);liveDraft.current=draft;
  const confirmation=useInlineConfirmation(`${scopeKey??'studio'}:${selected}`);
  const live=useRef({store,scopeKey,projectName,presetName,soundJson,draftText});live.current={store,scopeKey,projectName,presetName,soundJson,draftText};
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const engine=useRef<SoundStudioEngine|null>(instance),draftEngine=useRef<SoundStudioEngine|null>(null),draftTimer=useRef<ReturnType<typeof setTimeout>|null>(null),renderId=useRef(0),requestId=useRef(0),consentId=useRef(0),rootRef=useRef<HTMLDivElement|null>(null),previousTheme=useRef(theme);
  const isPlayable=audio.enabled&&!audio.muted&&audio.contextState==='running';
  const inScope=()=>!previewBridge||!scopeKey||previewBridge.isCurrent(instance,scopeKey);
  const showError=(e:unknown)=>{setError(shortError(e));setNotice('');};
  const update=(next:SoundPatch):boolean=>{try{if(!store.setPatch(validateSoundPatch(next)))throw new Error(store.state.error||'Sound edit was not saved.');setError('');setNotice('');return true;}catch(e){showError(e);return false;}};
  const edit=(make:(p:SoundPatch)=>SoundPatch)=>{try{update(make(store.state.theme.events[store.state.selected]));}catch(e){showError(e);}};
  const captureCurrent=()=>{const captured=live.current,revision=store.getSnapshot(),event=store.state.selected;return()=>mounted.current&&live.current.store===captured.store&&live.current.scopeKey===captured.scopeKey&&live.current.projectName===captured.projectName&&live.current.presetName===captured.presetName&&live.current.soundJson===captured.soundJson&&live.current.draftText===captured.draftText&&store.getSnapshot()===revision&&store.state.selected===event&&inScope();};
  const reviewReplacement=async(question:string,apply:()=>boolean,loaded:string,current=captureCurrent())=>{
    try{
      if(!current())return;
      const accepted=await confirmation.request(`${question} Save a project or export first to keep a durable copy. Undo can restore the previous sounds in this session.`,current);
      if(!current())return;
      if(!accepted){setNotice('Replacement cancelled. Current work kept.');return;}
      // Last ownership check is immediately before stopping pending audio and mutating.
      stopForImport();store.endGesture();
      const saved=apply();
      setError(saved?'':`${loaded} in memory, but local saving could not be verified. Export JSON before closing. ${store.state.error}`);
      setNotice(saved?loaded:'');
    }catch(e){if(current())showError(e);}
  };
  const replace=(t:SoundTheme,kind:'palette'|'project'='project')=>{
    try{const validated=validateSoundTheme(t),next=kind==='palette'?validateSoundTheme({...store.state.theme,events:validated.events}):validated;
      return reviewReplacement(kind==='palette'?'Replace all six event sounds with this palette? Project name, render settings, Compose and saved projects/presets will not change.':'Replace the whole workspace: all six event sounds, project name and render settings? Compose and saved projects/presets will not change.',()=>store.setTheme(next),`Loaded ${kind}: ${t.name}.`);
    }catch(e){showError(e);return Promise.resolve();}
  };
  const loadPreset=(id:string)=>{try{const row=store.state.presets.find(p=>p.id===id);if(!row)throw Error('Preset not found.');validateSoundPatch(row.patch);return reviewReplacement(`Replace only the selected ${EVENT_LABELS[store.state.selected]} sound with this preset? Other events, project name, render settings, Compose and saved projects/presets will not change.`,()=>store.loadPreset(id),`Loaded ${row.name} into ${EVENT_LABELS[store.state.selected]}.`);}catch(e){showError(e);return Promise.resolve();}};
  const loadProject=(id:string)=>{try{const row=store.state.projects.find(p=>p.id===id);if(!row)throw Error('Project not found.');validateSoundTheme(row.theme);return reviewReplacement('Open this project and replace the whole workspace: all six event sounds, project name and render settings? Compose and saved projects/presets will not change.',()=>store.loadProject(id),`Opened project: ${row.name}.`);}catch(e){showError(e);return Promise.resolve();}};
  const newProject=()=>{let name='New sound project',n=2;while(store.state.projects.some(p=>p.name===name))name=`New sound project ${n++}`;return replace({...STUDIO_PALETTES[0],name},'project');};
  const focusEditorTarget=(target:EditorTarget)=>{
    const root=rootRef.current;if(!root)return;
    let control:HTMLElement|undefined|null;
    if(target.kind==='effect'){
      const drawer=Array.from(root.querySelectorAll<HTMLElement>('[id]')).find(el=>el.id===`ss-fx-drawer-${target.effect}`);
      control=drawer?.querySelector<HTMLElement>('input,select,[role="slider"],button');
    }else{
      const id=target.kind==='output'&&target.controlId==='ss-master'&&store.state.theme.masterGain===0?'ss-master-silent':target.controlId;
      control=Array.from(root.querySelectorAll<HTMLElement>('[data-parameter-id],[id]')).find(el=>el.dataset.parameterId===id||el.id===id);
    }
    if(!control?.isConnected)return;
    let parent=control.parentElement;while(parent&&parent!==root){if(parent.tagName==='DETAILS')(parent as HTMLDetailsElement).open=true;parent=parent.parentElement;}
    control.focus();control.scrollIntoView?.({block:'nearest',inline:'nearest'});
  };
  const navigateEditor=(target:EditorTarget)=>{
    // Routing is an Advanced view. Navigation changes only local panels, never store/audio.
    if(target.kind==='module')setEditorTab(target.tab);
    else if(target.kind==='effect'){setSelectedEffect(target.effect);setEditorTab(3);}
    else setInspectorOpen(true);
    navigationDestination.current=focusedOverlay?target:null;
    if(focusedOverlay)setFocusedOverlay(null);
    setFocusRequest({target});
  };
  useEffect(()=>{
    if(!focusRequest)return;
    const current=captureCurrent(),frame=requestAnimationFrame(()=>{if(current())focusEditorTarget(focusRequest.target);});
    return()=>cancelAnimationFrame(frame);
  },[focusRequest,editorTab,inspectorOpen,selectedEffect,focusedOverlay,scopeKey,selected,store]);
  useEffect(()=>setProjectName(theme.name),[theme.name]);
  useEffect(()=>setPresetName(patch.name),[selected]);

  useEffect(()=>{
    engine.current=instance;
    const detach=previewBridge&&scopeKey?previewBridge.attach(instance,scopeKey,value=>mutePreview.current(value)):undefined;
    instance.setCssTarget(rootRef.current??undefined);
    return ()=>{consentId.current++;renderId.current++;requestId.current++;if(draftTimer.current)clearTimeout(draftTimer.current);void draftEngine.current?.dispose();draftEngine.current=null;instance.setCssTarget(undefined);detach?.();instance.stopAll();engine.current=null;if(!previewEngine)void instance.dispose();};
  },[instance,store,previewBridge,scopeKey,previewEngine]);
  useEffect(()=>{
    const old=previousTheme.current;previousTheme.current=theme;
    if(old===theme)return;
    try{
      if(old.sampleRate!==theme.sampleRate||old.masterGain!==theme.masterGain||old.name!==theme.name)instance.setTheme(theme);
      else for(const event of SOUND_EVENTS)if(old.events[event]!==theme.events[event])instance.setEventPatch(event,theme.events[event]);
    }catch(e){showError(e);}
  },[instance,theme]);
  useEffect(()=>{
    const id=++renderId.current;
    setAnalysis(null);setAnalysisState('Rendering local audio…');
    const timer=window.setTimeout(()=>{void instance.getAnalysis(selected).then(result=>{
      if(id!==renderId.current)return;
      setAnalysis(result);setAnalysisState('');
    }).catch(e=>{if(id===renderId.current){setAnalysis(null);setAnalysisState('Analysis unavailable.');showError(e);}});},80);
    return ()=>{clearTimeout(timer);renderId.current++;};
  },[instance,selected,patch,theme.sampleRate,theme.masterGain]);

  const enableAudio=()=>{const target=engine.current;if(!target||!inScope())return;const token=consentId.current;void target.enable().then(()=>{if(engine.current===target&&token===consentId.current&&inScope())setNotice('Local audio enabled and unmuted. Nothing is playing; choose Audition.');}).catch(showError);};
  const audition=(event:SoundEvent)=>{
    const target=engine.current;if(!target||!inScope())return;
    const token=consentId.current;
    // AudioContext construction/resume happens inside this click, never from hover or a timer.
    setPendingAuditions(n=>n+1);
    const ready=isPlayable?Promise.resolve():target.enable();
    void ready.then(async()=>{
      if(engine.current!==target||token!==consentId.current||!inScope())return;
      const scheduled=await target.trigger(event);
      if(engine.current!==target||token!==consentId.current||!inScope())return;
      if(scheduled){setNotice(`Auditioned ${EVENT_LABELS[event]} locally.`);setError('');}
      else setNotice('Preview was not scheduled (audio muted, unavailable or changing).');
    }).catch(e=>{if(engine.current===target&&token===consentId.current&&inScope())showError(e);}).finally(()=>{if(engine.current===target&&token===consentId.current)setPendingAuditions(n=>Math.max(0,n-1));});
  };
  const auditionDraft=()=>{
    if(!draft||!draft.current()||!inScope())return;
    setDraftPlaying(false);
    if(draftTimer.current)clearTimeout(draftTimer.current);
    void draftEngine.current?.dispose().catch(showError);
    const candidate=new SoundStudioEngine({...theme,events:{...theme.events,[draft.event]:draft.patch}});
    draftEngine.current=candidate;
    const token=consentId.current;
    const target=engine.current;if(!target){void candidate.dispose();return;}
    void Promise.all([candidate.enable(),target.enable()]).then(()=>{
      if(draftEngine.current!==candidate||liveDraft.current!==draft||token!==consentId.current||!engine.current||!draft.current()||!inScope()){void candidate.dispose();return false;}
      return candidate.trigger(draft.event);
    }).then(scheduled=>{
      if(draftEngine.current!==candidate)return;
      if(!scheduled){setNotice('Draft preview was not scheduled.');return;}
      setDraftPlaying(true);setNotice('Draft auditioned locally; current theme unchanged.');setError('');
      draftTimer.current=setTimeout(()=>{if(draftEngine.current===candidate){draftEngine.current=null;setDraftPlaying(false);void candidate.dispose().catch(showError);}},Math.ceil(((candidate.getPlaybackPosition()?.renderedDuration??6)+.2)*1000));
    }).catch(e=>{if(draftEngine.current===candidate){draftEngine.current=null;void candidate.dispose().catch(showError);showError(e);}});
  };

  useEffect(()=>{
    setDraftLevel(null);let cancelled=false;
    if(draft)void measureDraftLevel(draft.patch,theme.sampleRate).then(result=>{if(!cancelled)setDraftLevel({patch:draft.patch,...result});}).catch(e=>{if(!cancelled)setDraftLevel({patch:draft.patch,peakDb:null,rmsDb:null,error:shortError(e)});});
    return()=>{cancelled=true;};
  },[draft,theme.sampleRate]);
  const balanceDraft=()=>{
    if(!draft||!draft.current()||balancingDraft)return;
    const original=draft;setBalancingDraft(true);
    void balanceDraftLevel(original.patch,theme.sampleRate).then(result=>{
      if(liveDraft.current!==original||!original.current())return;
      void draftEngine.current?.dispose();draftEngine.current=null;
      if(original.background)backgroundDrafts?.setPatch(result.patch);else setDraft(current=>current===original?{...original,patch:result.patch}:current);
      setNotice('Draft level balanced. Audition it, then accept to apply.');setError('');
    }).catch(e=>{if(liveDraft.current===original&&original.current())showError(e);}).finally(()=>{if(mounted.current)setBalancingDraft(false);});
  };

  const setPreviewMuted=(next:boolean)=>{const target=engine.current;if(!target||!inScope())return;if(next){setDraftPlaying(false);consentId.current++;setPendingAuditions(0);if(draftTimer.current)clearTimeout(draftTimer.current);void draftEngine.current?.dispose();draftEngine.current=null;}target.setMuted(next);setNotice(next?'Studio preview muted.':'Studio preview unmuted.');};
  const mutePreview=useRef(setPreviewMuted);mutePreview.current=setPreviewMuted;
  const toggleMute=()=>setPreviewMuted(!instance.getSnapshot().muted);
  const copy=(kind:'json'|'ts')=>{try{const text=kind==='json'?serializeTheme(theme):compileStudioRuntime(theme);void writeClipboard(text).then(ok=>{if(ok){setNotice(`${kind==='json'?'JSON':'TypeScript'} copied.`);setError('');}else showError('Clipboard unavailable.');}).catch(showError);}catch(e){showError(e);}};
  const download=(kind:'json'|'ts'|'wav')=>{const token=consentId.current;void (async()=>{
    try{
      if(kind==='json')saveDownload('sound-theme.json',serializeTheme(theme),'application/json');
      if(kind==='ts')saveDownload('sound-studio-engine.ts',compileStudioRuntime(theme),'text/typescript');
      if(kind==='wav'){
        const source=store.state;
        const renderKey=(s:StudioStore['state'])=>JSON.stringify([s.selected,s.theme.sampleRate,s.theme.masterGain,s.theme.events[s.selected]]);
        const requestedKey=renderKey(source);
        // Bind the request to live inputs, including edits whose local save failed.
        instance.setTheme(source.theme);
        const buffer=await instance.getBuffer(source.selected);
        if(engine.current!==instance||token!==consentId.current||!inScope())return;
        if(renderKey(store.state)!==requestedKey)throw new Error('Sound changed during WAV rendering. Download again.');
        saveDownload(`${source.selected}.wav`,encodeWav(buffer),'audio/wav');
      }
      setNotice(`Download requested: ${kind==='wav'?'32-bit float stereo WAV':kind.toUpperCase()}.`);setError('');
    }catch(e){if(engine.current===instance&&token===consentId.current&&inScope())showError(e);}
  })();};
  const stopForImport=()=>{consentId.current++;requestId.current++;setPendingAuditions(0);setGenerating(false);instance.stopAll();if(draftTimer.current)clearTimeout(draftTimer.current);void draftEngine.current?.dispose();draftEngine.current=null;setDraft(null);};
  const importControl=<JsonFileImport<SoundImport> key={scopeKey} help="SoundTheme/v1: all six sounds + project/render settings. SoundPatch/v1: selected event only." options={{
    snapshot:()=>({target:store,revision:store.getSnapshot(),scope:scopeKey,selection:store.state.selected}),inScope,
    validate:validateSoundImport,
    confirm:(candidate,current)=>{const owns=captureCurrent();return confirmation.request(candidate.kind==='theme'?'Import SoundTheme/v1 and replace all six event sounds, project name and render settings? Compose and saved projects/presets will not change. Save or export first to keep a durable copy. Undo can restore the previous sounds in this session.':`Import SoundPatch/v1 and replace only the selected ${EVENT_LABELS[store.state.selected]} sound? Other events, project name, render settings and Compose will not change. Undo can restore the previous sound in this session.`,()=>owns()&&(current?.()??true));},
    cancelConfirmation:confirmation.cancel,
    apply:candidate=>applySoundImport(store,candidate,stopForImport),
    report:(message,failed)=>{setError(failed?message:'');setNotice(failed?'':message);},
  }}/>;
  const reviewSoundJson=()=>{try{const candidate=validateSoundPatch(JSON.parse(soundJson));if(!generated.busy)backgroundDrafts?.dismiss();requestId.current++;setGenerating(false);setDraft({requestId:`JSON-${requestId.current}`,patch:candidate,event:selected,source:JSON.stringify(patch),sourceRevision:store.getSnapshot(),current:captureCurrent()});setNotice('Review imported sound before accepting.');setError('');}catch(e){showError(e);}};
  const request=()=>{if(!backgroundDrafts||!draftText.trim())return;setDraft(null);setError('');void backgroundDrafts.start(draftText,selected,patch).catch(showError);};
  useEffect(()=>{
    if(generated.status!=='ready'||!generated.patch)return;
    const owner=store,id=generated.requestId,event=generated.event,source=generated.source;
    const current=()=>mounted.current&&live.current.store===owner&&backgroundDrafts?.getSnapshot().requestId===id&&backgroundDrafts.getSnapshot().status==='ready'&&owner.state.selected===event&&JSON.stringify(owner.state.theme.events[event])===source&&inScope();
    setDraft({requestId:id,patch:generated.patch,event,source,sourceRevision:store.getSnapshot(),background:true,current});
  },[generated.status,generated.requestId,generated.patch,selected,scopeKey,store,backgroundDrafts]);
  const editDraft=(make:(p:SoundPatch)=>SoundPatch)=>{if(!draft||!draft.current()||balancingDraft)return;try{const next=validateSoundPatch(make(draft.patch));setDraft({...draft,patch:next});if(draft.background)backgroundDrafts?.setPatch(next);setError('');}catch(e){showError(e);}};
  const select=(event:SoundEvent)=>{try{if(!store.select(event))throw new Error(store.state.error||'Selection was not saved.');}catch(e){showError(e);}};
  const switchMode=(mode:'beginner'|'advanced')=>{try{if(!store.setMode(mode))throw Error(store.state.error||'View was not saved.');setNotice('');setError('');}catch(e){showError(e);}};
  const saveProject=()=>{try{if(store.saveProject(projectName)){setNotice('Project saved locally.');setError('');}else showError(store.state.error||'Project save failed.');}catch(e){showError(e);}};
  const previousMaster=useRef(theme.masterGain||.6);
  const setMaster=(v:number)=>{if(v===0&&store.state.theme.masterGain>0)previousMaster.current=store.state.theme.masterGain;else if(v>0)previousMaster.current=v;try{if(!store.setTheme({...store.state.theme,masterGain:v}))throw Error(store.state.error||'Master gain was not saved.');setError('');}catch(e){showError(e);}};
  const setAdsr=(key:keyof SoundPatch['adsr'],value:number)=>edit(p=>setAdsrStage(p,key,value));
  const beginGesture=()=>store.beginGesture(),endGesture=()=>store.endGesture();
  const conversion=exportMode==='approximate'?describeSonicConversion(theme):null;
  const paletteName=STUDIO_PALETTES.find(pal=>SOUND_EVENTS.every(event=>JSON.stringify(pal.events[event])===JSON.stringify(theme.events[event])))?.name??'Custom sounds';
  const unsavedProject=state.dirty||projectName.trim()!==theme.name;
  const saveStatus=state.error?'Edits not verified in local storage':unsavedProject?'Unsaved project changes':state.activeProject?'Project saved locally':'Not saved as a project';
  const level=(v:number|null)=>v===null?'−∞ dBFS':`${v.toFixed(1)} dBFS`;
  const timingExplanation='Dry note duration includes attack, decay and release. Rendered duration adds chord staggering and bounded effect-tail allowance. It is buffer length, not measured audible duration.';
  const analysisReadings=<><span title="Dry note duration includes the release stage, not just the held note.">Note body (incl. release) <strong>{patch.duration.toFixed(2)} s</strong></span><span title="Buffer length includes chord staggering and bounded effect-tail allowance. This is not measured audible duration.">Render buffer (incl. tails) <strong>{analysis?`${analysis.duration.toFixed(2)} s`:'Pending'}</strong></span>{analysis?<span className="ss-absolute-level">Peak <strong>{level(analysis.peakDb)}</strong> · RMS <strong>{level(analysis.rmsDb)}</strong></span>:<span role="status">{analysisState}</span>}</>;
  const measurementDetails=<details className="ss-measurement-details"><summary>Details</summary><div className="ss-measurement-values">{analysisReadings}</div><p>{timingExplanation}</p></details>;
  const OutputDetails=state.mode==='beginner'?'details':'div';
  const analysisPlot=<section className="ss-scope" aria-label="Sound analysis"><div className="ss-scope-head"><div className="ss-segment" role="group" aria-label="Analysis view">{(['waveform','spectrum','spectrogram'] as const).map(kind=><button type="button" key={kind} aria-pressed={chart===kind} onClick={()=>setChart(kind)}>{kind}</button>)}</div>{chart!=='waveform'&&<div className="ss-frequency-controls"><button type="button" aria-pressed={frequencyMax===2000} onClick={()=>setFrequencyMax(2000)}>Low frequencies · ≤2 kHz</button><button type="button" aria-pressed={frequencyMax===undefined} onClick={()=>setFrequencyMax(undefined)}>Reset frequency range</button>{state.mode==='advanced'&&<small>Zoom uses existing sampled bins; no added resolution.</small>}</div>}{focusedOverlay!=='analysis'&&<button type="button" onClick={e=>openOverlay('analysis',e.currentTarget)}>Expand analysis</button>}</div><SoundPlot frequencyMax={frequencyMax} analysis={analysis} emptyMessage={analysisState} kind={chart} detailDisclosure={state.mode==='beginner'} label={`${EVENT_LABELS[selected]} ${chart}`}/>{focusedOverlay!=='analysis'&&state.mode==='advanced'&&<p className="ss-compact-plot-key">{chart==='waveform'?'Relative mono peak envelope · mirrored, not signed PCM. Absolute channel levels above.':chart==='spectrum'?'Relative magnitude · strongest sampled bin = 100%; not calibrated dBFS.':<>Relative intensity <span className="ss-intensity-key"><i aria-hidden="true"/>0% → 100%</span> of strongest cell.</>}</p>}</section>;
  const exportControls=<div className="ss-export-controls"><label htmlFor="ss-export-mode">Export mode</label><select id="ss-export-mode" value={exportMode} onChange={e=>setExportMode(e.target.value as 'precision'|'approximate')}><option value="precision">Studio precision</option><option value="approximate">Sonic real-time (approximate)</option></select>{conversion?<><p className="ss-muted">Different FM engine; not equivalent to the Studio audition or WAV.</p><ul className="ss-export-warnings">{conversion.warnings.map(w=><li key={w}>{w}</li>)}</ul><div className="ss-export-buttons"><button type="button" onClick={()=>{try{saveDownload('sonic-approximation.json',JSON.stringify(conversion.patch,null,2),'application/json');setNotice('Sonic approximation JSON downloaded.');}catch(e){showError(e);}}}>Download Sonic JSON (approximate)</button><button type="button" onClick={()=>{try{saveDownload('sonic-approximation.ts',compileSonicApproximation(theme),'text/typescript');setNotice('Sonic approximation TypeScript downloaded.');}catch(e){showError(e);}}}>Download Sonic TypeScript (approximate)</button></div></>:<div className="ss-export-buttons"><button type="button" onClick={()=>download('json')}>Download Studio JSON</button><button type="button" onClick={()=>copy('json')}>Copy Studio JSON</button><button type="button" onClick={()=>download('ts')}>Download Studio TypeScript</button><button type="button" onClick={()=>copy('ts')}>Copy Studio TypeScript</button><button type="button" onClick={()=>download('wav')}>Download Studio WAV</button></div>}</div>;

  const measuredDraft=draft&&draftLevel?.patch===draft.patch?draftLevel:null;
  const quietDraft=measuredDraft&&!measuredDraft.error&&measuredDraft.peakDb!==null&&measuredDraft.peakDb>=-90&&measuredDraft.peakDb < -24;
  const draftReview = draft ? <section className="ss-panel ss-draft-review" aria-label="Review sound draft"><h2>Review sound draft</h2><p className="ss-draft-name"><strong>{draft.patch.name}</strong><span>{EVENT_LABELS[draft.event]} · {draft.background?'Generated draft':'Imported JSON'}</span></p>
    <p className="ss-draft-level" role="status">{!measuredDraft?'Measuring draft level…':measuredDraft.error?`Draft analysis unavailable: ${measuredDraft.error}`:measuredDraft.peakDb===null||measuredDraft.peakDb < -90?'Draft is silent or nearly silent. Check enabled sources, intensity, envelope and filter.':<>Patch peak before master: <strong>{measuredDraft.peakDb.toFixed(1)} dBFS</strong>{quietDraft?' · Very quiet. Balance the draft level, then audition.':''}</>}</p>
    {theme.masterGain===0&&<p className="ss-disabled">Master output is silent. Raise Master output in the inspector to hear the draft.</p>}
    {(!draft.current())&&<p className="ss-disabled">Selection or source revision changed. Request a fresh draft.</p>}
    <DraftEditor key={draft.requestId} identity={draft.requestId} patch={draft.patch} onChange={editDraft} disabled={!draft.current()||balancingDraft}/><div className="ss-header-actions"><button type="button" disabled={!draft.current()||balancingDraft} onClick={auditionDraft}>▶ Audition draft</button><button type="button" disabled={!draftPlaying} onClick={()=>{if(draftTimer.current)clearTimeout(draftTimer.current);void draftEngine.current?.dispose();draftEngine.current=null;setDraftPlaying(false);setNotice('Draft preview stopped.');}}>Stop draft preview</button>{quietDraft&&<button type="button" disabled={!draft.current()||balancingDraft} title="Targets −18 dBFS before master. Adjusts gain, then source levels or intensity only if needed. Review and accept to apply." onClick={balanceDraft}>{balancingDraft?'Balancing…':'Balance draft level'}</button>}<button type="button" disabled={!draft.current()||balancingDraft} onClick={()=>{if(!draft.current())return;try{const next=validateSoundPatch(draft.patch);if(!draft.current())return;stopForImport();store.endGesture();if(update(next)){if(draft.background)backgroundDrafts?.dismiss();setNotice('Draft accepted into the original sound.');}else setError(`Draft imported in memory, but local saving could not be verified. Export JSON before closing. ${store.state.error}`);}catch(e){showError(e);}}}>Accept draft</button><button type="button" onClick={()=>{void draftEngine.current?.dispose();draftEngine.current=null;setDraftPlaying(false);if(draft.background)backgroundDrafts?.dismiss();setDraft(null);}}>Discard</button></div></section>:null;
  return <div data-sound-studio className="ss-root" ref={rootRef}>
    <StudioTopbar taskNavigation={taskNavigation} documentName={theme.name} saveStatus={saveStatus} unsaved={unsavedProject}
      saveAction={<button type="button" onClick={saveProject}>Save project</button>}
      documentActions={<><button type="button" onClick={newProject}>New project</button><button type="button" onClick={()=>{setLibraryTab('projects');setLibraryOpen(true);}}>Projects</button><button type="button" disabled={!state.canUndo} onClick={()=>{if(!store.undo())showError(store.state.error||'Undo unavailable.');}}>Undo</button><button type="button" disabled={!state.canRedo} onClick={()=>{if(!store.redo())showError(store.state.error||'Redo unavailable.');}}>Redo</button>
        {onUseInCompose&&<button type="button" onClick={onUseInCompose}>Use this sound in Compose</button>}{importControl}<details className="ss-menu"><summary>Export</summary><div>{exportControls}</div></details>
        <details className="ss-document-details"><summary>Project details</summary><div><span className="ss-dim"><small>Palette:</small> {paletteName}</span><span className="ss-dim"><small>Editing event:</small> {EVENT_LABELS[selected]}</span><small>Local instrument · no device theme is applied.</small></div></details><details className="ss-document-details"><summary>Save help</summary><p>{state.error?'Edits not verified in local storage. Export before closing.':state.dirty?'Recovery draft autosaved locally, not a saved project.':'Save project keeps all six event sounds and render settings locally.'} Renaming saves a separate named project; existing work is kept.</p></details></>}
      viewActions={<>{backgroundDrafts&&<button type="button" aria-label="Sound Draft" className="ss-draft-open" aria-haspopup="dialog" aria-expanded={focusedOverlay==='draft'} onClick={e=>openOverlay('draft',e.currentTarget)}>Sound Draft{generated.busy?' · Working':generated.status==='ready'?' · Ready':''}</button>}<details className="ss-studio-help"><summary aria-label="Sound Design help">?</summary><div><h3>Sound Design</h3><p>Choose an event and style, shape parameters, then Audition and Save. Studio editing and selection stay silent. Audition enables local preview; Enable desktop sounds in Event assignment applies the six patches to Hermes.</p><p>Drag knobs or filled bars to adjust. Numeric readouts edit on click. LCD pills scrub vertically; double-click or Enter to type. Shift speeds up scrubbing. The root pill accepts note names such as A3 and C♯4.</p><p>The XY pad maps vertical movement to logarithmic cutoff and horizontal movement to Resonance or Voice drive. Drive is before the filter and independent of FX saturation.</p><p>Each chord interval creates a voice. Oscillator Tune and Fine detune act within each voice; Pan positions a source in stereo. Unison spread adds a normalized second oscillator at ± the displayed cents. Mono output ignores source pan.</p><p>Source levels feed sound gain and then master output. Intensity sets velocity strength before gain. Dry duration includes release; rendered buffers include effect-tail allowance. Live meters show actual output during Audition; Sound analysis describes the rendered buffer.</p></div></details><LiveScope engine={instance}/><div className="ss-segment" role="group" aria-label="Editing mode"><button type="button" aria-pressed={state.mode==='beginner'} onClick={()=>switchMode('beginner')}>Beginner</button><button type="button" aria-pressed={state.mode==='advanced'} onClick={()=>switchMode('advanced')}>Advanced</button></div><button type="button" className="ss-inspector-open" aria-expanded={inspectorOpen} aria-controls="ss-inspector" onClick={()=>setInspectorOpen(!inspectorOpen)}>{inspectorOpen?'Hide inspector':'Inspector'}</button></>}/>
    <ParameterScope key={`${scopeKey??'studio'}:${selected}`} identity={`${scopeKey??'studio'}:${selected}`}><div className="ss-shell">
      {confirmation.prompt}
      <div className="ss-feedback">{state.error&&<div className="ss-alert" role="alert">{state.error}</div>}
      {error&&error!==state.error&&<div className="ss-alert" role="alert">{error}</div>}
      {audio.error&&audio.error!==error&&<div className="ss-alert" role="alert">Studio preview: {audio.error}</div>}
      {!state.error&&notice&&<div className="ss-notice" role="status">{notice}</div>}</div>
      <div className="ss-workspace" data-library-open={libraryOpen} data-inspector-open={inspectorOpen}>
        <aside className="ss-library" aria-label="Preset and event library">
          <div className="ss-library-head"><strong>LIBRARY</strong><button type="button" className="ss-library-close" onClick={()=>setLibraryOpen(false)} aria-label="Close library">×</button></div>
          <nav className="ss-library-destinations" aria-label="Library destinations" role="tablist">{(['events','presets','projects','palettes'] as const).map(tab=><button key={tab} id={`ss-library-tab-${tab}`} type="button" role="tab" aria-selected={libraryTab===tab} aria-controls={`ss-library-${tab}`} onClick={()=>setLibraryTab(tab)}>{tab[0].toUpperCase()+tab.slice(1)}</button>)}</nav>
          <section className="ss-library-section" id="ss-library-events" role="tabpanel" aria-labelledby="ss-library-tab-events" hidden={libraryTab!=='events'}><h2>Event assignment</h2>{desktopTarget&&<DesktopSoundControls target={desktopTarget}/>}<p className="ss-muted">Select an event to edit its assigned sound.</p><EventPicker selected={selected} theme={theme} onSelect={select} onPlay={audition} playable={isPlayable}/></section>
          <section className="ss-library-section" id="ss-library-palettes" role="tabpanel" aria-labelledby="ss-library-tab-palettes" hidden={libraryTab!=='palettes'}><h2>Sound palette library</h2><p className="ss-muted">Replace all six sounds. Project name and master output are retained.</p><div className="ss-palette-list">{STUDIO_PALETTES.map((pal,i)=><button type="button" key={`${pal.name}-${i}`} className="ss-palette" onClick={()=>replace(pal,'palette')}><span className="ss-palette-art" aria-hidden="true">{['◐','≋','◇','✦','⌁'][i%5]}</span><span><strong title={pal.name}>{pal.name}</strong><small>Six event sounds</small></span></button>)}</div></section>
          <section className="ss-library-section" id="ss-library-presets" role="tabpanel" aria-labelledby="ss-library-tab-presets" hidden={libraryTab!=='presets'}><h2>Custom presets</h2><p className="ss-muted">One sound only. Load into the selected {EVENT_LABELS[selected]} event.</p><label htmlFor="ss-preset-name">Preset name</label><input id="ss-preset-name" type="text" maxLength={80} value={presetName} onChange={e=>setPresetName(e.target.value)}/><button type="button" onClick={()=>{try{if(store.savePreset(presetName)){setNotice('Selected sound saved as a custom preset.');setError('');}else showError(store.state.error||'Preset save failed.');}catch(e){showError(e);}}}>Save selected sound as preset</button><div className="ss-saved-list">{state.presets.map(row=><button type="button" key={row.id} onClick={()=>loadPreset(row.id)}>{row.name}</button>)}{!state.presets.length&&<small>No custom presets saved yet.</small>}</div></section>
          <section className="ss-library-section" id="ss-library-projects" role="tabpanel" aria-labelledby="ss-library-tab-projects" hidden={libraryTab!=='projects'}><h2>Projects</h2><p className="ss-muted">A project owns all six event sounds and render settings.</p><label htmlFor="ss-toolbar-project-name">Project name</label><input id="ss-toolbar-project-name" type="text" maxLength={80} value={projectName} onChange={e=>setProjectName(e.target.value)}/><p className="ss-muted">Use Save project above. Renaming saves a separate named project; existing work is kept.</p><h3>Saved projects</h3><div className="ss-saved-list">{state.projects.map(row=><button key={row.id} type="button" onClick={()=>loadProject(row.id)}>{row.name}</button>)}{!state.projects.length&&<small>No saved projects yet.</small>}</div><p className="ss-muted">Import JSON theme or selected sound with the Import JSON action beside Save project above.</p><SelectControl id="ss-sample-rate" label="Render sample rate" help="Rate used for local PCM rendering." value={String(theme.sampleRate)} options={['44100','48000','96000']} onChange={v=>{try{if(!store.setTheme({...store.state.theme,sampleRate:Number(v) as SoundTheme['sampleRate']}))throw Error(store.state.error||'Sample rate was not saved.');setError('');}catch(e){showError(e);}}}/></section>
        </aside>
        <main className="ss-instrument" data-quick={state.mode==='beginner'}><div className="ss-instrument-head"><div><span className="ss-eyebrow">EDITING / {EVENT_LABELS[selected]}</span><h2>{patch.name}</h2></div><button type="button" className="ss-library-open" title="Toggle Library to give the editor more space" aria-expanded={libraryOpen??undefined} onClick={e=>{const wide=(e.currentTarget.closest('.ss-workspace')?.clientWidth??0)>1100;setLibraryOpen(!(libraryOpen??wide));}}>Library ↔</button></div>
          <section className="ss-analysis" aria-label="Sound analysis summary" data-open={analysisOpen}><div className="ss-analysis-summary"><button className="ss-analysis-toggle" type="button" aria-expanded={analysisOpen} aria-controls="ss-inline-analysis" onClick={()=>setAnalysisOpen(!analysisOpen)}><span aria-hidden="true">{analysisOpen?'▾':'▸'}</span> Sound analysis · {analysisOpen?'Hide plot':'Show plot'}</button>{state.mode==='beginner'&&<span className="ss-analysis-plain">Note incl. fade-out: {patch.duration.toFixed(2)} s · {theme.masterGain===0?'Master output is silent':analysis?(analysis.peakDb===null?'Rendered sound is silent':'Sound rendered locally'):analysisState}</span>}<div className="ss-analysis-readings" hidden={state.mode==='beginner'}>{analysisReadings}</div>{state.mode==='beginner'&&measurementDetails}</div><div id="ss-inline-analysis" hidden={!analysisOpen||focusedOverlay==='analysis'}>{analysisPlot}</div></section>
          <AuditionTransportBar playback={<PlaybackPosition engine={instance} event={selected} analysis={analysis}/>} onEnable={enableAudio} enabled={audio.enabled&&audio.contextState==='running'} duration={patch.duration} renderedDuration={analysis?.duration} masterSilent={theme.masterGain===0} pendingAuditions={pendingAuditions} status={audio.error?'error':audio.contextState==='uninitialized'?'off':audio.contextState} playable={isPlayable} muted={audio.muted} activeVoices={audio.activeVoices} onPlay={()=>audition(selected)} onStop={()=>{consentId.current++;setPendingAuditions(0);instance.stopAll();setNotice('Studio preview stopped.');}} onMute={toggleMute}/>
          {state.mode==='beginner'?<div className="ss-editor ss-quick-editor" key={selected}><BeginnerControls patch={patch} edit={edit} begin={beginGesture} end={endGesture}/><StudioXyPad patch={patch} edit={edit} begin={beginGesture} end={endGesture}/><button type="button" className="ss-more" onClick={()=>switchMode('advanced')}>Open Advanced controls</button></div>:<div className="ss-editor-area"><EditorNavigation selected={editorTab} onSelect={setEditorTab}/><div className="ss-editor-content">
          <div className="ss-editor" id="ss-editor-panel" key={selected} role="tabpanel" aria-labelledby={`ss-editor-tab-${editorTab}`}>
            {editorTab===0&&<OscillatorModule patch={patch} edit={edit} begin={beginGesture} end={endGesture}/>}
            {editorTab===1&&<AdsrEditor patch={patch} sampleRate={theme.sampleRate} edit={edit} begin={beginGesture} end={endGesture}/>}
            {editorTab===2&&<div className="ss-editor-stack"><LfoModule patch={patch} edit={edit} begin={beginGesture} end={endGesture}/><section className="ss-panel ss-module ss-matrix"><div className="ss-section-head"><h2>Modulation matrix</h2><button type="button" onClick={e=>openOverlay('matrix',e.currentTarget)}>Focus matrix</button></div>{focusedOverlay!=='matrix'&&<ModulationMatrix patch={patch} edit={edit} begin={beginGesture} end={endGesture}/>}</section></div>}
            {editorTab===3&&<div className="ss-editor-stack"><h2>Effects chain</h2><EffectsRack patch={patch} selectedEffect={selectedEffect} onSelectedEffectChange={setSelectedEffect} sampleRate={theme.sampleRate} onEdit={update} onUndo={()=>{if(!store.undo())showError(store.state.error||'Undo unavailable.');}}/></div>}
            {editorTab===4&&focusedOverlay!=='routing'&&<RoutingGraph patch={patch} onNavigate={navigateEditor} onExpand={opener=>{if(opener)openOverlay('routing',opener);}}/>}
          </div></div></div>}
        </main>
        <aside className="ss-inspector" id="ss-inspector" aria-label="Playback and output inspector"><div className="ss-inspector-head"><strong>INSPECTOR</strong><button type="button" onClick={()=>setInspectorOpen(false)} aria-label="Close inspector">×</button></div>{state.mode==='beginner'&&<p className="ss-muted">{theme.masterGain===0?'Master output is silent. Open Output details to change it.':'Master output is on. These settings affect loudness and channels.'}</p>}<OutputDetails className="ss-output-details">{state.mode==='beginner'&&<summary>Output details</summary>}<section className="ss-panel"><h2>Playback behavior</h2><p className="ss-muted">Plays once per event.</p><NumericControl id="ss-gain" label="Sound gain" help="Decibels for this event after source levels and intensity, before master output." value={patch.playback.gainDb} min={-24} max={6} step={.5} unit=" dB" onChange={v=>edit(p=>({...p,playback:{...p.playback,gainDb:v}}))}/><SelectControl id="ss-stereo" label="Channels" help="Mono or stereo event output. Polyphony and retrigger are not available in v1." value={patch.playback.stereo} options={['Mono','Stereo']} onChange={v=>edit(p=>({...p,playback:{...p.playback,stereo:v}}))}/></section><section className="ss-module"><h2>Master output</h2><p className="ss-gain-hierarchy">Source levels → sound gain → master output</p><ToggleControl id="ss-master-silent" label="Silent master output (−∞ dB)" checked={theme.masterGain===0} onChange={silent=>setMaster(silent?0:previousMaster.current)}/>{theme.masterGain>0&&<NumericControl id="ss-master" label="Master gain" help="Decibels applied to all sounds after event gain. Silent master is exact zero, not a finite dB floor." value={gainToDb(theme.masterGain)!} min={Math.min(-60,gainToDb(theme.masterGain)!)} max={gainToDb(1.5)!} step={.1} unit=" dB" onChange={db=>setMaster(dbToGain(db))}/>}<p className="ss-muted">{theme.masterGain===0?'−∞':(20*Math.log10(theme.masterGain)).toFixed(1)} dB equivalent · applies to all events.</p></section></OutputDetails></aside>
      </div>
      <Dialog open={focusedOverlay!==null} onOpenChange={open=>{if(!open)setFocusedOverlay(null);}}><DialogContent className="ss-focused-overlay" data-kind={focusedOverlay} onCloseAutoFocus={e=>{e.preventDefault();const destination=navigationDestination.current;if(destination){navigationDestination.current=null;overlayOpener.current=null;overlayKind.current=null;const current=captureCurrent();requestAnimationFrame(()=>{if(current())focusEditorTarget(destination);});return;}const opener=overlayOpener.current,kind=overlayKind.current;overlayOpener.current=null;overlayKind.current=null;if(opener?.isConnected)opener.focus();else if(rootRef.current?.isConnected&&kind==='routing')rootRef.current.querySelector<HTMLButtonElement>('.ss-routing .ss-canvas-controls button:last-child')?.focus();else rootRef.current?.querySelector<HTMLButtonElement>('.ss-preview-open')?.focus();}}><DialogHeader><DialogTitle>{focusedOverlay==='matrix'?'Modulation matrix':focusedOverlay==='routing'?'Signal routing':focusedOverlay==='analysis'?'Sound analysis':focusedOverlay==='draft'?'Sound Draft':'Local preview'}</DialogTitle></DialogHeader><div data-sound-studio className="ss-overlay-body">{focusedOverlay==='matrix'?<ModulationMatrix patch={patch} edit={edit} begin={beginGesture} end={endGesture}/>:focusedOverlay==='routing'?<RoutingGraph patch={patch} onNavigate={navigateEditor}/>:focusedOverlay==='analysis'?<div className="ss-expanded-analysis">{analysisPlot}{state.mode==='beginner'?measurementDetails:<p className="ss-analysis-explanation">{timingExplanation}</p>}</div>:focusedOverlay==='preview'?<div className="ss-preview-body">{error&&<p className="ss-alert" role="alert">{error}</p>}{draftReview}<LocalDeviceDemo enabled={isPlayable} onPlay={event=>audition(event as SoundEvent)}/><details className="ss-panel ss-draft ss-secondary"><summary>Import sound JSON</summary><div className="ss-secondary-body"><p className="ss-muted">Validated patch only. Review before replacing the selected sound.</p><label htmlFor="ss-sound-json">SoundPatch/v1 JSON</label><textarea id="ss-sound-json" value={soundJson} maxLength={100000} onChange={e=>setSoundJson(e.target.value)} placeholder="Paste SoundPatch/v1 JSON"/><button type="button" disabled={!soundJson.trim()||generated.busy} onClick={reviewSoundJson}>Review sound JSON</button></div></details></div>:focusedOverlay==='draft'?<div className="ss-draft-session" data-ready={!!draft}><p>Describe a sound. Hermes designs it in a background conversation, then you can fine tune and audition it here before applying.</p><label htmlFor="ss-description">Describe the sound</label><textarea id="ss-description" value={draftText} maxLength={1500} onChange={e=>setDraftText(e.target.value)} placeholder="e.g. a soft, warm confirmation with a short glassy tail"/><div className="ss-header-actions"><button type="button" disabled={generated.busy||!draftText.trim()||!backgroundDrafts} onClick={request}>{generated.busy?'Designing…':'Generate sound'}</button>{generated.busy&&<button type="button" disabled={generated.status==='cancelling'} onClick={()=>backgroundDrafts?.cancel()}>Cancel draft</button>}</div>{generated.busy&&<p className="ss-draft-progress" role="status">{generated.stage}</p>}{(error||generated.error)&&<p className="ss-alert" role="alert">{error||generated.error}</p>}{draftReview}<details className="ss-draft-manual"><summary>Import JSON instead</summary><label htmlFor="ss-draft-result">Returned SoundPatch/v1 JSON</label><textarea id="ss-draft-result" value={soundJson} maxLength={100000} onChange={e=>setSoundJson(e.target.value)} placeholder="Paste SoundPatch/v1 JSON"/><button type="button" disabled={!soundJson.trim()||generated.busy} onClick={reviewSoundJson}>Review sound JSON</button></details>{generated.status==='error'&&generated.raw&&<details><summary>View returned JSON</summary><textarea readOnly aria-label="Model response" value={generated.raw}/></details>}</div>:null}</div></DialogContent></Dialog>

      <div className="ss-preview"><button type="button" className="ss-preview-open" aria-haspopup="dialog" aria-expanded={focusedOverlay==='preview'} onClick={e=>openOverlay('preview',e.currentTarget)}>Preview · local device demo</button></div>
      <footer className="ss-footer">{desktopTarget ? 'Preview is local · enable Hermes Desktop in Event assignment to apply these sounds.' : 'Local studio preview only. No device sync.'}</footer>
    </div></ParameterScope>
  </div>;
}



