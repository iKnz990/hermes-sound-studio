/* Sound Studio v1. Standalone canonical renderer: this very source is embedded in TS exports. */
export const SOUND_EVENTS = ['onHover','onFocus','onCommit','onToggle','onError','onBackgroundTaskComplete'] as const;
export type SoundEvent = typeof SOUND_EVENTS[number];
export const FX_ORDER = ['eq','saturation','compressor','chorus','delay','reverb'] as const;
export type FxKey = typeof FX_ORDER[number];
export type FxParameters = {
  eq:{frequency:number;gainDb:number;q:number};saturation:{drive:number};
  compressor:{thresholdDb:number;ratio:number;attack:number;release:number;kneeDb:number};
  chorus:{rate:number;depth:number;mix:number};delay:{time:number;feedback:number;mix:number};reverb:{decay:number;mix:number};
};
/** Seconds, Hz and dB as named; mix is additive wet-send gain, not a dry/wet crossfade. */
export const FX_PARAMETER_LIMITS = {
  eq:{frequency:[40,16000],gainDb:[-12,12],q:[0.1,8]},saturation:{drive:[0,10]},
  compressor:{thresholdDb:[-60,0],ratio:[1,20],attack:[0.001,1],release:[0.01,2],kneeDb:[0,40]},
  chorus:{rate:[0.1,5],depth:[0,0.01],mix:[0,1]},delay:{time:[0.01,1],feedback:[0,0.7],mix:[0,1]},reverb:{decay:[0.05,2],mix:[0,1]}
} as const;
type Osc = {enabled:boolean;type:'sine'|'triangle'|'square'|'sawtooth';vol:number;tune:number;detune?:number;pan?:number;spread?:number};
type Lfo = {enabled:boolean;type:'sine'|'triangle'|'square';rate:number;depth:number};
type Matrix = {source:'LFO 1'|'LFO 2'|'Env 1 (ADSR)'|'Velocity';amount:number;dest:'Filter Cutoff'|'Osc 1 Level'|'Pan'|'Filter Resonance'|'Osc 2 Pitch'};
export type SoundPatch = {
  schemaVersion:'SoundPatch/v1';seed:number;name:string;style:'soft'|'crisp'|'warm'|'mechanical'|'nocturnal';character:string;
  duration:number;intensity:number;baseFreq:number;chords:number[];osc1:Osc;osc2:Osc;osc3:Osc;noise:number;
  adsr:{a:number;d:number;s:number;r:number};filter:{type:'lowpass'|'highpass'|'bandpass'|'notch';cutoff:number;res:number;drive:number};
  lfo1:Lfo;lfo2:Lfo;env2:{enabled:false;type:'exponential';rate:number;depth:number};modMatrix:Matrix[];
  fx:{eq:boolean;compressor:boolean;saturation:boolean;chorus:boolean;delay:boolean;reverb:boolean};
  fxOrder?:FxKey[];
  fxParameters?:FxParameters;
  playback:{mode:'On event (once)';gainDb:number;stereo:'Mono'|'Stereo'};
};
export type SoundTheme = {schemaVersion:'SoundTheme/v1';engineVersion:'sound-studio-dsp/v1';name:string;sampleRate:44100|48000|96000;masterGain:number;events:Record<SoundEvent,SoundPatch>};

