import {renderSoundPatch,encodeWav,type SoundPatch} from '../assets/studio-engine';
import {validateComposition,loopWindow,type Composition} from './compose-model';
import {adaptComposeNote} from './compose-audio';
import {composePcmKey,COMPOSE_PCM_BUDGET} from './compose-live-cache';
import {createComposeOutput,COMPOSE_OUTPUT_PADDING_SECONDS} from './compose-mix';

export const COMPOSE_EXPORT_SAMPLE_RATE=48000;
/** Per-export known-buffer bound: unique retained canonical PCM + final stereo
 * mix + float WAV (including header). This is NOT a process working-set limit:
 * browser node/DSP internals and one in-flight canonical render allocate their
 * own memory. Actual returned PCM is checked before admission; an in-flight
 * OfflineAudioContext cannot be physically cancelled and may transiently exceed
 * this policy before its result can be measured. Preparation is serial. */
export const COMPOSE_EXPORT_BUFFER_BUDGET=192*1024*1024;
export type CompositionWavOptions={soloLayers?:ReadonlySet<string>;signal?:AbortSignal;onProgress?:(completed:number,total:number)=>void};
export type CompositionWav={wav:Uint8Array;duration:number;loopSeconds:number;sampleRate:number;noteCount:number};
export type ComposeExportDependencies={render:typeof renderSoundPatch;createContext:(channels:number,length:number,sampleRate:number)=>OfflineAudioContext};
type Note={layerId:string;at:number;key:string};

function detachedSolo(c:Composition,ids?:ReadonlySet<string>):Set<string>{
 const solo=new Set(ids);
 for(const id of solo)if(typeof id!=='string'||!c.layers.some(layer=>layer.id===id))throw new TypeError('Solo layer is not in this composition.');
 return solo;
}
/** Validates and detaches before serializing; selectedLayer is only editor view.
 * Document metadata is intentional identity even when it does not change PCM. */
export function compositionExportKey(composition:Composition,soloLayers?:ReadonlySet<string>):string {
 const c=validateComposition(composition),solo=detachedSolo(c,soloLayers),{selectedLayer:_selected,...document}=c;
 return JSON.stringify({version:'compose-wav/v1',document,solo:[...solo].sort()});
}
function pcmBytes(buffer:AudioBuffer,expectedFrames?:number):number {
 if(!buffer||!Number.isSafeInteger(buffer.length)||buffer.length<1||buffer.numberOfChannels!==2||expectedFrames!==undefined&&buffer.length!==expectedFrames)throw new TypeError('Renderer returned invalid stereo PCM dimensions.');
 if(buffer.sampleRate!==COMPOSE_EXPORT_SAMPLE_RATE)throw new TypeError('Renderer returned an unexpected PCM sample rate.');
 if(!Number.isFinite(buffer.duration)||Math.abs(buffer.duration-buffer.length/COMPOSE_EXPORT_SAMPLE_RATE)>1/COMPOSE_EXPORT_SAMPLE_RATE)throw new TypeError('Renderer returned invalid PCM duration.');
 const bytes=buffer.length*8;
 if(!Number.isSafeInteger(bytes))throw new RangeError('Renderer returned invalid PCM dimensions.');
 return bytes;
}
function validatePcmSamples(buffer:AudioBuffer):void {
 for(let channel=0;channel<2;channel++){
  const samples=buffer.getChannelData(channel);
  if(!(samples instanceof Float32Array)||samples.length!==buffer.length)throw new TypeError('Renderer returned invalid PCM channel dimensions.');
  for(let frame=0;frame<samples.length;frame++)if(!Number.isFinite(samples[frame]))throw new TypeError('Renderer returned non-finite PCM.');
 }
}

/** Explicit export intent, independent of transport state or playback consent.
 * Render ONE active loop at beat zero, without wrapped onsets, plus every actual
 * canonical buffer tail and 20ms output-compressor padding. No device is opened.
 * Calls own detached snapshots; callers must fence document/scope changes too.
 * Abort is cooperative at async boundaries: native offline work already running
 * may finish, but its late result cannot trigger another render or return a WAV.
 * Progress counts unique canonical jobs plus final mixing/encoding, not notes. */
