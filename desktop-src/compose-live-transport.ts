import {renderSoundPatch,type SoundPatch} from '../assets/studio-engine';
import {validateComposition,loopWindow,type Composition,type ComposeLayer} from './compose-model';
import {adaptComposeNote} from './compose-audio';
import {ComposePcmCache,composePcmKey,type PcmLease} from './compose-live-cache';
import {createComposeOutput} from './compose-mix';

export type ComposeAudioSnapshot=Readonly<{
 enabled:boolean;muted:boolean;playing:boolean;pending:boolean;positionBeat:number;error:string;contextState:'uninitialized'|AudioContextState;
 requestedRevision:number;appliedRevision:number;updating:boolean;applyAtBeat:number|null;updateError:string;
}>;
type Dependencies={createContext:()=>AudioContext;render:typeof renderSoundPatch;setInterval:(fn:()=>void,ms:number)=>ReturnType<typeof setInterval>;clearInterval:(id:ReturnType<typeof setInterval>)=>void;setTimeout:(fn:()=>void,ms:number)=>ReturnType<typeof setTimeout>;clearTimeout:(id:ReturnType<typeof setTimeout>)=>void};
type NoteSpec={id:string;beat:number;patch:SoundPatch;key:string};
type LayerSpec={id:string;signature:string;notes:NoteSpec[]};
type PreparedNote={id:string;beat:number;buffer:AudioBuffer;lease:PcmLease};
type PreparedLayer={signature:string;notes:PreparedNote[];leases:PcmLease[]};
type Schedule={revision:number;layers:Map<string,PreparedLayer>};
type Preparation={leases:Set<PcmLease>;cancelled:boolean};
type SourceRow={source:AudioBufferSourceNode;layerId:string;noteId:string;beat:number;at:number;identity:string;schedule:Schedule;lease:PcmLease;released:boolean};
const LOOKAHEAD=.2,GUARD=.02,MIN_LEAD=.005;
function layerSpecs(c:Composition):LayerSpec[]{return c.layers.map(layer=>{
 const window=loopWindow(c),notes=layer.notes.filter(note=>note.beat>=window.start&&note.beat<window.end).map(note=>{
  // Patch gain stays at the canonical renderer's pre-FX stage, including nonlinear FX.
  const patch=adaptComposeNote(layer.patch,note,c.tempo).patch;
  return {id:note.id,beat:note.beat,patch,key:composePcmKey(patch)};
 });
 return {id:layer.id,notes,signature:JSON.stringify(notes.map(n=>[n.id,n.beat,n.key]))};
});}
function releaseSchedule(schedule:Schedule|null){if(schedule)for(const layer of schedule.layers.values())for(const lease of layer.leases)lease.release();}
/** Lifetime invalidates consent/async work; revisions never reset the epoch/ticker.
 * Accepted A owns playback until the latest whole candidate reaches its cutover.
 * A ready-but-unaccepted B never becomes fallback authority for a failed C. */
