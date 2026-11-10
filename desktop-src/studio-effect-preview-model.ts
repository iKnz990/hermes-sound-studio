import {getFxParameters,validateSoundPatch,type SoundPatch,type FxKey,type FxParameters} from '../assets/studio-engine';
const f=(v:number)=>Number(v.toFixed(2));
const seconds=(v:number)=>v!==0&&Math.abs(v)<.01?`${f(v*1000)} ms`:`${f(v)} s`;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export type EffectPreviewModel={path:string;description:string;xLabel:string;yLabel:string;annotations:string[]};
/** RBJ peaking coefficients used by Web Audio's peaking BiquadFilterNode. */
export function eqResponseDb(eq:FxParameters['eq'],sampleRate:number,frequency:number):number {
 const A=10**(eq.gainDb/40),w0=2*Math.PI*eq.frequency/sampleRate,w=2*Math.PI*frequency/sampleRate,alpha=Math.sin(w0)/(2*eq.q),c=Math.cos(w0);
 const magnitude=(v:number[])=>Math.hypot(v[0]+v[1]*Math.cos(w)+v[2]*Math.cos(2*w),v[1]*Math.sin(w)+v[2]*Math.sin(2*w));
 return 20*Math.log10(Math.max(1e-12,magnitude([1+alpha*A,-2*c,1-alpha*A])/magnitude([1+alpha/A,-2*c,1-alpha/A])));
}
/** Exact Float32 transfer table and linear lookup used by the renderer's FX WaveShaperNode. Not voice drive. */
export function saturationTransfer(input:number,drive:number):number {
 const k=1.5+drive*.55,index=(clamp(input,-1,1)+1)*512,lo=Math.floor(index),hi=Math.min(1024,lo+1),sample=(i:number)=>Math.fround(Math.tanh(k*(i/512-1))/Math.tanh(k));
 return sample(lo)+(sample(hi)-sample(lo))*(index-lo);
}
/** Conventional quadratic soft knee; Web Audio's implementation-specific knee/dynamics are not asserted exact. */
export function compressorStaticDb(input:number,p:FxParameters['compressor']):number {
 const x=input-p.thresholdDb,k=p.kneeDb;
 if(k>0&&x>-k/2&&x<k/2)return input+(1/p.ratio-1)*(x+k/2)**2/(2*k);
 return x<=-k/2?input:p.thresholdDb+x/p.ratio;
}
/** First wet echo always exists when mix>0; feedback=0 never invents a second echo. */
export function delayPulses(p:FxParameters['delay']):{time:number;amplitude:number}[] {
 const pulses:{time:number;amplitude:number}[]=[];
 for(let i=0;i<24;i++){const amplitude=p.mix*p.feedback**i;if(amplitude===0)break;pulses.push({time:(i+1)*p.time,amplitude});}
 return pulses;
}
/** Absolute upper bound of seeded impulse samples; not the realized impulse or convolved audio. */
export function reverbEnvelopeBound(time:number,decay:number,sampleRate:number):number {
 const length=Math.ceil(decay*sampleRate),index=Math.max(0,Math.floor(time*sampleRate));return index>=length?0:.12*(1-index/length)**2.5;
}
const line=(points:{x:number;y:number}[])=>'M'+points.map(p=>`${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join(' L');
export function effectPreviewModel(patch:SoundPatch,effect:FxKey,sampleRate=48000):EffectPreviewModel {
 const p=getFxParameters(validateSoundPatch(patch));
 if(!Number.isFinite(sampleRate)||sampleRate<32000||sampleRate>192000)throw new RangeError('preview sample rate');
 const samples=(fn:(u:number)=>number)=>line(Array.from({length:161},(_,i)=>({x:30+550*i/160,y:fn(i/160)})));
 if(effect==='eq'){const q=p.eq;return {path:samples(u=>62-47*eqResponseDb(q,sampleRate,40*400**u)/12),description:'Peaking biquad magnitude response',xLabel:'40 Hz → 16 kHz · logarithmic',yLabel:'Gain −12 → +12 dB',annotations:[`${f(q.frequency)} Hz · ${f(q.gainDb)} dB · Q ${f(q.q)}`,`${sampleRate} samples/s`]};}
 if(effect==='saturation')return {path:samples(u=>62-47*saturationTransfer(2*u-1,p.saturation.drive)),description:'FX saturation transfer · renderer table lookup',xLabel:'Input −1 → +1',yLabel:'Output −1 → +1',annotations:[`FX drive ${f(p.saturation.drive)} · not voice drive`]};
 if(effect==='compressor'){const q=p.compressor;return {path:samples(u=>108-93*(compressorStaticDb(-60+60*u,q)+60)/60),description:'Static soft-knee approximation · not exact Web Audio dynamics',xLabel:'Input −60 → 0 dB',yLabel:'Output −60 → 0 dB',annotations:[`Threshold ${f(q.thresholdDb)} dB · ratio ${f(q.ratio)}:1 · knee ${f(q.kneeDb)} dB`,`Attack ${seconds(q.attack)} · release ${seconds(q.release)} affect time response, not this static curve`]};}
 if(effect==='chorus'){const q=p.chorus;return {path:samples(u=>108-93*(.018+q.depth*Math.sin(2*Math.PI*q.rate*u*2))/.03),description:'Chorus delay-time trajectory · sine modulation',xLabel:'Time 0 → 2 s',yLabel:'Delay 0 → 30 ms',annotations:[`Rate ${f(q.rate)} Hz · depth ${f(q.depth*1000)} ms · base 18 ms`,`Additive wet send ${f(q.mix)}; direct path stays at unity. Mix does not change delay time.`]};}
 if(effect==='delay'){const q=p.delay,pulses=delayPulses(q).filter(v=>v.time<=4);return {path:pulses.map(v=>`M${(30+550*v.time/4).toFixed(3)} 108 V${(108-93*v.amplitude).toFixed(3)}`).join(' ')||'M30 108 H580',description:'Delay wet-echo amplitudes · first four seconds, at most 24 echoes',xLabel:'Time 0 → 4 s',yLabel:'Wet amplitude 0 → 1',annotations:[`Time ${seconds(q.time)} · feedback ${f(q.feedback)} · wet send ${f(q.mix)}`,'Direct path stays at unity; bounded display is not an audible-tail measurement.']};}
 const q=p.reverb;return {path:samples(u=>108-93*reverbEnvelopeBound(u*2,q.decay,sampleRate)/.12),description:'Reverb impulse-envelope bound · seeded noise is not plotted',xLabel:'Time 0 → 2 s',yLabel:'Impulse bound 0 → 0.12',annotations:[`Decay ${seconds(q.decay)} · ${Math.ceil(q.decay*sampleRate)} impulse samples`,`Additive wet send ${f(q.mix)}; does not reshape the impulse envelope. Not convolved audio.`]};
}