const DEFAULT: SoundPatch = {
  schemaVersion:'SoundPatch/v1',seed:0x5161cafe,name:'Soft Chime',style:'soft',character:'Soft & Smooth',duration:0.36,intensity:70,baseFreq:330,chords:[0],
  osc1:{enabled:true,type:'sine',vol:0.85,tune:0},osc2:{enabled:true,type:'triangle',vol:0.4,tune:7},osc3:{enabled:false,type:'square',vol:0.2,tune:-12},noise:0.06,
  adsr:{a:12,d:96,s:0.72,r:210},filter:{type:'lowpass',cutoff:4200,res:1.8,drive:3},
  lfo1:{enabled:true,type:'sine',rate:2,depth:0.38},lfo2:{enabled:true,type:'triangle',rate:0.5,depth:0.25},
  env2:{enabled:false,type:'exponential',rate:1,depth:0.15},modMatrix:[
    {source:'LFO 1',amount:0.38,dest:'Filter Cutoff'},
    {source:'Env 1 (ADSR)',amount:0.72,dest:'Osc 1 Level'},
    {source:'LFO 2',amount:-0.25,dest:'Pan'},
    {source:'Velocity',amount:0.5,dest:'Filter Resonance'}
  ],
  fx:{eq:true,compressor:true,saturation:true,chorus:false,delay:true,reverb:true},
  playback:{mode:'On event (once)',gainDb:0,stereo:'Stereo'}
};
const own = (v:unknown): v is Record<string,unknown> => !!v && typeof v==='object' && !Array.isArray(v) && Object.getPrototypeOf(v)===Object.prototype;
function shape(v:unknown, keys:readonly string[], label:string): asserts v is Record<string,unknown> {
  if (!own(v) || Object.keys(v).length!==keys.length || keys.some(k=>!Object.prototype.hasOwnProperty.call(v,k))) throw new TypeError(`${label}: invalid keys`);
}
function num(v:unknown,min:number,max:number,label:string):number {
  if (typeof v!=='number'||!Number.isFinite(v)||v<min||v>max) throw new RangeError(`${label}: out of range`);
  return v;
}
function choice<T extends string>(v:unknown,values:readonly T[],label:string):T {
  if (typeof v!=='string'||!values.includes(v as T)) throw new TypeError(`${label}: unsupported value`);
  return v as T;
}
function label(v:unknown,what:string,max:number):string {
  if (typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u001f\u007f]/.test(v)) throw new TypeError(`${what}: invalid text`);
  return v;
}
function bool(v:unknown,what:string):boolean {if(typeof v!=='boolean')throw new TypeError(`${what}: expected boolean`);return v;}
const oscTypes=['sine','triangle','square','sawtooth'] as const;
const lfoTypes=['sine','triangle','square'] as const;
const sources=['LFO 1','LFO 2','Env 1 (ADSR)','Velocity'] as const;
const destinations=['Filter Cutoff','Osc 1 Level','Pan','Filter Resonance','Osc 2 Pitch'] as const;
function oscillator(v:unknown,what:string):Osc {
  const extra=own(v)?['detune','pan','spread'].filter(key=>Object.hasOwn(v,key)):[];
  shape(v,['enabled','type','vol','tune',...extra],what);
  return {enabled:bool(v.enabled,what),type:choice(v.type,oscTypes,what),vol:num(v.vol,0,1,what),tune:num(v.tune,-24,24,what),
    ...(extra.includes('detune')?{detune:num(v.detune,-100,100,`${what}.detune`)}:{}),
    ...(extra.includes('pan')?{pan:num(v.pan,-1,1,`${what}.pan`)}:{}),
    ...(extra.includes('spread')?{spread:num(v.spread,0,50,`${what}.spread`)}:{})};
}
function lfo(v:unknown,what:string):Lfo {
  shape(v,['enabled','type','rate','depth'],what);
  return {enabled:bool(v.enabled,what),type:choice(v.type,lfoTypes,what),rate:num(v.rate,0.1,20,what),depth:num(v.depth,0,1,what)};
}
function validateFxParameters(value:unknown):FxParameters {
  shape(value,FX_ORDER,'fxParameters');
  const clean:Record<string,Record<string,number>>={};
  for(const effect of FX_ORDER){
    const limits=FX_PARAMETER_LIMITS[effect],input=value[effect];
    shape(input,Object.keys(limits),`fxParameters.${effect}`);
    const fields:Record<string,number>={};
    for(const [field,[min,max]] of Object.entries(limits))fields[field]=num(input[field],min,max,`fxParameters.${effect}.${field}`);
    clean[effect]=fields;
  }
  return clean as FxParameters;
}
/** Resolve defaults without materializing the optional field on legacy patches. Always returns a deep clone. */
export function getFxParameters(patch:SoundPatch):FxParameters {
  if(Object.prototype.hasOwnProperty.call(patch,'fxParameters'))return validateFxParameters(patch.fxParameters);
  return {eq:{frequency:1600,gainDb:3.5,q:0.8},saturation:{drive:num(patch.filter.drive,0,10,'drive')},
    compressor:{thresholdDb:-25,ratio:3.5,attack:0.003,release:0.16,kneeDb:10},
    chorus:{rate:0.9,depth:0.0035,mix:0.22},delay:{time:0.145,feedback:0.22,mix:0.23},reverb:{decay:0.62,mix:0.24}};
}
export function validateSoundPatch(value:unknown):SoundPatch {
  const ordered=own(value)&&Object.prototype.hasOwnProperty.call(value,'fxOrder');
  const parameterized=own(value)&&Object.prototype.hasOwnProperty.call(value,'fxParameters');
  shape(value,['schemaVersion','seed','name','style','character','duration','intensity','baseFreq','chords','osc1','osc2','osc3','noise','adsr','filter','lfo1','lfo2','env2','modMatrix','fx','playback',...(ordered?['fxOrder']:[]),...(parameterized?['fxParameters']:[])],'patch');
  if(ordered&&(!Array.isArray(value.fxOrder)||value.fxOrder.length!==FX_ORDER.length||new Set(value.fxOrder).size!==FX_ORDER.length||value.fxOrder.some((key:unknown)=>!FX_ORDER.includes(key as FxKey))))throw new TypeError('fxOrder: expected complete effect permutation');
  if(value.schemaVersion!=='SoundPatch/v1')throw new TypeError('patch version');
  const seed=num(value.seed,0,4294967295,'seed');if(!Number.isInteger(seed))throw new TypeError('seed must be uint32');
  const duration=num(value.duration,0.02,2.5,'duration');
  const baseFreq=num(value.baseFreq,40,4000,'baseFreq');
  if(!Array.isArray(value.chords)||value.chords.length<1||value.chords.length>6)throw new TypeError('chords length');
  const chords=value.chords.map((n:unknown)=>num(n,-24,24,'chord'));
  const osc1=oscillator(value.osc1,'osc1'),osc2=oscillator(value.osc2,'osc2'),osc3=oscillator(value.osc3,'osc3');
  // Validate for the lowest supported sample rate. 0.42 Nyquist leaves pitch-modulation headroom.
  for(const semi of chords)for(const osc of [osc1,osc2,osc3])if(osc.enabled && baseFreq*2**((semi+osc.tune+2+((osc.detune??0)+(osc.spread??0))/100)/12)>0.42*44100)throw new RangeError('oscillator frequency exceeds supported band');
  shape(value.adsr,['a','d','s','r'],'adsr');
  const adsr={a:num(value.adsr.a,0,1000,'attack'),d:num(value.adsr.d,0,1500,'decay'),s:num(value.adsr.s,0,1,'sustain'),r:num(value.adsr.r,0,2000,'release')};
  if((adsr.a+adsr.d+adsr.r)/1000>duration+1e-6)throw new RangeError('duration shorter than ADSR');
  shape(value.filter,['type','cutoff','res','drive'],'filter');
  const filter={type:choice(value.filter.type,['lowpass','highpass','bandpass','notch'] as const,'filter type'),cutoff:num(value.filter.cutoff,40,16000,'cutoff'),res:num(value.filter.res,0.1,8,'resonance'),drive:num(value.filter.drive,0,10,'drive')};
  shape(value.env2,['enabled','type','rate','depth'],'env2');
  if(value.env2.enabled!==false||value.env2.type!=='exponential')throw new TypeError('Envelope 2 unavailable in v1');
  const env2={enabled:false as const,type:'exponential' as const,rate:num(value.env2.rate,0,20,'env2 rate'),depth:num(value.env2.depth,0,1,'env2 depth')};
  if(!Array.isArray(value.modMatrix)||value.modMatrix.length>12)throw new TypeError('matrix length');
  const modMatrix=value.modMatrix.map((r:unknown):Matrix=>{
    shape(r,['source','amount','dest'],'matrix row');
    return {source:choice(r.source,sources,'matrix source'),amount:num(r.amount,-1,1,'matrix amount'),dest:choice(r.dest,destinations,'matrix destination')};
  });
  shape(value.fx,['eq','compressor','saturation','chorus','delay','reverb'],'fx');
  const fx={eq:bool(value.fx.eq,'eq'),compressor:bool(value.fx.compressor,'compressor'),saturation:bool(value.fx.saturation,'saturation'),chorus:bool(value.fx.chorus,'chorus'),delay:bool(value.fx.delay,'delay'),reverb:bool(value.fx.reverb,'reverb')};
  shape(value.playback,['mode','gainDb','stereo'],'playback');
  if(value.playback.mode!=='On event (once)')throw new TypeError('unsupported playback mode');
  return {schemaVersion:'SoundPatch/v1',seed,name:label(value.name,'name',80),style:choice(value.style,['soft','crisp','warm','mechanical','nocturnal'] as const,'style'),character:label(value.character,'character',100),
    duration,intensity:num(value.intensity,0,100,'intensity'),baseFreq,chords,osc1,osc2,osc3,noise:num(value.noise,0,1,'noise'),adsr,filter,
    lfo1:lfo(value.lfo1,'lfo1'),lfo2:lfo(value.lfo2,'lfo2'),env2,modMatrix,fx,...(ordered?{fxOrder:[...(value.fxOrder as FxKey[])]}:{}),...(parameterized?{fxParameters:validateFxParameters(value.fxParameters)}:{}),
    playback:{mode:'On event (once)',gainDb:num(value.playback.gainDb,-24,6,'gainDb'),stereo:choice(value.playback.stereo,['Mono','Stereo'] as const,'stereo')}};
}
export function createSoundPatch(overrides:Partial<SoundPatch>={}):SoundPatch {
  if(!own(overrides))throw new TypeError('overrides must be an object');
  const nested=['osc1','osc2','osc3','adsr','filter','lfo1','lfo2','env2','fx','playback'] as const;
  const draft:Record<string,unknown>={...DEFAULT,...overrides};
  for(const key of nested)if(Object.prototype.hasOwnProperty.call(overrides,key) && own(overrides[key]))draft[key]={...DEFAULT[key],...overrides[key]};
  return validateSoundPatch(draft);
}
export function validateSoundTheme(value:unknown):SoundTheme {
  shape(value,['schemaVersion','engineVersion','name','sampleRate','masterGain','events'],'theme');
  if(value.schemaVersion!=='SoundTheme/v1'||value.engineVersion!=='sound-studio-dsp/v1')throw new TypeError('theme version');
  shape(value.events,SOUND_EVENTS,'events');
  const events={} as Record<SoundEvent,SoundPatch>;
  for(const event of SOUND_EVENTS)events[event]=validateSoundPatch(value.events[event]);
  return {schemaVersion:'SoundTheme/v1',engineVersion:'sound-studio-dsp/v1',name:label(value.name,'theme name',80),sampleRate:(()=>{if(value.sampleRate!==44100&&value.sampleRate!==48000&&value.sampleRate!==96000)throw new RangeError('sample rate');return value.sampleRate;})(),
    masterGain:num(value.masterGain,0,1.5,'masterGain'),events};
}

