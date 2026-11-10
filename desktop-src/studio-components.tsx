import React from 'react';
import { HelpTip } from './help';
import {CanvasSpectrogram} from './studio-spectrogram';
import {formatParameter,formatParameterScale,parameterAngle,parameterArc,parameterDraftError,parameterPosition,snapParameter,validParameterRange} from './studio-parameter-model';
import type { SoundEvent } from '../assets/studio-engine';

export type PcmAnalysis = {
  waveform: number[]; spectrum: number[]; spectrogram: number[][];
  peakDb: number | null; rmsDb: number | null; duration: number; sampleRate: number;
};
const bound = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const dbfs = (db: number | null) => db === null ? 'Silence (−∞ dBFS)' : `${db.toFixed(1).replace('-', '−')} dBFS`;
const hz = (frequency: number) => frequency >= 1000 ? `${Number((frequency / 1000).toFixed(2))} kHz` : `${Number(frequency.toFixed(1))} Hz`;

/** Absolute per-channel PCM measurements; the plotted waveform uses mono window maxima. */
export function AnalysisLevelSummary({analysis}: {analysis:PcmAnalysis}) {
  return <div className="ss-analysis-levels" role="group" aria-label="Absolute digital PCM levels"><span>Peak (channels): <strong>{dbfs(analysis.peakDb)}</strong></span><span>RMS (channels): <strong>{dbfs(analysis.rmsDb)}</strong></span></div>;
}

/** analyzePcm: max mono |sample| in time bins; 32 starts of 256-sample Hann DFT windows. */
export function SoundPlot({ analysis, kind, label, emptyMessage='Rendering local audio…', frequencyMax, detailDisclosure=false }: { analysis: PcmAnalysis | null; kind: 'waveform'|'spectrum'|'spectrogram'; label: string; emptyMessage?:string; frequencyMax?:number; detailDisclosure?:boolean }) {
  if (!analysis) return <div className="ss-plot ss-empty" role="status">{emptyMessage}</div>;
  if (kind==='spectrogram') return <CanvasSpectrogram analysis={analysis} label={label} frequencyMax={frequencyMax} detailDisclosure={detailDisclosure}/>;
  // Opt in only for Beginner; other consumers retain their complete scientific caption.
  const caption=(details:React.ReactNode,plain:string)=><figcaption className="ss-plot-caption">{detailDisclosure?<><p>{plain}</p><details className="ss-plot-details"><summary>Details</summary>{details}</details></>:details}</figcaption>;
  const duration=Number.isFinite(analysis.duration) ? analysis.duration : 0;
  const sampleRate=Number.isFinite(analysis.sampleRate) && analysis.sampleRate>0 ? analysis.sampleRate : 0;
  const bins=kind==='waveform'?analysis.waveform.length:analysis.spectrum.length;
  // Crop existing bins only. The original bin count defines spacing, never the cropped count.
  const binSpacing=bins>0 ? sampleRate/(2*bins) : 0;
  const limit=frequencyMax!==undefined && Number.isFinite(frequencyMax) && frequencyMax>=0 ? frequencyMax : Infinity;
  const visibleBins=kind==='waveform' ? bins : Array.from({length:bins},(_,i)=>i).filter(i=>i*binSpacing<=limit).length;
  const highestHz=visibleBins>0 ? (visibleBins-1)*binSpacing : 0;
  const samplingNote=<>Bin spacing: {hz(binSpacing)}. No new resolution or zero-padded bins; this view only crops existing samples.</>;

  const values=kind==='waveform' ? analysis.waveform:analysis.spectrum.slice(0,visibleBins);
  if (!values.length) return <div className="ss-plot ss-empty">No {kind} data in this render.</div>;
  const stride=Math.max(1,Math.ceil(values.length/240));
  const sampleIndices=values.map((_,i)=>i).filter(i=>i%stride===0);
  if(sampleIndices.at(-1)!==values.length-1)sampleIndices.push(values.length-1);
  const samples=sampleIndices.map(i=>values[i]);
  const x=(index:number)=>(values.length===1?0:index/(values.length-1)*600).toFixed(1);
  const max=Math.max(0,...(kind==='waveform'?analysis.waveform:analysis.spectrum));
  const scale=max||1;
  const top=samples.map((v,i)=>`${x(sampleIndices[i])},${(56-bound(v/scale)*48).toFixed(1)}`).join(' ');
  const bottom=samples.map((v,i)=>`${x(sampleIndices[i])},${(56+bound(v/scale)*48).toFixed(1)}`).reverse().join(' ');
  const points=samples.map((v,i)=>`${x(sampleIndices[i])},${(100-bound(v/scale)*88).toFixed(1)}`).join(' ');
  const wave=kind==='waveform';
  return <figure className="ss-analysis-figure" aria-label={`${label} from rendered PCM`}>
    <div className="ss-plot-frame"><div className="ss-plot-y"><span>100%</span><span>{wave?'|Amplitude| · 0 at center':'Relative magnitude'}</span><span>{wave?'100%':'0%'}</span></div>
      <svg className="ss-plot" viewBox="0 0 600 112" preserveAspectRatio="none" role="img" aria-label={`${label}: ${wave?'absolute mono window maxima, display relative to waveform peak':'mean magnitude across 32 DFT windows, relative to strongest sampled bin'}`}>
        <line x1="0" y1={wave?56:100} x2="600" y2={wave?56:100} className="ss-axis" />
        {wave?<polygon points={`${top} ${bottom}`} className="ss-wavefill"/>:values.length===1?<circle cx="0" cy={100-bound(values[0]/scale)*88} r="3" className="ss-signal"/>:<polyline points={points} className="ss-signal" />}
      </svg></div>
    <div className="ss-plot-x"><span>{wave?'0 s':'0 Hz'}</span><span>{wave?'Time (s)':'Frequency (Hz)'}</span><span>{wave?`${duration.toFixed(2)} s`:hz(highestHz)}</span></div>
    {caption(wave?<>Max absolute mono sample in each time bin · Relative to waveform peak (100% = {Number(max.toFixed(3))} full scale). Mirrored envelope; lower half is not negative PCM. <AnalysisLevelSummary analysis={analysis}/></>:<>256-sample Hann-windowed DFT · average of 32 windows; {max===0?'No energy in sampled bins.':'Relative magnitude (strongest sampled bin in full data = 100%).'} Not calibrated dBFS. {samplingNote}</>,wave?'Shape only: height is rescaled, not a loudness meter.':max===0?'No energy in sampled bins. Height is relative, not a loudness meter.':'Relative frequency strength: height is rescaled, not a loudness meter.')}
  </figure>;
}

