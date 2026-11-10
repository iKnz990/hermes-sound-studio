import React,{useState} from 'react';
import {getFxParameters,type SoundPatch,FX_PARAMETER_LIMITS,type FxKey} from '../assets/studio-engine';
import {NumericControl,SelectControl,ToggleControl,ParameterScope} from './studio-components';
import {setDuration,setAdsrStage} from './studio-data';

const FX_LABELS:Record<FxKey,string>={eq:'EQ',saturation:'Saturation',compressor:'Compressor',chorus:'Chorus',delay:'Delay',reverb:'Reverb'};
const FX_FIELDS:Record<string,[string,string]>={frequency:['Frequency',' Hz'],gainDb:['Gain',' dB'],q:['Q',''],drive:['Drive',''],thresholdDb:['Threshold',' dB'],ratio:['Ratio',' :1'],attack:['Attack',' s'],release:['Release',' s'],kneeDb:['Knee',' dB'],rate:['Rate',' Hz'],depth:['Depth',' s'],mix:['Wet send',''],time:['Time',' s'],feedback:['Feedback',''],decay:['Decay',' s']};

/** A draft-only editor: all controls edit the candidate, never the assigned event. */
export function DraftEditor({patch,onChange,disabled,identity}:{patch:SoundPatch;onChange:(make:(p:SoundPatch)=>SoundPatch)=>void;disabled:boolean;identity:string}) {
 const [tab,setTab]=useState('Tone');
 const voices=(['osc1','osc2','osc3'] as const).filter(key=>patch[key].enabled);
 const movement=patch.lfo1.enabled||patch.lfo2.enabled||patch.modMatrix.length>0;
 const [generatedEffects]=useState(()=>(Object.keys(patch.fx) as FxKey[]).filter(key=>patch.fx[key]));
 const effects=(Object.keys(patch.fx) as FxKey[]).filter(key=>generatedEffects.includes(key)||patch.fx[key]);
 const tabs=['Tone','Envelope','Voices',...(patch.chords.length>1?['Chords']:[]),...(movement?['Movement']:[]),...(effects.length?['Effects']:[])];
 const selected=tabs.includes(tab)?tab:'Tone';
 const number=(id:string,label:string,value:number,min:number,max:number,step:number,change:(p:SoundPatch,v:number)=>SoundPatch,unit='')=><NumericControl key={id} id={`ft-${id}`} label={label} help={`Fine tune draft ${label.toLowerCase()}. Editing is silent.`} value={value} min={min} max={max} step={step} unit={unit} onChange={v=>onChange(p=>change(p,v))}/>;
 return <ParameterScope identity={identity}><section className="ss-draft-editor" aria-label="Fine tune generated sound"><h3>Fine tune</h3>
  <div className="ss-draft-features" aria-label="Generated features"><span>{voices.length} {voices.length===1?'voice':'voices'} · {voices.map(v=>patch[v].type).join(' + ')||'noise'}</span><span>{patch.chords.length===1?'Single note':`${patch.chords.length}-note chord`}</span><span>{patch.filter.type} filter</span>{movement&&<span>Modulation</span>}{effects.map(fx=><span key={fx}>{FX_LABELS[fx]}</span>)}</div>
  <nav className="ss-draft-tabs" aria-label="Fine tune sections">{tabs.map(name=><button key={name} type="button" aria-pressed={selected===name} onClick={()=>setTab(name)}>{name}</button>)}</nav>
  <fieldset disabled={disabled} className="ss-draft-fields"><legend className="ss-sr-only">Draft {selected.toLowerCase()}</legend>
   {selected==='Tone'&&<>
    {number('pitch','Pitch',patch.baseFreq,40,4000,1,(p,v)=>({...p,baseFreq:v}),' Hz')}
    {number('intensity','Intensity',patch.intensity,0,100,1,(p,v)=>({...p,intensity:v}),'%')}
    {number('gain','Sound gain',patch.playback.gainDb,-24,6,.1,(p,v)=>({...p,playback:{...p.playback,gainDb:v}}),' dB')}
    {number('duration','Duration',patch.duration,.02,2.5,.01,(p,v)=>setDuration(p,v),' s')}
    {number('cutoff','Cutoff',patch.filter.cutoff,40,16000,1,(p,v)=>({...p,filter:{...p.filter,cutoff:v}}),' Hz')}
    {number('resonance','Resonance',patch.filter.res,.1,8,.1,(p,v)=>({...p,filter:{...p.filter,res:v}}))}
    {number('drive','Filter drive',patch.filter.drive,0,10,.1,(p,v)=>({...p,filter:{...p.filter,drive:v}}))}
    <SelectControl id="ft-filter-type" label="Filter type" help="Generated sound filter" value={patch.filter.type} options={['lowpass','highpass','bandpass','notch']} onChange={v=>onChange(p=>({...p,filter:{...p.filter,type:v}}))}/>
    <p className="ss-draft-detail">Chord intervals: {patch.chords.map(n=>`${n>=0?'+':''}${n}`).join(' · ')} semitones · {patch.playback.stereo}</p>
   </>}
   {selected==='Envelope'&&<>
    {(['a','d','r'] as const).map(key=>number(`env-${key}`,({a:'Attack',d:'Decay',r:'Release'})[key],patch.adsr[key],0,({a:1000,d:1500,r:2000})[key],1,(p,v)=>setAdsrStage(p,key,v),' ms'))}
    {number('sustain','Sustain',patch.adsr.s,0,1,.01,(p,v)=>({...p,adsr:{...p.adsr,s:v}}))}
    {number('body','Note duration',patch.duration,.02,2.5,.01,(p,v)=>setDuration(p,v),' s')}
   </>}
   {selected==='Voices'&&<>
    {voices.map((key,index)=><div className="ss-draft-voice" key={key}><h4>Voice {index+1}</h4><SelectControl id={`ft-${key}-wave`} label="Waveform" help="Oscillator shape" value={patch[key].type} options={['sine','triangle','square','sawtooth']} onChange={v=>onChange(p=>({...p,[key]:{...p[key],type:v}}))}/>
     {number(`${key}-level`,'Source level',patch[key].vol,0,1,.01,(p,v)=>({...p,[key]:{...p[key],vol:v}}))}
     {number(`${key}-tune`,'Tune',patch[key].tune,-24,24,1,(p,v)=>({...p,[key]:{...p[key],tune:v}}),' st')}
     {number(`${key}-detune`,'Fine detune',patch[key].detune??0,-100,100,1,(p,v)=>({...p,[key]:{...p[key],detune:v}}),' cents')}
     {number(`${key}-spread`,'Unison spread',patch[key].spread??0,0,50,1,(p,v)=>({...p,[key]:{...p[key],spread:v}}),' cents')}
     {patch.playback.stereo==='Stereo'&&number(`${key}-pan`,'Pan',patch[key].pan??0,-1,1,.01,(p,v)=>({...p,[key]:{...p[key],pan:v}}))}
    </div>)}
    {number('noise','Noise texture',patch.noise,0,1,.01,(p,v)=>({...p,noise:v}))}
   </>}
   {selected==='Chords'&&patch.chords.map((semi,index)=>number(`chord-${index}`,`Voice interval ${index+1}`,semi,-24,24,1,(p,v)=>({...p,chords:p.chords.map((n,i)=>i===index?v:n)}),' st'))}
   {selected==='Movement'&&<>
    {(['lfo1','lfo2'] as const).filter(key=>patch[key].enabled).map(key=><div key={key}><h4>LFO {key.slice(-1)} · {patch[key].type}</h4>{number(`${key}-rate`,'Rate',patch[key].rate,.1,20,.1,(p,v)=>({...p,[key]:{...p[key],rate:v}}),' Hz')}{number(`${key}-depth`,'Depth',patch[key].depth,0,1,.01,(p,v)=>({...p,[key]:{...p[key],depth:v}}))}</div>)}
    {patch.modMatrix.map((route,i)=>number(`route-${i}`,`${route.source} → ${route.dest}`,route.amount,-1,1,.01,(p,v)=>({...p,modMatrix:p.modMatrix.map((r,index)=>index===i?{...r,amount:v}:r)})))}
   </>}
   {selected==='Effects'&&effects.map(key=>{const params=getFxParameters(patch)[key] as unknown as Record<string,number>;return <div key={key} className="ss-draft-voice"><h4>{FX_LABELS[key]}</h4><ToggleControl id={`ft-fx-${key}`} label="Enabled" checked={patch.fx[key]} onChange={v=>onChange(p=>({...p,fx:{...p.fx,[key]:v}}))}/>{Object.entries(FX_PARAMETER_LIMITS[key]).map(([name,limits])=>{const [min,max]=limits as readonly [number,number],[label,unit]=FX_FIELDS[name]??[name,''];return number(`${key}-${name}`,label,params[name],min,max,name==='frequency'?1:max<=2?.001:.1,(p,v)=>({...p,fxParameters:{...getFxParameters(p),[key]:{...getFxParameters(p)[key],[name]:v}}}),unit);})}</div>;})}
  </fieldset>
 </section></ParameterScope>;
}
