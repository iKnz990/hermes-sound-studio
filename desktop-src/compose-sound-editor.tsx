import React, {useState} from 'react';
import type {SoundPatch} from '../assets/studio-engine';
import type {ComposeLayer} from './compose-model';
import {STYLE_OPTIONS, applyStyle} from './studio-data';
import {NumericControl} from './studio-components';
import {OscillatorModule, AdsrEditor, LfoModule} from './studio-modules';
import {ModulationMatrix} from './studio-ui';
import {EffectsRack} from './studio-workspace';

const SECTIONS=['Synthesis','Envelope / Shaping','Modulation','Effects'] as const;


/** Disclosure is local view state; only the supplied edit/Undo callbacks change the layer. */
export function ComposeSoundEditor({layer,edit,onUndo,onClose,begin=()=>{},end=()=>{}}: {
 layer:ComposeLayer;
 edit:(make:(p:SoundPatch)=>SoundPatch)=>void;
 onUndo:()=>void;
 onClose:()=>void;
 begin?:()=>void;
 end?:()=>void;
}): React.ReactElement {
 const [detail,setDetail]=useState<'beginner'|'advanced'>('beginner');
 const [tab,setTab]=useState(0);
 const patch=layer.patch;
 return <section className="cp-drawer cp-sound-editor" aria-label={`Edit sound for ${layer.name}`}>
  <div className="cp-drawer-head">
   <div className="cp-editor-identity"><span className="ss-eyebrow">COMPOSITION LAYER SOUND</span><h2>Edit sound · {layer.name}</h2><p className="ss-muted">Only this layer’s sound changes. Its pattern stays in the composition; event sounds stay untouched.</p></div>
   <button type="button" onClick={onClose}>Close sound editor</button>
  </div>
  <p className="cp-pattern-context"><strong>Pattern controls pitch and timing.</strong> Pattern pitches replace the base pitch. Each note’s beat duration scales a render-only envelope; the saved base envelope shape still matters. Edit notes and lengths in the step grid, not here.</p>
  <div className="cp-editor-controls">
   <label className="cp-editor-name">Sound name<input type="text" aria-label="Composition sound name" value={patch.name} onChange={e=>edit(p=>({...p,name:e.target.value}))}/></label>
   <div className="ss-segment" role="group" aria-label="Compose sound detail">
    <button type="button" aria-pressed={detail==='beginner'} onClick={()=>setDetail('beginner')}>Beginner</button>
    <button type="button" aria-pressed={detail==='advanced'} onClick={()=>setDetail('advanced')}>Advanced</button>
   </div>
  </div>
  {detail==='advanced'&&<nav className="cp-editor-tabs" aria-label="Composition sound modules">{SECTIONS.map((name,i)=><button key={name} type="button" aria-pressed={tab===i} onClick={()=>setTab(i)}>{name}</button>)}</nav>}
  <div className="cp-editor-content">
   {detail==='beginner'?<section className="cp-beginner-sound" aria-label="Shape this layer’s sound">
    <div><h3>Sound character</h3><p className="ss-muted">Choose a style, then set its strength. Advanced edits the same sound in more detail.</p><div className="ss-style-row" role="group" aria-label="Sound style">{STYLE_OPTIONS.map(option=><button key={option.id} type="button" aria-pressed={patch.style===option.id} onClick={()=>edit(p=>applyStyle(p,option.id))}>{option.label}</button>)}</div></div>
    <div className="cp-beginner-intensity"><NumericControl id="cp-sound-intensity" label="Intensity" help="The sound’s velocity strength, also used by Velocity modulation routes. Each pattern note’s velocity scales this value during rendering." value={patch.intensity} min={0} max={100} step={1} unit="%" onGestureStart={begin} onGestureEnd={end} onChange={v=>edit(p=>({...p,intensity:v}))}/><p className="ss-muted">Pattern-note velocity also scales this strength. Use Play loop in the composition transport to listen; editing never starts audio.</p></div>
   </section>:<>
    {tab===0&&<OscillatorModule patch={patch} edit={edit} begin={begin} end={end}/>}
    {tab===1&&<AdsrEditor patch={patch} edit={edit} begin={begin} end={end}/>}
    {tab===2&&<div className="ss-editor-stack"><LfoModule patch={patch} edit={edit} begin={begin} end={end}/><section className="ss-panel"><h3>Modulation matrix</h3><ModulationMatrix patch={patch} edit={edit} begin={begin} end={end}/></section></div>}
    {tab===3&&<div onPointerDownCapture={e=>{if(e.button===0)begin();}} onPointerUpCapture={end} onPointerCancelCapture={end} onLostPointerCapture={end} onBlur={end}><EffectsRack patch={patch} onEdit={next=>edit(()=>next)} onUndo={onUndo}/></div>}
   </>}
  </div>
 </section>;
}