type ParameterValueProps = {id:string;label:string;value:number;min:number;max:number;step:number;unit?:string;disabled?:boolean;scopeIdentity?:string;onChange:(value:number)=>void};
type ParameterControlProps = ParameterValueProps & {help:string;onGestureStart?:()=>void;onGestureEnd?:()=>void};
const ParameterScopeContext=React.createContext('');
/** Event/layer identity must be supplied even when its numeric values are identical. */
export function ParameterScope({identity,children}:{identity:string;children:React.ReactNode}) {
  return <ParameterScopeContext.Provider value={identity}>{children}</ParameterScopeContext.Provider>;
}
function useParameterScope(identity?:string) {return JSON.stringify([React.useContext(ParameterScopeContext),identity??'']);}
function useParameterGesture(value:number,scope:string,disabled:boolean,onStart?:()=>void,onEnd?:()=>void) {
  const active=React.useRef<{y:number;value:number;node:HTMLElement;pointerId:number}|null>(null);
  const callbacks=React.useRef({onStart,onEnd});callbacks.current={onStart,onEnd};
  const finish=React.useCallback(()=>{
    const gesture=active.current;if(!gesture)return;active.current=null;
    if(gesture.node.hasPointerCapture(gesture.pointerId))gesture.node.releasePointerCapture(gesture.pointerId);
    callbacks.current.onEnd?.();
  },[]);
  React.useLayoutEffect(()=>{if(disabled)finish();return finish;},[scope,disabled,finish]);
  const begin=(event:React.PointerEvent<HTMLElement>)=>{
    if(disabled||active.current||event.button!==0)return;
    active.current={y:event.clientY,value,node:event.currentTarget,pointerId:event.pointerId};
    event.currentTarget.setPointerCapture(event.pointerId);callbacks.current.onStart?.();
  };
  return {active,begin,finish};
}
function parameterKey(event:React.KeyboardEvent,props:ParameterValueProps,change:(value:number)=>void) {
  if(props.disabled)return;
  const direction=event.key==='ArrowUp'||event.key==='ArrowRight'?1:event.key==='ArrowDown'||event.key==='ArrowLeft'?-1:0;
  if(direction){event.preventDefault();change(props.value+direction*props.step*(event.shiftKey?10:1));}
  else if(event.key==='Home'||event.key==='End'){event.preventDefault();change(event.key==='Home'?props.min:props.max);}
}
export function NumericControl(props:ParameterControlProps) {
  const {id,label,help,value,min,max,step,unit='',onChange,onGestureStart,onGestureEnd,scopeIdentity}=props;
  const domId=`${id}-${React.useId()}`;
  const scope=useParameterScope(scopeIdentity);
  const disabled=!!props.disabled||!validParameterRange(props)||min===max;
  const gesture=useParameterGesture(value,scope,disabled,onGestureStart,onGestureEnd);
  const bipolar=min<0&&max>0;
  const zero=bipolar?parameterPosition(0,props)*100:0;
  const position=parameterPosition(value,props)*100;
  const amount=formatParameter(value,props,unit);
  const change=(next:number)=>{if(disabled||!Number.isFinite(next))return;const snapped=snapParameter(next,props);if(snapped!==value)onChange(snapped);};
  return <div className="ss-control ss-numeric-control" data-bipolar={bipolar}><div className="ss-control-head"><label htmlFor={domId}>{label}</label><HelpTip id={`${domId}-tip`} label={label}>{help}</HelpTip><div className="ss-numeric-amount"><ParameterValue {...props} disabled={disabled}/></div></div>
    <div className="ss-range-track" style={{'--ss-zero':`${zero}%`,'--ss-zero-inset':`${8-16*zero/100}px`,'--ss-fill-start':`${Math.min(zero,position)}%`,'--ss-fill-end':`${Math.max(zero,position)}%`} as React.CSSProperties}>
      <input id={domId} data-parameter-id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={amount} disabled={disabled} onPointerDown={gesture.begin} onPointerUp={gesture.finish} onPointerCancel={gesture.finish} onLostPointerCapture={gesture.finish} onChange={event=>change(Number(event.target.value))} onKeyDown={event=>parameterKey(event,{...props,disabled},change)}/>
      {bipolar&&<span className="ss-zero-marker" aria-hidden="true"/>}
    </div>
    {bipolar&&<div className="ss-range-labels" aria-hidden="true" style={{'--ss-zero':`${zero}%`} as React.CSSProperties}><span>{formatParameterScale(min,props)}</span><span className="ss-range-zero">0</span><span>{formatParameterScale(max,props)}</span></div>}
  </div>;
}
/** Compact LCD-style value: vertical scrubbing, keyboard steps, double-click typing. */
export function DragValue(props:ParameterValueProps&{display?:(value:number)=>string;parse?:(text:string)=>number;onGestureStart?:()=>void;onGestureEnd?:()=>void}) {
  const {value,min,max,step,label,onChange,display}=props,scope=useParameterScope(props.scopeIdentity);
  const gesture=useParameterGesture(value,scope,!!props.disabled,props.onGestureStart,props.onGestureEnd);
  const [editing,setEditing]=React.useState(false),[draft,setDraft]=React.useState('');
  const input=React.useRef<HTMLInputElement>(null);
  React.useLayoutEffect(()=>setEditing(false),[scope,props.id,value,min,max,step,props.disabled]);
  React.useEffect(()=>{if(editing){input.current?.focus();input.current?.select();}},[editing]);
  const change=(v:number)=>{if(!props.disabled)onChange(snapParameter(v,props));};
  const parsed=props.parse?String(props.parse(draft)):draft;
  const error=editing?parameterDraftError(parsed,props):'';
  const commit=()=>{if(!error){setEditing(false);if(Number(parsed)!==value)onChange(Number(parsed));}};
  const startEditing=()=>{setDraft(props.parse&&display?display(value):String(Number(value.toFixed(8))));setEditing(true);};
  return <div className="ss-drag-value" data-editing={editing} title={`${label}: drag vertically, double-click or press Enter to type`}>
   <small>{label}</small>{editing?<input ref={input} aria-label={`${label} value`} aria-invalid={!!error} type="text" inputMode="decimal" value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')commit();if(e.key==='Escape'){e.stopPropagation();setEditing(false);}}}/>:<button type="button" role="spinbutton" aria-label={label} aria-valuenow={value} aria-valuemin={min} aria-valuemax={max} aria-valuetext={display?.(value)??formatParameter(value,props,props.unit)} disabled={props.disabled} onDoubleClick={startEditing} onPointerDown={gesture.begin} onPointerMove={e=>{const g=gesture.active.current;if(g?.pointerId===e.pointerId&&Math.abs(g.y-e.clientY)>3){change(g.value+Math.round((g.y-e.clientY)/6)*step*(e.shiftKey?10:1));}}} onPointerUp={gesture.finish} onPointerCancel={gesture.finish} onLostPointerCapture={gesture.finish} onKeyDown={e=>{if(e.key==='Enter'){startEditing();}else parameterKey(e,props,change);}}>{display?.(value)??formatParameter(value,props,props.unit)}</button>}{error&&<small className="ss-input-error" role="alert">{error}</small>}
  </div>;
}
export function ParameterValue(props:ParameterValueProps) {
  const {id,label,value,min,max,step,unit='',onChange,scopeIdentity}=props;
  const domId=`${id}-value-${React.useId()}`;
  const hintId=`${id}-value-hint-${domId}`;
  const scope=useParameterScope(scopeIdentity);
  const disabled=!!props.disabled||!validParameterRange(props)||min===max;
  const [draft,setDraft]=React.useState<string|null>(null);
  const currentDraft=React.useRef<string|null>(null);
  const input=React.useRef<HTMLInputElement>(null),readout=React.useRef<HTMLButtonElement>(null);
  const restoreFocus=React.useRef(false);
  const update=(next:string|null)=>{currentDraft.current=next;setDraft(next);};
  React.useLayoutEffect(()=>{update(null);},[id,value,min,max,step,scope,disabled]);
  const editing=draft!==null;
  React.useLayoutEffect(()=>{
    if(editing){input.current?.focus();input.current?.select();}
    else if(restoreFocus.current){restoreFocus.current=false;readout.current?.focus();}
  },[editing]);
  const error=draft===null?'':parameterDraftError(draft,props);
  const finish=(focus:boolean)=>{
    const text=currentDraft.current;if(disabled||text===null||parameterDraftError(text,props))return;
    const next=Number(text);restoreFocus.current=focus;update(null);
    if(next!==value)onChange(next);
  };
  return <div className="ss-parameter-value"><span>{label}</span><span>{editing?
    <input ref={input} id={domId} data-parameter-id={id} aria-label={`${label} value`} aria-invalid={!!error} aria-describedby={hintId} type="text" inputMode="decimal" value={draft} disabled={disabled} onChange={event=>{if(!disabled)update(event.target.value);}} onBlur={()=>finish(false)} onKeyDown={event=>{if(disabled)return;if(event.key==='Enter'){event.preventDefault();finish(true);}else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();restoreFocus.current=true;update(null);}}}/>:
    <button ref={readout} id={domId} className="ss-parameter-readout" type="button" aria-label={`Edit ${label} value`} aria-describedby={hintId} disabled={disabled} onClick={()=>{if(!disabled)update(String(Number(value.toFixed(8))));}}>{formatParameter(value,props,unit)}</button>
    }{editing&&<small>{unit}</small>}</span><small id={hintId} className={error?'ss-input-error':'ss-input-hint'} role={error?'alert':undefined}>{error||`Range ${min} to ${max}; increments of ${step}. Enter to apply; Escape to cancel.`}</small></div>;
}
export function ParameterKnob(props:ParameterControlProps) {
  const {id,label,help,value,min,max,unit='',onChange,onGestureStart,onGestureEnd,scopeIdentity}=props;
  const domId=`${id}-${React.useId()}`;
  const scope=useParameterScope(scopeIdentity);
  const disabled=!!props.disabled||!validParameterRange(props)||min===max;
  const gesture=useParameterGesture(value,scope,disabled,onGestureStart,onGestureEnd);
  const change=(next:number)=>{if(disabled||!Number.isFinite(next))return;const snapped=snapParameter(next,props);if(snapped!==value)onChange(snapped);};
  const angle=parameterAngle(value,props),startAngle=parameterAngle(min<0&&max>0?0:min,props);
  return <div className="ss-knob-control"><div className="ss-knob-head"><span id={`${domId}-label`}>{label}</span><HelpTip id={`${domId}-tip`} label={label}>{help}</HelpTip></div><div className="ss-knob-row">
    <div id={domId} data-parameter-id={id} className="ss-knob" role="slider" tabIndex={disabled?-1:0} aria-labelledby={`${domId}-label`} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={formatParameter(value,props,unit)} aria-disabled={disabled} onPointerDown={gesture.begin} onPointerMove={event=>{const start=gesture.active.current;if(start&&start.pointerId===event.pointerId)change(start.value+(start.y-event.clientY)*(max-min)/140);}} onPointerUp={gesture.finish} onPointerCancel={gesture.finish} onLostPointerCapture={gesture.finish} onKeyDown={event=>parameterKey(event,{...props,disabled},change)}>
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path className="ss-knob-track" d={parameterArc(-135,135)}/><path className="ss-knob-active" data-start-angle={startAngle} data-end-angle={angle} d={parameterArc(startAngle,angle)}/><circle className="ss-knob-face" cx="24" cy="24" r="14"/><line className="ss-knob-needle" x1="24" y1="24" x2="24" y2="13" transform={`rotate(${angle} 24 24)`}/></svg>
    </div><ParameterValue {...props} disabled={disabled}/></div></div>;
}