export type SoundRouting = {mode:'legacy-parallel'|'ordered';nodes:Array<{id:string;label:string;kind:string}>;edges:Array<{from:string;to:string;label?:string;kind:'audio'|'modulation'}>};
/** Aggregate per-chord voices and wet/dry stage internals; edges represent actual audio and modulation paths, not editable wiring. */
export function describeSoundRouting(patch:SoundPatch):SoundRouting {
  const p=validateSoundPatch(patch),mode=p.fxOrder?'ordered':'legacy-parallel';
  const nodes:SoundRouting['nodes']=[],edges:SoundRouting['edges']=[];
  const node=(id:string,label:string,kind:string)=>nodes.push({id,label,kind});
  const audio=(from:string,to:string,label?:string)=>edges.push({from,to,...(label?{label}:{}),kind:'audio'});
  const mod=(from:string,to:string,label:string)=>edges.push({from,to,label,kind:'modulation'});
  node('oscillators','Oscillators / noise (per chord voice)','source');
  node('drive','Voice drive','shaper');node('filter','Voice filter','filter');
  node('pan','Stereo pan / mono pass-through','pan');node('envelope','ADSR envelope, peak / playback gain','gain');node('voice','Summed chord voices','mix');
  for(const [from,to] of [['oscillators','drive'],['drive','filter'],['filter','pan'],['pan','envelope'],['envelope','voice']])audio(from,to);
  for(const key of FX_ORDER)node(key,`${key[0].toUpperCase()+key.slice(1)} (${p.fx[key]?'enabled':'bypassed'})`,key==='chorus'||key==='delay'||key==='reverb'?'wet/dry effect':'insert');
  if(mode==='ordered'){
    let previous='voice';
    for(const key of p.fxOrder!){if(!p.fx[key])continue;audio(previous,key,['chorus','delay','reverb'].includes(key)?'dry + wet stage':'insert');previous=key;}
    audio(previous,'output-gain');
  }else{
    let previous='voice';
    for(const key of FX_ORDER.slice(0,3)){if(!p.fx[key])continue;audio(previous,key);previous=key;}
    node('sum','Dry + parallel effect sends','mix');audio(previous,'sum','dry');
    for(const key of FX_ORDER.slice(3)){if(!p.fx[key])continue;audio(previous,key,'send');audio(key,'sum','wet');}
    audio('sum','output-gain');
  }
  node('output-gain','Master output gain','gain');node('limiter','Always-on output ceiling','limiter');node('destination','Stereo output','output');
  audio('output-gain','limiter');audio('limiter','destination');
  node('lfo1',`LFO 1 (${p.lfo1.enabled&&p.lfo1.depth?'active':'inactive'})`,'modulator');
  node('lfo2',`LFO 2 (${p.lfo2.enabled&&p.lfo2.depth?'active':'inactive'})`,'modulator');
  node('env1','Env 1 (ADSR) matrix source','modulator');node('velocity','Velocity (intensity) matrix source','modulator');
  node('osc1-level','Osc 1 level','parameter');node('osc2-pitch','Osc 2 pitch','parameter');node('filter-cutoff','Filter cutoff','parameter');node('filter-resonance','Filter resonance','parameter');node('pan-control','Stereo pan','parameter');
  if(p.lfo1.enabled&&p.lfo1.depth)mod('lfo1','filter-cutoff','direct ×160 cents');
  const pitchAvailable=p.osc2.enabled&&p.osc2.vol>0,panAvailable=p.playback.stereo==='Stereo';
  if(p.lfo2.enabled&&p.lfo2.depth&&pitchAvailable)mod('lfo2','osc2-pitch','direct ×40 cents');
  const sourceIds={'LFO 1':'lfo1','LFO 2':'lfo2','Env 1 (ADSR)':'env1','Velocity':'velocity'} as const;
  const destIds={'Filter Cutoff':'filter-cutoff','Osc 1 Level':'osc1-level','Pan':'pan-control','Filter Resonance':'filter-resonance','Osc 2 Pitch':'osc2-pitch'} as const;
  const scales={'Filter Cutoff':720,'Osc 1 Level':0.35,'Pan':0.32,'Filter Resonance':1.8,'Osc 2 Pitch':200} as const;
  for(const row of p.modMatrix){
    if(!row.amount||(row.dest==='Pan'&&!panAvailable)||(row.dest==='Osc 2 Pitch'&&!pitchAvailable))continue;
    if(row.source==='LFO 1'&&(!p.lfo1.enabled||!p.lfo1.depth))continue;
    if(row.source==='LFO 2'&&(!p.lfo2.enabled||!p.lfo2.depth))continue;
    mod(sourceIds[row.source],destIds[row.dest],`matrix ${Number((row.amount*scales[row.dest]).toFixed(6))}`);
  }
  return {mode,nodes,edges};
}