export class ComposeAudio {
 private deps:Dependencies;
 private cache:ComposePcmCache;
 private context:AudioContext|null=null;
 private bus:GainNode|null=null;
 private layerBuses=new Map<string,GainNode>();
 private layerPans=new Map<string,StereoPannerNode>();
 private layerMeters=new Map<string,AnalyserNode>();
 private meterSamples=new Float32Array(256);
 private seekBeat=0;
 private composition:Composition|null=null;
 private identity='';
 private enableRequest=0;
 private lifetime=0;
 private disposed=false;
 private timer:ReturnType<typeof setInterval>|null=null;
 private updateTimer:ReturnType<typeof setTimeout>|null=null;
 private sources=new Set<SourceRow>();
 private onsetIdentities=new Set<string>();
 private listeners=new Set<()=>void>();
 private solo=new Set<string>();
 private accepted:Schedule|null=null;
 private staged:{schedule:Schedule;at:number;beat:number}|null=null;
 private preparation:Preparation|null=null;
 private playPromise:Promise<boolean>|null=null;
 private epoch=0;
 private through=0;
 private snapshot:ComposeAudioSnapshot=Object.freeze({enabled:false,muted:true,playing:false,pending:false,positionBeat:0,error:'',contextState:'uninitialized',requestedRevision:0,appliedRevision:0,updating:false,applyAtBeat:null,updateError:''});
 constructor(deps:Partial<Dependencies>={}){
  this.deps={createContext:()=>new AudioContext({sampleRate:48000}),render:renderSoundPatch,setInterval:(fn,ms)=>setInterval(fn,ms),clearInterval:id=>clearInterval(id),setTimeout:(fn,ms)=>setTimeout(fn,ms),clearTimeout:id=>clearTimeout(id),...deps};
  this.cache=new ComposePcmCache(this.deps.render);
 }
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 getSnapshot=()=>this.snapshot;
 /** Diagnostic counts only; never expose mutable cache authority. */
 getCacheSnapshot=()=>this.cache.snapshot();
 private publish(change:Partial<ComposeAudioSnapshot>){if(this.disposed)return;this.snapshot=Object.freeze({...this.snapshot,...change,contextState:this.context?.state??'uninitialized'});for(const fn of this.listeners)fn();}
 private audible(id:string){const layer=this.composition?.layers.find(l=>l.id===id);return !!layer&&!layer.muted&&(!this.solo.size||this.solo.has(id));}
 private busFor(layer:ComposeLayer){let bus=this.layerBuses.get(layer.id);if(!bus){bus=this.context!.createGain();let output:AudioNode=bus;if(typeof this.context!.createStereoPanner==='function'){const pan=this.context!.createStereoPanner();output.connect(pan);output=pan;this.layerPans.set(layer.id,pan);}if(typeof this.context!.createAnalyser==='function'){const meter=this.context!.createAnalyser();meter.fftSize=256;output.connect(meter);output=meter;this.layerMeters.set(layer.id,meter);}output.connect(this.bus!);this.layerBuses.set(layer.id,bus);}return bus;}
 readLevel=(id:string)=>{const meter=this.layerMeters.get(id);if(!meter||!this.snapshot.playing||this.snapshot.muted)return 0;meter.getFloatTimeDomainData(this.meterSamples);let peak=0;for(const v of this.meterSamples)peak=Math.max(peak,Math.abs(v));return peak;};
 seek(beat:number){if(!this.composition||!Number.isFinite(beat))return;const {start,end}=loopWindow(this.composition),playing=this.snapshot.playing;this.stop();this.seekBeat=Math.max(start,Math.min(end-.001,beat));this.publish({positionBeat:this.seekBeat});if(playing)void this.play();}
 private applyMix(){
  if(!this.context||!this.bus)return;
  const now=this.context.currentTime;
  for(const layer of this.composition?.layers??[]){const bus=this.busFor(layer),gain=this.audible(layer.id)?10**(layer.gainDb/20):0;bus.gain.setValueAtTime(gain,now);this.layerPans.get(layer.id)?.pan.setValueAtTime(layer.pan??0,now);}
  for(const [id,bus]of this.layerBuses)if(!this.composition?.layers.some(l=>l.id===id)){bus.gain.setValueAtTime(0,now);bus.disconnect();this.layerPans.get(id)?.disconnect();this.layerMeters.get(id)?.disconnect();this.layerBuses.delete(id);this.layerPans.delete(id);this.layerMeters.delete(id);}
  for(const row of [...this.sources])if(!this.audible(row.layerId)&&row.at>=now)this.cancelSource(row,now);
 }
 setComposition(value:Composition){
  if(this.disposed)return;
  const c=validateComposition(value),previous=this.composition;
  // Only musical content owns arrangement revisions. Mix authority is immediate
  // and must not revoke an already queued, otherwise-current musical candidate.
  const identity=JSON.stringify({id:c.id,tempo:c.tempo,meter:c.meter,bars:c.bars,window:loopWindow(c),layers:c.layers.map(l=>[l.id,composePcmKey(l.patch),l.notes])});
  if(previous&&(c.id!==previous.id||c.tempo!==previous.tempo||c.meter!==previous.meter||c.bars!==previous.bars||c.loopStart!==previous.loopStart||c.loopEnd!==previous.loopEnd))this.stop();
  this.commitIfDue();this.composition=c;this.applyMix();
  if(!this.snapshot.playing&&!this.snapshot.pending){const window=loopWindow(c);this.seekBeat=Math.max(window.start,Math.min(window.end-.001,this.seekBeat));if(this.snapshot.positionBeat!==this.seekBeat)this.publish({positionBeat:this.seekBeat});}
  if(identity===this.identity){
   this.restoreFuture();
   if(this.snapshot.updateError&&this.snapshot.playing){this.publish({updating:true,applyAtBeat:null,updateError:''});this.queueUpdate();}
   else this.ensureAudiblePrepared();
   return;
  }
  this.identity=identity;this.newRevision();
 }
 setSoloLayers(ids:ReadonlySet<string>):void {
  if(this.disposed)return;
  const next=new Set(ids);if(next.size===this.solo.size&&[...next].every(id=>this.solo.has(id)))return;
  this.commitIfDue();this.solo=next;this.applyMix();this.restoreFuture();this.ensureAudiblePrepared();
 }
 private newRevision(){
  this.cancelPreparation();this.discardStaged();
  this.publish({requestedRevision:this.snapshot.requestedRevision+1,updating:this.snapshot.playing,applyAtBeat:null,updateError:''});
  if(this.snapshot.playing)this.queueUpdate();
 }
 private cancelPreparation(){if(this.preparation){this.preparation.cancelled=true;for(const lease of this.preparation.leases)lease.release();this.preparation=null;}}
 private clearUpdateTimer(){if(this.updateTimer!==null){this.deps.clearTimeout(this.updateTimer);this.updateTimer=null;}}
 private discardStaged(restore=true){
  if(!this.staged){if(restore)this.restoreFuture();return;}
  const stage=this.staged;this.staged=null;const now=this.context?.currentTime??0;
  for(const row of [...this.sources])if(row.schedule===stage.schedule&&row.at>=now){
   // Rebind only an exact accepted onset/PCM match. Never let ready-but-unaccepted
   // changed B become fallback authority for requested or failed C. Source leases
   // remain owned by the same native nodes; sounding tails are never retracted.
   const same=this.accepted?.layers.get(row.layerId)?.notes.some(note=>note.id===row.noteId&&note.beat===row.beat&&note.buffer===row.source.buffer);
   if(restore&&same&&this.audible(row.layerId))row.schedule=this.accepted!;
   else this.cancelSource(row,now);
  }
  releaseSchedule(stage.schedule);
  // Restore A now, not on the next ticker: a short UI stall can cross the bar.
  if(restore)this.restoreFuture();
 }
 private restoreFuture(){
  if(!this.snapshot.playing||!this.accepted||!this.context||this.context.state!=='running'||this.snapshot.muted)return;
  const now=this.context.currentTime,until=Math.max(this.through,now+LOOKAHEAD);
  try{this.scheduleWindow(now,until);this.through=until;}
  catch(error){this.stop();this.publish({error:error instanceof Error?error.message:'Audio scheduling failed.'});}
 }
 private ensureAudiblePrepared(){
  if(!this.snapshot.playing||this.preparation||this.updateTimer!==null)return;
  const target=this.staged?.schedule??this.accepted;
  if(target?.revision!==this.snapshot.requestedRevision)return;
  if(this.composition!.layers.some(layer=>this.audible(layer.id)&&!target.layers.has(layer.id))){
   // An initially inaudible layer can have no prepared PCM. Fill that missing
   // material under the same musical revision, with normal latest/lifetime guards.
   this.discardStaged();this.publish({updating:true,applyAtBeat:null,updateError:''});this.queueUpdate();
  }
 }
 private current(token:number,revision:number){return !this.disposed&&this.lifetime===token&&this.snapshot.requestedRevision===revision&&this.context?.state==='running'&&!this.snapshot.muted;}
 /** User gesture only. Enable never starts playback. */
 async enable():Promise<boolean>{
  if(this.disposed)return false;
  const token=this.lifetime,revision=this.snapshot.requestedRevision,request=++this.enableRequest;
  try{
   if(!this.context){const ctx=this.context=this.deps.createContext();this.bus=createComposeOutput(ctx);
    ctx.onstatechange=()=>{if(ctx.state!=='running')this.stop();this.publish({});};
   }
   await this.context.resume();
   if(request!==this.enableRequest||token!==this.lifetime||revision!==this.snapshot.requestedRevision||this.disposed)return false;
   if(this.context.state!=='running')throw new Error('Audio device is not running. Enable audio again.');
   this.applyMix();this.publish({enabled:true,muted:false,error:''});return true;
  }catch(e){if(request===this.enableRequest&&token===this.lifetime&&revision===this.snapshot.requestedRevision)this.publish({enabled:false,muted:true,error:e instanceof Error?e.message:'Audio enable failed.'});return false;}
 }
 mute(){this.stop();this.publish({muted:true});}
 private releaseSource(row:SourceRow){if(row.released)return;row.released=true;row.source.disconnect();row.lease.release();this.sources.delete(row);this.onsetIdentities.delete(row.identity);}
 private cancelSource(row:SourceRow,at:number){try{row.source.stop(at);}catch{/* Already ended. */}this.releaseSource(row);}
 stop(){
  this.lifetime++;this.clearUpdateTimer();this.cancelPreparation();this.discardStaged(false);
  if(this.timer!==null){this.deps.clearInterval(this.timer);this.timer=null;}
  const now=this.context?.currentTime??0;for(const row of [...this.sources])this.cancelSource(row,now);
  releaseSchedule(this.accepted);this.accepted=null;this.playPromise=null;
  this.seekBeat=this.composition?loopWindow(this.composition).start:0;
  this.publish({playing:false,pending:false,positionBeat:this.seekBeat,updating:false,applyAtBeat:null,updateError:''});
 }
 private async prepare(c:Composition,token:number,revision:number):Promise<Schedule>{
  const scope:Preparation={leases:new Set(),cancelled:false};this.preparation=scope;
  const schedule:Schedule={revision,layers:new Map()};
  const guard=()=>{if(scope.cancelled||!this.current(token,revision))throw new Error('Obsolete arrangement preparation.');};
  try{
   const specs=layerSpecs(c);
   // A mix change may reveal a layer skipped earlier while another render was
   // awaiting PCM. Rescan missing audible layers before returning whole authority.
   let remaining=specs;
   while(remaining.length){
    for(const spec of remaining){
    guard();const prior=this.accepted?.layers.get(spec.id);
    if(prior?.signature===spec.signature){
     const retained=new Map<PcmLease,PcmLease>();for(const lease of prior.leases){const held=lease.retain();scope.leases.add(held);retained.set(lease,held);}
     schedule.layers.set(spec.id,{signature:spec.signature,leases:[...retained.values()],notes:prior.notes.map(n=>({...n,lease:retained.get(n.lease)!}))});continue;
    }
    // New inaudible material need not render; already accepted layers above remain
    // available for immediate future restoration after clearing mute/solo.
    if(!this.audible(spec.id))continue;
    const notes:PreparedNote[]=[],leases=new Map<string,PcmLease>();
    for(const note of spec.notes){
     guard();let lease=leases.get(note.key);if(!lease){lease=this.cache.acquire(note.key,note.patch);leases.set(note.key,lease);scope.leases.add(lease);}
     const buffer=await lease.ready;guard();notes.push({id:note.id,beat:note.beat,buffer,lease});
    }
    schedule.layers.set(spec.id,{signature:spec.signature,notes,leases:[...leases.values()]});
    }
    remaining=specs.filter(spec=>this.audible(spec.id)&&!schedule.layers.has(spec.id));
   }
   guard();if(this.preparation===scope)this.preparation=null;return schedule;
  }catch(error){for(const lease of scope.leases)lease.release();if(this.preparation===scope)this.preparation=null;throw error;}
 }
 play():Promise<boolean>{
  if(this.disposed||!this.snapshot.enabled||this.snapshot.muted||this.context?.state!=='running'||!this.composition)return Promise.resolve(false);
  if(this.snapshot.playing)return Promise.resolve(true);
  if(this.playPromise)return this.playPromise;
  const token=this.lifetime;this.publish({pending:true,error:''});
  const task=this.start(token);this.playPromise=task;void task.finally(()=>{if(this.playPromise===task)this.playPromise=null;});return task;
 }
 private async start(token:number):Promise<boolean>{
  while(!this.disposed&&token===this.lifetime){
   const revision=this.snapshot.requestedRevision,c=this.composition!;
   try{
    const schedule=await this.prepare(c,token,revision);
    if(!this.current(token,revision)){releaseSchedule(schedule);continue;}
    if(![...schedule.layers].some(([id,l])=>this.audible(id)&&l.notes.length)){releaseSchedule(schedule);throw new Error('No unmuted notes in this loop. Add a note or unmute a layer.');}
    const start=loopWindow(c).start,offset=Math.max(0,this.seekBeat-start)*60/c.tempo;
    this.accepted=schedule;this.epoch=this.context!.currentTime+.06-offset;this.through=this.context!.currentTime+.059;
    this.publish({pending:false,playing:true,appliedRevision:revision,updating:false,updateError:''});this.tick();
    if(token!==this.lifetime||!this.snapshot.playing)return false;
    this.timer=this.deps.setInterval(()=>this.tick(),25);return true;
   }catch(error){
    if(token!==this.lifetime||this.disposed)return false;
    if(revision!==this.snapshot.requestedRevision)continue;
    this.publish({pending:false,error:error instanceof Error?error.message:'Arrangement preparation failed.'});return false;
   }
  }
  return false;
 }
 private queueUpdate(){
  this.clearUpdateTimer();const token=this.lifetime,revision=this.snapshot.requestedRevision,c=this.composition!;
  this.updateTimer=this.deps.setTimeout(()=>{this.updateTimer=null;void this.prepareUpdate(c,token,revision);},120);
 }
 private async prepareUpdate(c:Composition,token:number,revision:number){
  try{
   const schedule=await this.prepare(c,token,revision);
   if(!this.current(token,revision)||!this.snapshot.playing){releaseSchedule(schedule);return;}
   const spb=60/c.tempo,barSeconds=c.meter*spb;
   // Strictly beyond the queued horizon, actual source onsets, and guarded clock.
   const scheduledThrough=Math.max(this.through,...[...this.sources].map(row=>row.at));
   const after=Math.max(scheduledThrough,this.context!.currentTime+LOOKAHEAD+GUARD);
   const bar=Math.max(0,Math.floor((after-this.epoch)/barSeconds)+1),beat=bar*c.meter,at=this.epoch+bar*barSeconds;
   this.staged={schedule,at,beat};
   for(const row of [...this.sources])if(row.at>=at)this.cancelSource(row,this.context!.currentTime);
   this.publish({applyAtBeat:beat,updateError:''});
  }catch(error){if(this.current(token,revision)&&this.snapshot.playing)this.publish({updating:false,applyAtBeat:null,updateError:error instanceof Error?error.message:'Arrangement preparation failed.'});}
 }
 private commitIfDue(){
  if(!this.staged||!this.context||this.context.currentTime<this.staged.at)return;
  const stage=this.staged;this.staged=null;
  if(stage.schedule.revision!==this.snapshot.requestedRevision){releaseSchedule(stage.schedule);return;}
  releaseSchedule(this.accepted);this.accepted=stage.schedule;
  this.publish({appliedRevision:stage.schedule.revision,updating:false,applyAtBeat:null,updateError:''});
 }
 private scheduleRange(schedule:Schedule,from:number,until:number){
  if(until<=from)return;
  const c=this.composition!,ctx=this.context!,spb=60/c.tempo,window=loopWindow(c),loopSeconds=(window.end-window.start)*spb;
  const first=Math.max(0,Math.floor((from-this.epoch)/loopSeconds)),last=Math.max(0,Math.floor((until-this.epoch)/loopSeconds));
  for(let cycle=first;cycle<=last;cycle++)for(const [layerId,layer]of schedule.layers){
   if(!this.audible(layerId))continue;
   for(const note of layer.notes){
    const at=this.epoch+cycle*loopSeconds+(note.beat-window.start)*spb;if(at<from||at>=until)continue;
    const identity=JSON.stringify([layerId,note.id,cycle,at]);if(this.onsetIdentities.has(identity))continue;
    const source=ctx.createBufferSource(),lease=note.lease.retain();source.buffer=note.buffer;source.connect(this.layerBuses.get(layerId)!);
    const row:SourceRow={source,lease,layerId,noteId:note.id,beat:note.beat,at,identity,schedule,released:false};this.sources.add(row);this.onsetIdentities.add(identity);
    source.onended=()=>this.releaseSource(row);
    // Restoration deliberately has no ticker lead guard. Recheck after node
    // setup so a clock advance cannot turn a valid future into a past start.
    if(at<ctx.currentTime){this.releaseSource(row);continue;}
    try{source.start(at);}catch(error){this.releaseSource(row);throw error;}
   }
  }
 }
 private scheduleWindow(from:number,until:number){
  if(this.staged){this.scheduleRange(this.accepted!,from,Math.min(until,this.staged.at));this.scheduleRange(this.staged.schedule,Math.max(from,this.staged.at),until);}
  else if(this.accepted)this.scheduleRange(this.accepted,from,until);
 }
 private tick(){
  if(this.disposed||!this.snapshot.playing)return;
  const ctx=this.context!;if(ctx.state!=='running'){this.stop();return;}
  this.commitIfDue();const now=ctx.currentTime,from=Math.max(this.through,now+MIN_LEAD),until=now+LOOKAHEAD;
  try{
   this.scheduleWindow(from,until);
   this.through=until;
   const window=loopWindow(this.composition!);this.publish({positionBeat:window.start+Math.max(0,(now-this.epoch)/(60/this.composition!.tempo))%(window.end-window.start)});
  }catch(error){this.stop();this.publish({error:error instanceof Error?error.message:'Audio scheduling failed.'});}
 }
 async dispose(){if(this.disposed)return;this.stop();const ctx=this.context;this.publish({enabled:false,muted:true});this.disposed=true;this.listeners.clear();this.cache.clear();if(ctx){ctx.onstatechange=null;await ctx.close();}for(const bus of [...this.layerBuses.values(),...this.layerPans.values(),...this.layerMeters.values()])bus.disconnect();this.layerBuses.clear();this.layerPans.clear();this.layerMeters.clear();this.context=null;this.bus=null;}
}