export function ParameterGroup({label,children}:{label:string;children:React.ReactNode}) {return <div className="ss-parameter-flex" role="group" aria-label={label}>{children}</div>;}
export function ModuleCard({title,enabled,children,preview,className=''}:{title:string;enabled?:boolean;children:React.ReactNode;preview?:React.ReactNode;className?:string}) {return <section className={`ss-module-card ${className}`} data-enabled={enabled??'fixed'}><div className="ss-module-card-head"><h3>{title}</h3>{enabled!==undefined&&<small>{enabled?'Enabled':'Off / bypassed'}</small>}</div>{preview&&<div className="ss-module-preview">{preview}</div>}{children}</section>;}
export function ModuleGrid({children}:{children:React.ReactNode}) {return <div className="ss-module-grid">{children}</div>;}
export function ModuleMasonry({children}:{children:React.ReactNode}) {return <div className="ss-module-masonry">{children}</div>;}
export function AuditionTransportBar({duration,status,playable,onPlay,onStop,onMute,onEnable,enabled,muted,activeVoices=0,pendingAuditions=0,renderedDuration,masterSilent=false,playback}:{duration:number;status:string;playable:boolean;onPlay:()=>void;onStop:()=>void;onMute:()=>void;onEnable?:()=>void;enabled?:boolean;muted:boolean;activeVoices?:number;pendingAuditions?:number;renderedDuration?:number;masterSilent?:boolean;playback?:React.ReactNode}) {
  const consentId=`audition-consent-${React.useId()}`;
  // Pending work takes precedence over readiness so Stop remains discoverable.
  const state=status==='error'?'Error':masterSilent?'Silent master':activeVoices>0?'Playing':pendingAuditions>0?'Preparing':status!=='running'?'Audio off':muted?'Muted':'Ready';
  return <div className="ss-transport" aria-label="Studio audition and audio state">
    <div className="ss-transport-actions"><button type="button" className="ss-primary" aria-describedby={consentId} onClick={onPlay} aria-label="Audition" title="Audition · enables local preview">▶</button>
      <button type="button" onClick={onStop} aria-label="Stop preview" title="Stop preview" disabled={activeVoices+pendingAuditions<=0}>■</button>
      <details className="ss-audio-settings"><summary>Audio settings</summary><div className="ss-audio-settings-body">
        {onEnable&&<button type="button" onClick={onEnable} disabled={enabled??status==='running'}>Enable audio</button>}
        <button type="button" aria-pressed={muted} onClick={onMute} disabled={status!=='running'}>{muted?'Unmute':'Mute audio'}</button>
        <small>Enable audio alone is silent; it does not audition a sound.</small>
        <small>Dry note duration (body incl. release): {duration.toFixed(2)} s{renderedDuration!==undefined?` · Rendered buffer incl. tails: ${renderedDuration.toFixed(2)} s`:''}. The rendered buffer allows for chord staggering and effect tails; release is already included in dry note duration. Buffer length is not measured audible duration.</small>
        {masterSilent&&<small>Turn off Silent master output in Inspector to hear sound.</small>}
        {status==='error'&&<small>Retry Audition or check Audio settings.</small>}
      </div></details></div>
    <span className="ss-transport-state" role="status">{state}</span>
    {playback}<small id={consentId} className="ss-audition-consent">Audition enables and unmutes local preview, then plays the selected sound. No host events are enabled.</small>
  </div>;
}