function random(seed:number):()=>number {
  let x=(seed^0xa341316c)>>>0;
  return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};
}
function envelope(param:AudioParam,t:number,p:SoundPatch):void {
  const a=p.adsr.a/1000,d=p.adsr.d/1000,r=p.adsr.r/1000,hold=p.duration-a-d-r;
  param.setValueAtTime(0,t);
  if(a) param.linearRampToValueAtTime(1,t+a);else param.setValueAtTime(1,t);
  if(d) param.linearRampToValueAtTime(p.adsr.s,t+a+d);else param.setValueAtTime(p.adsr.s,t+a);
  param.setValueAtTime(p.adsr.s,t+a+d+Math.max(0,hold));
  if(r) param.linearRampToValueAtTime(0,t+p.duration);else param.setValueAtTime(0,t+p.duration);
}
function modulation(ctx:OfflineAudioContext,p:SoundPatch,t:number,end:number,target:AudioParam,source:AudioNode,amount:number):void {
  const scaling=ctx.createGain();scaling.gain.value=amount;source.connect(scaling);scaling.connect(target);
}
function makeLfo(ctx:OfflineAudioContext,cfg:Lfo,t:number,end:number):AudioNode|null {
  if(!cfg.enabled||!cfg.depth)return null;
  const o=ctx.createOscillator(),g=ctx.createGain();o.type=cfg.type;o.frequency.value=cfg.rate;g.gain.value=cfg.depth;o.connect(g);o.start(t);o.stop(end);return g;
}
function impulse(ctx:OfflineAudioContext,seed:number,stereo:boolean,decay:number):AudioBuffer {
  const len=Math.ceil(decay*ctx.sampleRate),b=ctx.createBuffer(stereo?2:1,len,ctx.sampleRate),rand=random(seed^0x72d953);
  for(let c=0;c<b.numberOfChannels;c++){const data=b.getChannelData(c);for(let i=0;i<len;i++){
    const x=i/len;data[i]=(rand()*2-1)*(1-x)**2.5*0.12;
  }}return b;
}
/** Includes the dry body, 24ms/chord stagger and bounded effect tails. No audible context is created. */
export async function renderSoundPatch(patch:SoundPatch,options:{sampleRate?:number;masterGain?:number}={}):Promise<AudioBuffer> {
  const p=validateSoundPatch(patch);
  if(!own(options)||Object.keys(options).some(k=>k!=='sampleRate'&&k!=='masterGain'))throw new TypeError('render options');
  const rate=options.sampleRate===undefined?48000:options.sampleRate;
  if(rate!==44100&&rate!==48000&&rate!==96000)throw new RangeError('sampleRate unsupported');
  const masterGain=options.masterGain===undefined?1:num(options.masterGain,0,1.5,'masterGain');
  const params=getFxParameters(p);
  // Preserve historical allocation exactly when absent. Parameterized delay reserves
  // repeats down to -80dB feedback amplitude plus 35ms; max 26 repeats at feedback .7.
  const delayTail=Math.max(1.16,params.delay.time*(params.delay.feedback===0?1:Math.ceil(Math.log(0.0001)/Math.log(params.delay.feedback)))+0.035);
  const reverbTail=Math.max(0.68,params.reverb.decay+0.06);
  const tail=p.fxParameters
    ?(p.fxOrder?0.035+(p.fx.chorus?0.07:0)+(p.fx.delay?delayTail:0)+(p.fx.reverb?reverbTail:0):Math.max(0.035,p.fx.chorus?0.07:0,p.fx.delay?delayTail:0,p.fx.reverb?reverbTail:0))
    :(p.fxOrder?(0.035+(p.fx.chorus?0.07:0)+(p.fx.delay?1.16:0)+(p.fx.reverb?0.68:0)):(p.fx.delay?1.16:p.fx.reverb?0.68:p.fx.chorus?0.07:0.035));
  const seconds=p.duration+(p.chords.length-1)*0.024+tail;
  const ctx=new OfflineAudioContext(2,Math.ceil(seconds*rate),rate);
  const voice=ctx.createGain();let current:AudioNode=voice;
  let sum:GainNode;
  if(p.fxOrder){
    for(const key of p.fxOrder){
      if(!p.fx[key])continue;
      if(key==='eq'){const eq=ctx.createBiquadFilter();eq.type='peaking';eq.frequency.value=params.eq.frequency;eq.Q.value=params.eq.q;eq.gain.value=params.eq.gainDb;current.connect(eq);current=eq;}
      else if(key==='saturation'){const shaper=ctx.createWaveShaper(),curve=new Float32Array(1025);
        const k=1.5+params.saturation.drive*0.55;for(let i=0;i<curve.length;i++){const x=i/512-1;curve[i]=Math.tanh(k*x)/Math.tanh(k);}
        shaper.curve=curve;current.connect(shaper);current=shaper;
      }else if(key==='compressor'){const comp=ctx.createDynamicsCompressor();comp.threshold.value=params.compressor.thresholdDb;comp.knee.value=params.compressor.kneeDb;comp.ratio.value=params.compressor.ratio;comp.attack.value=params.compressor.attack;comp.release.value=params.compressor.release;current.connect(comp);current=comp;}
      else{
        const stage=ctx.createGain();current.connect(stage); // The direct path remains in the serial stage.
        if(key==='chorus'){const delay=ctx.createDelay(0.06),wet=ctx.createGain(),osc=ctx.createOscillator(),mod=ctx.createGain();
          delay.delayTime.value=0.018;wet.gain.value=params.chorus.mix;osc.frequency.value=params.chorus.rate;mod.gain.value=params.chorus.depth;
          osc.connect(mod);mod.connect(delay.delayTime);osc.start(0);osc.stop(seconds);current.connect(delay);delay.connect(wet);wet.connect(stage);
        }else if(key==='delay'){const d=ctx.createDelay(p.fxParameters?1:0.2),feedback=ctx.createGain(),wet=ctx.createGain();d.delayTime.value=params.delay.time;feedback.gain.value=params.delay.feedback;wet.gain.value=params.delay.mix;
          current.connect(d);d.connect(feedback);feedback.connect(d);d.connect(wet);wet.connect(stage);
        }else{const conv=ctx.createConvolver(),wet=ctx.createGain();conv.normalize=false;conv.buffer=impulse(ctx,p.seed,p.playback.stereo==='Stereo',params.reverb.decay);wet.gain.value=params.reverb.mix;current.connect(conv);conv.connect(wet);wet.connect(stage);}
        current=stage;
      }
    }
    sum=ctx.createGain();current.connect(sum);
  }else{
  if(p.fx.eq){const eq=ctx.createBiquadFilter();eq.type='peaking';eq.frequency.value=params.eq.frequency;eq.Q.value=params.eq.q;eq.gain.value=params.eq.gainDb;current.connect(eq);current=eq;}
  if(p.fx.saturation){const shaper=ctx.createWaveShaper(),curve=new Float32Array(1025);
    const k=1.5+params.saturation.drive*0.55;for(let i=0;i<curve.length;i++){const x=i/512-1;curve[i]=Math.tanh(k*x)/Math.tanh(k);}
    shaper.curve=curve;current.connect(shaper);current=shaper;
  }
  if(p.fx.compressor){const comp=ctx.createDynamicsCompressor();comp.threshold.value=params.compressor.thresholdDb;comp.knee.value=params.compressor.kneeDb;comp.ratio.value=params.compressor.ratio;comp.attack.value=params.compressor.attack;comp.release.value=params.compressor.release;current.connect(comp);current=comp;}
  // Send effects are additive after the insert chain. Every send terminates at the same limiter.
  sum=ctx.createGain();current.connect(sum);
  if(p.fx.chorus){const delay=ctx.createDelay(0.06),wet=ctx.createGain(),osc=ctx.createOscillator(),mod=ctx.createGain();
    delay.delayTime.value=0.018;wet.gain.value=params.chorus.mix;osc.frequency.value=params.chorus.rate;mod.gain.value=params.chorus.depth;
    osc.connect(mod);mod.connect(delay.delayTime);osc.start(0);osc.stop(seconds);current.connect(delay);delay.connect(wet);wet.connect(sum);
  }
  if(p.fx.delay){const d=ctx.createDelay(p.fxParameters?1:0.2),feedback=ctx.createGain(),wet=ctx.createGain();d.delayTime.value=params.delay.time;feedback.gain.value=params.delay.feedback;wet.gain.value=params.delay.mix;
    current.connect(d);d.connect(feedback);feedback.connect(d);d.connect(wet);wet.connect(sum);
  }
  if(p.fx.reverb){const conv=ctx.createConvolver(),wet=ctx.createGain();conv.normalize=false;conv.buffer=impulse(ctx,p.seed,p.playback.stereo==='Stereo',params.reverb.decay);wet.gain.value=params.reverb.mix;current.connect(conv);conv.connect(wet);wet.connect(sum);}
  }
  // Always-on output ceiling; conservative gain ensures ordinary patches stay below it.
  const limiter=ctx.createWaveShaper(),ceiling=new Float32Array(1025);for(let i=0;i<ceiling.length;i++)ceiling[i]=Math.tanh((i/512-1)*1.05)/Math.tanh(1.05);
  limiter.curve=ceiling;const level=ctx.createGain();level.gain.value=masterGain;sum.connect(level);level.connect(limiter);limiter.connect(ctx.destination);
  const rand=random(p.seed);
  p.chords.forEach((semi,idx)=>{
    const t=idx*0.024,end=t+p.duration,note=p.baseFreq*2**(semi/12);
    const filter=ctx.createBiquadFilter();filter.type=p.filter.type;filter.frequency.value=p.filter.cutoff;filter.Q.value=p.filter.res;
    const drive=ctx.createWaveShaper(),driveCurve=new Float32Array(513);const driveAmount=1+p.filter.drive*0.075;
    for(let i=0;i<driveCurve.length;i++)driveCurve[i]=Math.tanh((i/256-1)*driveAmount)/driveAmount;
    drive.curve=driveCurve;drive.connect(filter);
    const env=ctx.createGain();env.gain.value=0;const peak=ctx.createGain();peak.gain.value=(0.11*p.intensity/100*10**(p.playback.gainDb/20))/Math.sqrt(p.chords.length);
    envelope(env.gain,t,p);
    let panParam:AudioParam|undefined;
    if(p.playback.stereo==='Stereo'){
      const pan=ctx.createStereoPanner();pan.pan.value=Math.max(-0.65,Math.min(0.65,(idx-(p.chords.length-1)/2)*0.24));filter.connect(pan);pan.connect(env);
      panParam=pan.pan;
    }else filter.connect(env);
    env.connect(peak);peak.connect(voice);
    const osc1Gain=ctx.createGain(),osc2Gain=ctx.createGain();osc1Gain.gain.value=p.osc1.vol;osc2Gain.gain.value=p.osc2.vol;
    let pitchParam:AudioParam|undefined;const pitchParams:AudioParam[]=[];
    for(const [i,cfg] of ([p.osc1,p.osc2,p.osc3] as const).entries())if(cfg.enabled&&cfg.vol){
      const osc=ctx.createOscillator();osc.type=cfg.type;osc.frequency.value=note*2**(cfg.tune/12);
      const gain=i===0?osc1Gain:i===1?osc2Gain:ctx.createGain();if(i===2)gain.gain.value=cfg.vol;
      osc.detune.value=cfg.detune??0;
      const spread=cfg.spread??0;
      // Legacy zero-width patches retain their exact synthesis graph and PCM.
      let destination:AudioNode=gain;
      if(spread){const norm=ctx.createGain();norm.gain.value=.5;norm.connect(gain);destination=norm;const twin=ctx.createOscillator();twin.type=cfg.type;twin.frequency.value=osc.frequency.value;twin.detune.value=(cfg.detune??0)+spread;osc.detune.value-=spread;twin.connect(norm);twin.start(t);twin.stop(end);if(i===1)pitchParams.push(twin.detune);}
      osc.connect(destination);
      if(p.playback.stereo==='Stereo'&&(cfg.pan??0)!==0){const pan=ctx.createStereoPanner();pan.pan.value=cfg.pan!;gain.connect(pan);pan.connect(drive);}else gain.connect(drive);
      osc.start(t);osc.stop(end);
      if(i===1){pitchParam=osc.detune;pitchParams.push(osc.detune);}
    }
    if(p.noise){const buffer=ctx.createBuffer(1,Math.max(1,Math.ceil(Math.min(0.08,p.duration)*rate)),rate),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=rand()*2-1;
      const src=ctx.createBufferSource(),gain=ctx.createGain();src.buffer=buffer;gain.gain.value=p.noise*0.35;src.connect(gain);gain.connect(drive);src.start(t);
    }
    function wireMatrix():void {
      const routes=p.modMatrix.filter(row=>row.amount!==0 && (row.dest!=='Pan'||panParam) && (row.dest!=='Osc 2 Pitch'||pitchParam));
      if(!routes.length)return;
      let l1:AudioNode|null=null,l2:AudioNode|null=null,e1:ConstantSourceNode|null=null,v:ConstantSourceNode|null=null;
      for(const row of routes){let source:AudioNode|null=null;
        if(row.source==='LFO 1')source=l1??(l1=makeLfo(ctx,p.lfo1,t,end));
        if(row.source==='LFO 2')source=l2??(l2=makeLfo(ctx,p.lfo2,t,end));
        if(row.source==='Env 1 (ADSR)'){if(!e1){e1=ctx.createConstantSource();envelope(e1.offset,t,p);e1.start(t);e1.stop(end);}source=e1;}
        if(row.source==='Velocity'){if(!v){v=ctx.createConstantSource();v.offset.value=p.intensity/100;v.start(t);v.stop(end);}source=v;}
        if(!source)continue;
        const target=row.dest==='Filter Cutoff'?filter.detune:row.dest==='Filter Resonance'?filter.Q:row.dest==='Osc 1 Level'?osc1Gain.gain:row.dest==='Pan'?panParam:pitchParam;
        if(!target)continue;
        const amount=row.amount*(row.dest==='Filter Cutoff'?720:row.dest==='Filter Resonance'?1.8:row.dest==='Osc 2 Pitch'?200:row.dest==='Pan'?0.32:0.35);
        if(row.dest==='Osc 2 Pitch'){for(const param of pitchParams)modulation(ctx,p,t,end,param,source,amount);}else modulation(ctx,p,t,end,target,source,amount);
      }
    }
    // Direct modulation keeps both LFO controls audible even with an empty matrix.
    const baseLfo1=makeLfo(ctx,p.lfo1,t,end);
    if(baseLfo1)modulation(ctx,p,t,end,filter.detune,baseLfo1,160);
    const baseLfo2=makeLfo(ctx,p.lfo2,t,end);
    if(baseLfo2)for(const param of pitchParams)modulation(ctx,p,t,end,param,baseLfo2,40);
    wireMatrix();
  });
  return ctx.startRendering();
}

