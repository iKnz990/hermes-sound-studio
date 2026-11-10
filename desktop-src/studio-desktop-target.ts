import {SoundStudioEngine,type SoundEvent,type SoundTheme} from '../assets/studio-engine';
import type {StudioStore} from './studio-store';

export type DesktopEventScope={profile:string;connection:string;session:string|null;connected:boolean};
type WireEvent={type?:unknown;profile?:unknown;connectionId?:unknown;session_id?:unknown;payload?:Record<string,unknown>};
type TargetEngine=Pick<SoundStudioEngine,'enable'|'setMuted'|'stopAll'|'setTheme'|'setCssTarget'|'getSnapshot'|'subscribe'|'trigger'|'dispose'|'getLiveFrame'>;
const INTERACTIVE='button,a[href],input,select,textarea,[role="button"],[role="switch"],[role="checkbox"],[role="radio"],[role="tab"],[role="menuitem"],[role="textbox"],[tabindex]';
const STUDIO='[data-sound-studio],[data-sonic-studio],[data-sonic-chip],[data-desktop-sound-controls]';

/** A renderer-lifetime target: assignments survive route changes, consent does not survive reload. */
export function createDesktopSoundTarget({store,document:doc,readScope,createEngine=theme=>new SoundStudioEngine(theme),onEnable=()=>{},now=()=>performance.now()}:{store:StudioStore;document:Document;readScope:()=>DesktopEventScope;createEngine?:(theme:SoundTheme)=>TargetEngine;onEnable?:()=>void;now?:()=>number}) {
 const engine=createEngine(store.state.theme),listeners=new Set<()=>void>();
 let enabled=false,pending=false,error='',disposed=false,generation=0,attached=false,lastEvent:SoundEvent|null=null;
 let snapshot:Readonly<{enabled:boolean;pending:boolean;error:string;lastEvent:SoundEvent|null;audio:ReturnType<TargetEngine['getSnapshot']>}>=Object.freeze({enabled,pending,error,lastEvent,audio:engine.getSnapshot()});
 const publish=()=>{if(disposed)return;snapshot=Object.freeze({enabled,pending,error,lastEvent,audio:engine.getSnapshot()});for(const fn of listeners)fn();};
 const recent=new Map<SoundEvent,number>(),completed=new Set<string>();
 const trigger=(event:SoundEvent)=>{
  if(disposed||!enabled||pending)return;
  const audio=engine.getSnapshot();if(!audio.enabled||audio.muted||audio.contextState!=='running')return;
  const time=now(),interval=event==='onHover'?100:event==='onError'?350:event==='onBackgroundTaskComplete'?600:65;
  if(time-(recent.get(event)??-Infinity)<interval)return;recent.set(event,time);
  const token=generation;
  void engine.trigger(event).then(played=>{if(!disposed&&token===generation&&played){lastEvent=event;publish();}}).catch(e=>{if(!disposed&&token===generation){error=e instanceof Error?e.message:'Desktop sound unavailable';publish();}});
 };
 const control=(event:Event):Element|null=>{
  if(!event.isTrusted)return null;
  const path=event.composedPath?.()??[event.target];
  if(path.some(node=>typeof (node as Element)?.closest==='function'&&(node as Element).closest(STUDIO)))return null;
  const target=path.find(node=>typeof (node as Element)?.closest==='function') as Element|undefined;
  const element=target?.closest(INTERACTIVE)??null;
  if(!element||element.closest('[disabled],[aria-disabled="true"],[inert]'))return null;
  return element;
 };
 const hover=(event:Event)=>{const element=control(event);if(!element)return;const related=(event as MouseEvent).relatedTarget;if(related&&element.contains(related as Node))return;trigger('onHover');};
 const focus=(event:Event)=>{if(control(event))trigger('onFocus');};
 const click=(event:Event)=>{
  const element=control(event);if(!element)return;
  const tag=element.tagName.toLowerCase(),type=element.getAttribute('type')?.toLowerCase(),role=element.getAttribute('role');
  if(!['button','a','input'].includes(tag)&&!['button','switch','checkbox','radio','tab','menuitem'].includes(role??''))return;
  if(tag==='input'&&type!=='button'&&type!=='submit'&&type!=='reset'||tag==='select'||tag==='textarea'||role==='textbox')return;
  if((tag==='button'&&(type??'submit')==='submit'||tag==='input'&&type==='submit')&&element.closest('form'))return;
  trigger(['switch','checkbox','radio','tab'].includes(role??'')||element.hasAttribute('aria-pressed')?'onToggle':'onCommit');
 };
 const change=(event:Event)=>{const element=control(event);if(!element)return;const type=element.getAttribute('type');if(element.tagName==='SELECT'||element.tagName==='INPUT'&&['checkbox','radio'].includes(type??''))trigger('onToggle');};
 const submit=(event:Event)=>{if(event.isTrusted&&!(event.target as Element)?.closest?.(STUDIO))trigger('onCommit');};
 const invalid=(event:Event)=>{if(control(event))trigger('onError');};
 const handlers:Record<string,EventListener>={pointerover:hover,focusin:focus,click,change,submit,invalid};
 const attach=()=>{if(attached)return;for(const [name,fn] of Object.entries(handlers))doc.addEventListener(name,fn,true);attached=true;};
 const detach=()=>{if(!attached)return;for(const [name,fn] of Object.entries(handlers))doc.removeEventListener(name,fn,true);attached=false;};
 const offAudio=engine.subscribe(publish);
 const offStore=store.subscribe(()=>{if(disposed)return;try{engine.setTheme(store.state.theme);error='';publish();}catch(e){error=e instanceof Error?e.message:'Invalid event assignments';publish();}});
 const disable=()=>{if(disposed)return;generation++;enabled=false;pending=false;error='';lastEvent=null;recent.clear();completed.clear();detach();engine.setCssTarget(undefined);engine.setMuted(true);publish();};
 return {
  engine,subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};},getSnapshot:()=>snapshot,
  async enable(){
   if(disposed||pending)return false;const token=++generation;pending=true;error='';publish();
   try{engine.setTheme(store.state.theme);await engine.enable();if(disposed||token!==generation)return false;onEnable();enabled=true;pending=false;engine.setCssTarget(doc.documentElement);attach();publish();return true;}
   catch(e){if(!disposed&&token===generation){enabled=false;pending=false;error=e instanceof Error?e.message:'Desktop audio could not be enabled';detach();engine.setMuted(true);publish();}return false;}
  },disable,
  scopeChanged(){if(disposed)return;generation++;pending=false;recent.clear();lastEvent=null;engine.stopAll();if(!enabled)engine.setMuted(true);publish();},
  setMuted(value:boolean){if(disposed||!enabled||engine.getSnapshot().contextState!=='running')return false;generation++;recent.clear();engine.setMuted(value);publish();return true;},
  /** Backend outcomes are accepted only for the currently focused connection/profile/session. */
  handleEvent(raw:unknown){
   if(disposed||!enabled||!raw||typeof raw!=='object')return;
   const event=raw as WireEvent,scope=readScope(),payload=event.payload;
   if(!scope.connected||!scope.session||event.session_id!==scope.session||(event.profile??'default')!==scope.profile||(event.connectionId??'local')!==scope.connection||!payload||typeof payload!=='object')return;
   if(event.type==='error'||event.type==='tool.complete'&&payload.is_error===true||event.type==='message.complete'&&(payload.status==='error'||!!payload.error)){trigger('onError');return;}
   const complete=event.type==='message.complete'&&payload.status==='complete'&&!payload.error||event.type==='subagent.complete'&&['completed','success'].includes(String(payload.status));
   if(!complete)return;
   const id=event.type==='subagent.complete'?payload.subagent_id:payload.message_id??payload.turn_id??payload.id;
   if(typeof id==='string'){const key=JSON.stringify([scope.connection,scope.profile,scope.session,event.type,id]);if(completed.has(key))return;completed.add(key);if(completed.size>256)completed.delete(completed.values().next().value!);}
   trigger('onBackgroundTaskComplete');
  },
  dispose(){if(disposed)return;disable();disposed=true;detach();offStore();offAudio();listeners.clear();void engine.dispose();},
 };
}
export type DesktopSoundTarget=ReturnType<typeof createDesktopSoundTarget>;