export function EditorNavigation({selected,onSelect}:{selected:number;onSelect:(v:number)=>void}) {return <nav className="ss-editor-tabs" role="tablist" aria-label="Sound editor">{(['Synthesis','Envelope / Shaping','Modulation','Effects','Routing'] as const).map((name,index)=><button key={name} id={`ss-editor-tab-${index}`} role="tab" type="button" aria-selected={selected===index} aria-controls="ss-editor-panel" onClick={()=>onSelect(index)}>{name}</button>)}</nav>;}

export function SelectControl<T extends string>({ id,label,help,value,options,onChange,disabled=false }: {
  id:string;label:string;help:string;value:T;options:readonly T[];disabled?:boolean;onChange:(value:T)=>void;
}) {
  return <div className="ss-control"><div className="ss-control-head"><label htmlFor={id}>{label}</label><HelpTip id={`${id}-tip`} label={label}>{help}</HelpTip></div>
    <select id={id} value={value} disabled={disabled} onChange={e=>onChange(e.target.value as T)}>{options.map(x=><option key={x} value={x}>{x}</option>)}</select></div>;
}

export function ToggleControl({ id,label,checked,onChange }: {id:string;label:string;checked:boolean;onChange:(checked:boolean)=>void}) {
  return <label className="ss-toggle" htmlFor={id}><input id={id} type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span>{label}</span><span className="ss-toggle-state">{checked?'On':'Off'}</span></label>;
}