/** Analysis is derived only from the supplied PCM; 32 time windows and a direct 256-point DFT. */
export function analyzePcm(buffer:AudioBuffer,bins=64):{waveform:number[];spectrum:number[];spectrogram:number[][];peakDb:number|null;rmsDb:number|null;duration:number;sampleRate:number} {
  if(!Number.isInteger(bins)||bins<4||bins>256)throw new RangeError('bins');
  if(!buffer||!Number.isInteger(buffer.length)||buffer.length<1||buffer.numberOfChannels<1||buffer.numberOfChannels>2)throw new TypeError('audio buffer');
  const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
  const n=buffer.length,waveform=Array(bins).fill(0),spectrum=Array(bins).fill(0),spectrogram:number[][]=[];
  let peak=0,energy=0;
  for(let i=0;i<n;i++){let mono=0;for(const c of channels){const x=c[i];if(!Number.isFinite(x))throw new TypeError('non-finite PCM');peak=Math.max(peak,Math.abs(x));energy+=x*x;mono+=x;}waveform[Math.min(bins-1,Math.floor(i*bins/n))]=Math.max(waveform[Math.min(bins-1,Math.floor(i*bins/n))],Math.abs(mono/channels.length));}
  const frames=32,size=256;
  for(let frame=0;frame<frames;frame++){const magnitudes=Array(bins).fill(0),start=Math.floor(frame*Math.max(0,n-size)/Math.max(1,frames-1));
    for(let k=0;k<bins;k++){let re=0,im=0;const freq=k*128/bins;
      for(let i=0;i<size;i++){const idx=start+i,x=idx<n?channels.reduce((sum,c)=>sum+c[idx],0)/channels.length:0;
        const window=0.5-0.5*Math.cos(2*Math.PI*i/(size-1)),phase=2*Math.PI*freq*i/size;
        re+=x*window*Math.cos(phase);im-=x*window*Math.sin(phase);
      }magnitudes[k]=Math.sqrt(re*re+im*im)/size;
      spectrum[k]+=magnitudes[k]/frames;
    }spectrogram.push(magnitudes);
  }
  const rms=Math.sqrt(energy/(n*channels.length));
  return {waveform,spectrum,spectrogram,peakDb:peak?20*Math.log10(peak):null,rmsDb:rms?20*Math.log10(rms):null,duration:n/buffer.sampleRate,sampleRate:buffer.sampleRate};
}
export function encodeWav(buffer:AudioBuffer):Uint8Array {
  if(!buffer||buffer.numberOfChannels!==2||!Number.isInteger(buffer.length)||buffer.length<1||![44100,48000,96000].includes(buffer.sampleRate))throw new TypeError('expected stereo AudioBuffer');
  const size=buffer.length*8,out=new Uint8Array(44+size),v=new DataView(out.buffer);
  const text=(offset:number,s:string)=>{for(let i=0;i<s.length;i++)v.setUint8(offset+i,s.charCodeAt(i));};
  text(0,'RIFF');v.setUint32(4,36+size,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);
  v.setUint16(20,3,true);v.setUint16(22,2,true);v.setUint32(24,buffer.sampleRate,true);v.setUint32(28,buffer.sampleRate*8,true);
  v.setUint16(32,8,true);v.setUint16(34,32,true);text(36,'data');v.setUint32(40,size,true);
  const left=buffer.getChannelData(0),right=buffer.getChannelData(1);
  for(let i=0;i<buffer.length;i++){if(!Number.isFinite(left[i])||!Number.isFinite(right[i]))throw new TypeError('non-finite PCM');v.setFloat32(44+i*8,left[i],true);v.setFloat32(48+i*8,right[i],true);}
  return out;
}