export async function renderCompositionWav(composition:Composition,options:CompositionWavOptions={},dependencies:Partial<ComposeExportDependencies>={}):Promise<CompositionWav> {
 const guard=()=>{if(options.signal?.aborted)throw new DOMException('Composition WAV export cancelled.','AbortError');};
 guard();
 const c=validateComposition(composition),solo=detachedSolo(c,options.soloLayers),spb=60/c.tempo,window=loopWindow(c),loopSeconds=(window.end-window.start)*spb;
 const render=dependencies.render??renderSoundPatch,createContext=dependencies.createContext??((channels,length,rate)=>new OfflineAudioContext(channels,length,rate));
 const patches=new Map<string,SoundPatch>(),notes:Note[]=[],layers=c.layers.filter(layer=>!layer.muted&&(!solo.size||solo.has(layer.id)));
 for(const layer of layers)for(const note of layer.notes){
  if(note.beat<window.start||note.beat>=window.end)continue;
  const patch=adaptComposeNote(layer.patch,note,c.tempo).patch,key=composePcmKey(patch);
  if(!patches.has(key))patches.set(key,patch);
  notes.push({layerId:layer.id,at:(note.beat-window.start)*spb,key});
 }
 if(!notes.length)throw new Error('No unmuted notes in this loop. Add a note, unmute a layer, or clear Solo before exporting.');
 const total=patches.size+1;
 const progress=(completed:number)=>{guard();options.onProgress?.(completed,total);guard();};
 progress(0);
 const buffers=new Map<string,AudioBuffer>(),unique=new Set<AudioBuffer>();
 let retainedBytes=0,completed=0,end=loopSeconds;
 for(const [key,patch]of patches){
  guard();const buffer=await render(patch,{sampleRate:COMPOSE_EXPORT_SAMPLE_RATE,masterGain:1});guard();
  const bytes=pcmBytes(buffer);
  if(!unique.has(buffer)){
   if(retainedBytes+bytes>COMPOSE_PCM_BUDGET)throw new RangeError('Composition exceeds the 96 MiB canonical PCM memory budget. Shorten effect tails or use fewer unique notes.');
   validatePcmSamples(buffer);unique.add(buffer);retainedBytes+=bytes;
  }
  buffers.set(key,buffer);progress(++completed);
 }
 for(const note of notes)end=Math.max(end,note.at+buffers.get(note.key)!.length/COMPOSE_EXPORT_SAMPLE_RATE);
 const frames=Math.ceil((end+COMPOSE_OUTPUT_PADDING_SECONDS)*COMPOSE_EXPORT_SAMPLE_RATE),mixedBytes=frames*8;
 // Account for both the rendered float mix and the separate interleaved WAV.
 if(!Number.isSafeInteger(frames)||frames<1||retainedBytes+mixedBytes*2+44>COMPOSE_EXPORT_BUFFER_BUDGET)throw new RangeError('Composition exceeds the 192 MiB export buffer memory budget (PCM, mix and WAV). Shorten effect tails or the loop.');
 guard();
 const ctx=createContext(2,frames,COMPOSE_EXPORT_SAMPLE_RATE),sources:AudioBufferSourceNode[]=[],buses:GainNode[]=[];
 let master:GainNode|undefined;
 try{
  if(ctx.length!==frames||ctx.sampleRate!==COMPOSE_EXPORT_SAMPLE_RATE)throw new TypeError('Offline mix context has invalid PCM dimensions or sample rate.');
  master=createComposeOutput(ctx);
  const byLayer=new Map<string,GainNode>();
  for(const layer of layers){const bus=ctx.createGain();bus.gain.value=10**(layer.gainDb/20);if(layer.pan){const pan=ctx.createStereoPanner();pan.pan.value=layer.pan;bus.connect(pan);pan.connect(master);}else bus.connect(master);buses.push(bus);byLayer.set(layer.id,bus);}
  for(const note of notes){guard();const source=ctx.createBufferSource();sources.push(source);source.buffer=buffers.get(note.key)!;source.connect(byLayer.get(note.layerId)!);source.start(note.at);}
  guard();const mixed=await ctx.startRendering();guard();
  pcmBytes(mixed,frames);validatePcmSamples(mixed);guard();
  const wav=encodeWav(mixed);guard();progress(total);
  return {wav,duration:frames/COMPOSE_EXPORT_SAMPLE_RATE,loopSeconds,sampleRate:COMPOSE_EXPORT_SAMPLE_RATE,noteCount:notes.length};
 }finally{
  // OfflineAudioContext has no close(). Drop owned source/buffer references even
  // on scheduling/render failures; never touch another engine or its consent.
  for(const source of sources){try{source.disconnect();source.buffer=null;}catch{/* Preserve the original render error. */}}
  for(const bus of [...buses,...(master?[master]:[])])try{bus.disconnect();}catch{/* Already disconnected. */}
  buffers.clear();unique.clear();
 }
}
