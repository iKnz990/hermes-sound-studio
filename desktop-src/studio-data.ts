import paletteData from '../assets/studio-palettes.json';
import {validateSoundPatch,validateSoundTheme,type SoundPatch,type SoundTheme,type SoundEvent} from '../assets/studio-engine';
export const STUDIO_PALETTES:SoundTheme[]=paletteData.map(validateSoundTheme);
export const EVENT_LABELS:Record<SoundEvent,string>={onHover:'Hover',onFocus:'Focus',onCommit:'Confirm',onToggle:'Toggle',onError:'Error',onBackgroundTaskComplete:'Task complete'};
export const STYLE_OPTIONS=[
 {id:'soft',label:'Soft',character:'Soft & Smooth'},
 {id:'crisp',label:'Crisp',character:'Crisp & Tactile'},
 {id:'warm',label:'Warm',character:'Warm & Harmonic'},
 {id:'mechanical',label:'Mechanical',character:'Mechanical Relay'},
 {id:'nocturnal',label:'Nocturnal',character:'Deep & Resonant'}
] as const;
export function applyStyle(patch:SoundPatch,style:SoundPatch['style']):SoundPatch {
 const option=STYLE_OPTIONS.find(x=>x.id===style);if(!option)throw Error('Unknown style');
 const next=validateSoundPatch(patch);
 const values={soft:{wave:'sine',second:'triangle',cutoff:2600,res:1.2,drive:1,noise:.02},crisp:{wave:'triangle',second:'sine',cutoff:5800,res:2.4,drive:2.8,noise:.12},warm:{wave:'sawtooth',second:'triangle',cutoff:2200,res:2.1,drive:4.2,noise:.05},mechanical:{wave:'square',second:'triangle',cutoff:3900,res:3.6,drive:5,noise:.28},nocturnal:{wave:'triangle',second:'sawtooth',cutoff:3600,res:2.8,drive:3.5,noise:.06}}[style];
 return validateSoundPatch({...next,style,character:option.character,osc1:{...next.osc1,enabled:true,type:values.wave},osc2:{...next.osc2,enabled:true,type:values.second},filter:{...next.filter,type:style==='mechanical'?'bandpass':'lowpass',cutoff:values.cutoff,res:values.res,drive:values.drive},noise:values.noise});
}
export function setDuration(patch:SoundPatch,seconds:number):SoundPatch {
 const original=validateSoundPatch(patch);
 if(typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<.02||seconds>2.5)throw new RangeError('Duration must be 0.02–2.5 seconds');
 const ms=Math.round(seconds*1000),oldMs=original.duration*1000;
 const stages=['a','d','r'] as const,caps={a:1000,d:1500,r:2000};
 const sum=stages.reduce((n,key)=>n+original.adsr[key],0);
 // Retain the original sustain hold fraction, including an all-zero envelope.
 const target=Math.min(ms,Math.round(ms*sum/oldMs));
 const values={a:0,d:0,r:0};let remaining=target;
 let available=stages.filter(key=>original.adsr[key]>0);
 while(remaining>0&&available.length){
   const weight=available.reduce((n,key)=>n+original.adsr[key],0);
   const capped=available.filter(key=>remaining*original.adsr[key]/weight>=caps[key]-values[key]);
   if(!capped.length)break;
   for(const key of capped){const take=caps[key]-values[key];values[key]+=take;remaining-=take;}
   available=available.filter(key=>!capped.includes(key));
 }
 if(remaining>0&&available.length){
   const weight=available.reduce((n,key)=>n+original.adsr[key],0);
   const exact=available.map(key=>({key,fraction:remaining*original.adsr[key]/weight}));
   for(const {key,fraction} of exact)values[key]+=Math.floor(fraction);
   let extra=target-stages.reduce((n,key)=>n+values[key],0);
   for(const {key} of exact.sort((x,y)=>(y.fraction%1)-(x.fraction%1)))if(extra>0&&values[key]<caps[key]){values[key]++;extra--;}
 }
 return validateSoundPatch({...original,duration:ms/1000,adsr:{...original.adsr,...values}});
}

/** Editing one envelope stage expands the dry body without silently crossing schema limits. */
export function setAdsrStage(patch:SoundPatch,key:keyof SoundPatch['adsr'],value:number):SoundPatch {
 const original=validateSoundPatch(patch);
 if(!['a','d','s','r'].includes(key))throw new TypeError('ADSR stage');
 const limits={a:1000,d:1500,s:1,r:2000};
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>limits[key])throw new RangeError('ADSR stage out of range');
 const adsr={...original.adsr,[key]:value};
 const body=Math.ceil(adsr.a+adsr.d+adsr.r);
 if(body>2500)throw new RangeError('ADSR exceeds maximum duration');
 return validateSoundPatch({...original,adsr,duration:Math.max(original.duration,body/1000)});
}