/** Explicit consent and shared canonical PCM for audition, analysis and export. */
export type StudioSnapshot = Readonly<{enabled:boolean;muted:boolean;contextState:'uninitialized'|AudioContextState;activeVoices:number;lastEvent:SoundEvent|null;error:string|null;energy:number}>;
/** Ephemeral latest-started audition only. Times are AudioContext seconds, never UI wall time.
 * renderIdentity is the complete canonical render input key, not a persisted patch ID.
 * It may describe an old patch still sounding after an edit; consumers MUST match analysis identity.
 */
export type StudioPlaybackPosition = Readonly<{voiceId:number;event:SoundEvent;renderIdentity:string;startedAt:number;contextTime:number;renderedDuration:number;playing:true}>;
type RenderEntry = {key:string;buffer:Promise<AudioBuffer>;analysis?:Promise<ReturnType<typeof analyzePcm>>};
export class SoundStudioEngine {
  private theme:SoundTheme;private ctx:AudioContext|null=null;private muted=true;private disposed=false;
  private sources=new Set<AudioBufferSourceNode>();private cache=new Map<SoundEvent,RenderEntry>();
  private listeners=new Set<()=>void>();private snapshot:StudioSnapshot=Object.freeze({enabled:false,muted:true,contextState:'uninitialized',activeVoices:0,lastEvent:null,error:null,energy:0});
  private generation=0;private eventVersions=new Map<SoundEvent,number>();private enablePending:Promise<void>|null=null;
  private consentGranted=false;
  private analyser:AnalyserNode|null=null;private samples:Float32Array<ArrayBuffer>|null=null;
  private stereoMeters:AnalyserNode[]=[];private stereoSplitter:ChannelSplitterNode|null=null;
  private frame:number|null=null;private lastEnergyPublish=0;private cssTarget?:HTMLElement;
  private triggerTimes:number[]=[];
  private voiceSerial=0;
  private latestPlayback:Omit<StudioPlaybackPosition,'contextTime'>|null=null;
  private analysisIdentities=new WeakMap<object,string>();
  constructor(theme:SoundTheme){this.theme=validateSoundTheme(theme);}
  getSnapshot=():StudioSnapshot=>this.snapshot;
  /** Live output only; reading never opens a device or grants consent. */
  getLiveFrame=()=>{
    const wave=new Float32Array(256),peaks=[0,0];
    if(this.playable()&&this.sources.size&&this.analyser){this.analyser.getFloatTimeDomainData(wave);const channel=new Float32Array(256);for(let i=0;i<2;i++){(this.stereoMeters[i]??this.analyser).getFloatTimeDomainData(channel);for(const v of channel)peaks[i]=Math.max(peaks[i],Math.abs(v));}}
    return {wave,peaks};
  };
  /** Read without publishing a new StudioSnapshot on each clock tick. Null means no current voice. */
  getPlaybackPosition=():StudioPlaybackPosition|null=>{
    const latest=this.latestPlayback,ctx=this.ctx;
    if(!latest)return null;
    if(!this.playable()||!ctx||ctx.currentTime>=latest.startedAt+latest.renderedDuration){this.latestPlayback=null;return null;}
    return Object.freeze({...latest,contextTime:ctx.currentTime});
  };
  getRenderIdentity(event:SoundEvent):string {
    if(!SOUND_EVENTS.includes(event))throw new TypeError('event');
    return this.renderKey(event);
  }
  /** Only analyses actually returned by this engine have a trusted identity. */
  getAnalysisIdentity(analysis:object):string|null {return this.analysisIdentities.get(analysis)??null;}
  subscribe=(listener:()=>void):(()=>void)=>{if(this.disposed)return()=>{};this.listeners.add(listener);return()=>this.listeners.delete(listener);};
  private update(fields:Partial<StudioSnapshot>):void{
    const next={...this.snapshot,...fields};
    if((Object.keys(fields) as (keyof StudioSnapshot)[]).every(key=>this.snapshot[key]===next[key]))return;
    this.snapshot=Object.freeze(next);
    for(const listener of this.listeners)listener();
  }
  private state():StudioSnapshot['contextState']{return this.ctx?.state??'uninitialized';}
  private playable():boolean{return !this.disposed&&this.consentGranted&&!this.muted&&this.ctx?.state==='running';}
  private renderKey(event:SoundEvent,theme=this.theme):string{
    const {name,style,character,...dsp}=theme.events[event];
    return JSON.stringify([theme.sampleRate,theme.masterGain,dsp]);
  }
  private invalidate(event:SoundEvent):void{
    this.cache.delete(event);
    this.eventVersions.set(event,(this.eventVersions.get(event)??0)+1);
  }
  getBuffer(event:SoundEvent):Promise<AudioBuffer>{
    if(!SOUND_EVENTS.includes(event))throw new TypeError('event');
    if(this.disposed)return Promise.reject(new Error('engine disposed'));
    const key=this.renderKey(event),cached=this.cache.get(event);
    if(cached?.key===key){this.cache.delete(event);this.cache.set(event,cached);return cached.buffer;}
    const theme=this.theme;
    const entry:RenderEntry={key,buffer:Promise.resolve().then(()=>renderSoundPatch(theme.events[event],{sampleRate:theme.sampleRate,masterGain:theme.masterGain}))};
    this.cache.set(event,entry);
    while(this.cache.size>6)this.cache.delete(this.cache.keys().next().value!);
    // Rejection must not poison a later request; completion cannot replace a newer entry.
    void entry.buffer.then(()=>{},()=>{if(this.cache.get(event)===entry)this.cache.delete(event);});
    return entry.buffer;
  }
  getAnalysis(event:SoundEvent):Promise<ReturnType<typeof analyzePcm>>{
    const buffer=this.getBuffer(event),entry=this.cache.get(event)!;
    return entry.analysis??(entry.analysis=buffer.then(value=>{
      const analysis=analyzePcm(value);this.analysisIdentities.set(analysis,entry.key);return analysis;
    }).catch(error=>{
      if(this.cache.get(event)===entry)this.cache.delete(event);
      throw error;
    }));
  }
  async enable():Promise<void>{
    if(this.disposed)throw new Error('engine disposed');
    if(this.enablePending)return this.enablePending;
    const epoch=this.generation;
    const pending=(async()=>{
      try{
        const ctor=globalThis.AudioContext;if(!ctor)throw new Error('WebAudio unavailable');
        let ctx=this.ctx;
        if(!ctx||ctx.state==='closed'){
          ctx=new ctor({sampleRate:this.theme.sampleRate});this.ctx=ctx;this.analyser=null;
          const created=ctx;
          created.onstatechange=()=>{
            if(this.disposed||this.ctx!==created)return;
            this.update({contextState:created.state,enabled:this.consentGranted&&!this.muted&&created.state==='running'});
            if(created.state!=='running'){this.latestPlayback=null;this.resetEnergy();}
          };
        }
        if(ctx.state!=='running')await ctx.resume();
        if(this.disposed||epoch!==this.generation)throw new Error('Audio enable cancelled');
        if(ctx.state!=='running')throw new Error('Audio context did not resume');
        this.consentGranted=true;this.muted=false;
        this.update({enabled:true,muted:false,contextState:ctx.state,error:null});
      }catch(error){
        if(!this.disposed)this.update({enabled:false,muted:this.muted,contextState:this.state(),error:error instanceof Error?error.message:'Audio unavailable'});
        throw error;
      }
    })();
    this.enablePending=pending;
    try{await pending;}finally{if(this.enablePending===pending)this.enablePending=null;}
  }
  setMuted(value:boolean):void{
    if(this.disposed)throw new Error('engine disposed');
    this.muted=bool(value,'muted');
    if(value)this.stopAll();
    this.update({muted:value,enabled:this.consentGranted&&this.ctx?.state==='running'&&!value,contextState:this.state()});
  }
  setTheme(value:SoundTheme):void{
    if(this.disposed)throw new Error('engine disposed');
    const next=validateSoundTheme(value),prior=this.theme;
    this.theme=next;
    for(const event of SOUND_EVENTS)if(this.renderKey(event,prior)!==this.renderKey(event,next))this.invalidate(event);
  }
  setEventPatch(event:SoundEvent,patch:SoundPatch):void{
    if(this.disposed)throw new Error('engine disposed');
    if(!SOUND_EVENTS.includes(event))throw new TypeError('event');
    const next=validateSoundPatch(patch);
    this.setTheme({...this.theme,events:{...this.theme.events,[event]:next}});
  }
  setCssTarget(target?:HTMLElement):void{
    if(this.cssTarget===target)return;
    this.cssTarget?.style.removeProperty('--sonic-energy');
    if(this.disposed)return;
    this.cssTarget=target;
    this.writeEnergy(this.snapshot.energy);
  }
  private writeEnergy(value:number):void{this.cssTarget?.style.setProperty('--sonic-energy',String(value));}
  private meter=():void=>{
    this.frame=null;
    if(!this.playable()||!this.sources.size||!this.analyser||!this.samples){this.resetEnergy();return;}
    this.analyser.getFloatTimeDomainData(this.samples);
    let power=0;for(const sample of this.samples)power+=sample*sample;
    const energy=Math.min(1,Math.sqrt(power/this.samples.length)*4);
    this.writeEnergy(energy);
    const now=performance.now();
    if(now-this.lastEnergyPublish>=100){this.lastEnergyPublish=now;this.update({energy:Math.round(energy*20)/20});}
    if(typeof requestAnimationFrame==='function')this.frame=requestAnimationFrame(this.meter);
  };
  private resetEnergy():void{
    if(this.frame!==null&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(this.frame);
    this.frame=null;this.lastEnergyPublish=0;this.writeEnergy(0);this.update({energy:0});
  }
  stopAll():void{
    this.generation++;
    this.latestPlayback=null;
    for(const src of this.sources){src.onended=null;try{src.stop();}catch{/* already ended */}src.disconnect();}
    this.sources.clear();this.triggerTimes=[];this.resetEnergy();this.update({activeVoices:0});
  }
  async trigger(event:SoundEvent):Promise<boolean>{
    if(!SOUND_EVENTS.includes(event))throw new TypeError('event');
    if(!this.playable())return false;
    const ctx=this.ctx!,generation=this.generation,version=this.eventVersions.get(event)??0,renderIdentity=this.renderKey(event);
    const now=performance.now();this.triggerTimes=this.triggerTimes.filter(t=>now-t<1000);
    if(this.triggerTimes.length>=28||this.sources.size>=24)return false;
    this.triggerTimes.push(now);
    let buffer:AudioBuffer;
    try{buffer=await this.getBuffer(event);}catch(error){
      if(!this.disposed)this.update({error:error instanceof Error?error.message:'Audio rendering failed'});
      return false;
    }
    if(!this.playable()||this.ctx!==ctx||generation!==this.generation||version!==(this.eventVersions.get(event)??0)||this.sources.size>=24)return false;
    try{
      if(!this.analyser&&typeof ctx.createAnalyser==='function'){
        this.analyser=ctx.createAnalyser();this.analyser.fftSize=256;
        this.samples=new Float32Array(this.analyser.fftSize);
        this.analyser.connect(ctx.destination);
        if(typeof ctx.createChannelSplitter==='function'){this.stereoSplitter=ctx.createChannelSplitter(2);this.analyser.connect(this.stereoSplitter);for(let i=0;i<2;i++){const meter=ctx.createAnalyser();meter.fftSize=256;this.stereoSplitter.connect(meter,i);this.stereoMeters.push(meter);}}
      }
      const source=ctx.createBufferSource();source.buffer=buffer;source.connect(this.analyser??ctx.destination);
      this.sources.add(source);
      const voiceId=++this.voiceSerial,startedAt=ctx.currentTime;
      source.onended=()=>{source.disconnect();this.sources.delete(source);if(this.latestPlayback?.voiceId===voiceId)this.latestPlayback=null;this.update({activeVoices:this.sources.size});if(!this.sources.size)this.resetEnergy();};
      source.start(startedAt);
      this.latestPlayback=Object.freeze({voiceId,event,renderIdentity,startedAt,renderedDuration:buffer.length/buffer.sampleRate,playing:true});
      this.update({lastEvent:event,activeVoices:this.sources.size,error:null,contextState:ctx.state});
      if(this.analyser&&this.frame===null&&typeof requestAnimationFrame==='function')this.frame=requestAnimationFrame(this.meter);
      return true;
    }catch(error){
      this.stopAll();this.update({error:error instanceof Error?error.message:'Audio scheduling failed'});
      return false;
    }
  }
  async dispose():Promise<void>{
    if(this.disposed)return;this.disposed=true;this.muted=true;this.stopAll();
    this.cache.clear();this.setCssTarget();this.cssTarget?.style.removeProperty('--sonic-energy');this.cssTarget=undefined;
    this.analyser?.disconnect();this.analyser=null;this.samples=null;
    this.stereoSplitter?.disconnect();this.stereoSplitter=null;for(const meter of this.stereoMeters)meter.disconnect();this.stereoMeters=[];
    const ctx=this.ctx;this.ctx=null;
    this.update({enabled:false,muted:true,contextState:'uninitialized',activeVoices:0,energy:0});
    this.listeners.clear();if(ctx&&ctx.state!=='closed')await ctx.close();
  }
}
