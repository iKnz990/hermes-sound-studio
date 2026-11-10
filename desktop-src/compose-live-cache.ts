import {type SoundPatch,type renderSoundPatch} from '../assets/studio-engine';

export const COMPOSE_PCM_BUDGET=96*1024*1024;
const ENGINE_ID='sound-studio-dsp/v1:compose-pcm/v1';
/** Call only with a validated, adapted patch. Names/style/character do not affect DSP.
 * Playback gain, stereo and seed remain canonical DSP; layer balance is external. */
export function composePcmKey(patch:SoundPatch):string {
 const {name:_name,style:_style,character:_character,...dsp}=patch;
 return JSON.stringify({engine:ENGINE_ID,sampleRate:48000,masterGain:1,patch:dsp});
}
type Entry={key:string;refs:number;last:number;buffer?:AudioBuffer;ready:Promise<AudioBuffer>};
export type PcmLease={ready:Promise<AudioBuffer>;retain:()=>PcmLease;release:()=>void};
/** Active arrangements, staged preparation and scheduled/sounding sources own leases.
 * The aggregate counts actual unique AudioBuffers (frames * channels * float32), not
 * duration estimates. Renders are serialized. One in-flight OfflineAudioContext can
 * transiently exceed the budget before its actual returned size can be measured;
 * that result is rejected rather than admitted over budget. Unreferenced resolved
 * entries form a byte-bounded and 128-entry LRU. Unowned pending jobs lose authority
 * immediately: their late results cannot reinsert themselves into the cache. */
export class ComposePcmCache {
 private entries=new Map<string,Entry>();
 private serial:Promise<unknown>=Promise.resolve();
 private clock=0;
 constructor(private render:typeof renderSoundPatch){}
 snapshot(){const buffers=new Set<AudioBuffer>();let pending=0,referenced=0;for(const e of this.entries.values()){if(e.buffer)buffers.add(e.buffer);else pending++;if(e.refs)referenced++;}return Object.freeze({bytes:[...buffers].reduce((n,b)=>n+b.length*b.numberOfChannels*4,0),entries:this.entries.size,pending,referenced});}
 private trim(){
  const free=[...this.entries.values()].filter(e=>e.refs===0&&e.buffer).sort((a,b)=>a.last-b.last);
  while(free.length&&(this.snapshot().bytes>COMPOSE_PCM_BUDGET||free.length>128)){const e=free.shift()!;this.entries.delete(e.key);}
 }
 acquire(key:string,patch:SoundPatch):PcmLease {
  let entry=this.entries.get(key);
  if(!entry){
   const e:Entry={key,refs:0,last:++this.clock,ready:Promise.resolve(null as unknown as AudioBuffer)};
   this.entries.set(key,e);
   e.ready=this.serial.then(async()=>{
    if(this.entries.get(key)!==e||e.refs===0)throw new Error('Obsolete PCM preparation.');
    const buffer=await this.render(patch,{sampleRate:48000,masterGain:1});
    if(this.entries.get(key)!==e||e.refs===0)throw new Error('Obsolete PCM preparation.');
    if(!Number.isSafeInteger(buffer.length)||buffer.length<1||!Number.isSafeInteger(buffer.numberOfChannels)||buffer.numberOfChannels<1)throw new Error('Renderer returned invalid PCM dimensions.');
    e.buffer=buffer;this.trim();
    if(this.snapshot().bytes>COMPOSE_PCM_BUDGET){e.buffer=undefined;throw new Error('Composition exceeds the 96 MiB audio memory budget. Shorten FX tails or use fewer unique notes.');}
    return buffer;
   }).catch(error=>{if(this.entries.get(key)===e)this.entries.delete(key);throw error;});
   this.serial=e.ready.catch(()=>{});entry=e;
  }
  return this.lease(entry);
 }
 private lease(entry:Entry):PcmLease {
  entry.refs++;entry.last=++this.clock;let released=false;
  return {ready:entry.ready,retain:()=>{if(released)throw new Error('Released PCM lease.');return this.lease(entry)},release:()=>{if(released)return;released=true;entry.refs--;entry.last=++this.clock;if(entry.refs===0&&!entry.buffer&&this.entries.get(entry.key)===entry)this.entries.delete(entry.key);this.trim();}};
 }
 clear(){this.entries.clear();}
}