/** Model preview, not a connection to a desktop or handset. */
export function LocalDeviceDemo({ onPlay, enabled }: {onPlay:(event:SoundEvent)=>void;enabled:boolean}) {
  const title=(action:string)=>enabled?action:`Enable audio and ${action.toLowerCase()}`;
  return <section className="ss-panel ss-demo" aria-labelledby="ss-demo-title">
    <div className="ss-section-head"><span className="ss-icon" aria-hidden="true">◫</span><h2 id="ss-demo-title">Local device demo</h2></div>
    <p className="ss-muted">Preview only. No devices connected. Click a labeled action to audition; hover, focus and navigation are silent.</p>
    <div className="ss-devices"><div className="ss-desktop-frame"><div className="ss-device-top"><i/><i/><span>DESKTOP DEMO</span></div>
      <button type="button" onClick={()=>onPlay('onHover')}>{title('Preview hover sound')}</button>
      <button type="button" onClick={()=>onPlay('onFocus')}>{title('Focus field')}</button>
      <div className="ss-device-actions"><button type="button" onClick={()=>onPlay('onToggle')}>{title('Toggle')}</button><button type="button" onClick={()=>onPlay('onCommit')}>{title('Confirm')}</button></div></div>
      <div className="ss-phone-frame"><span className="ss-phone-notch"/><small>PHONE DEMO</small><button type="button" onClick={()=>onPlay('onError')}>{title('Error')}</button><button type="button" onClick={()=>onPlay('onBackgroundTaskComplete')}>{title('Task done')}</button></div></div>
    {!enabled && <p className="ss-muted">Click a labeled preview action to enable audio and audition it in one gesture.</p>}
  </section>;
}

