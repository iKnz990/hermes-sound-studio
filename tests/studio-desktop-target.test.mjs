import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const built=await build({stdin:{contents:`export * from './desktop-src/studio-desktop-target';export * from './desktop-src/studio-store';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const api=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].contents).toString('base64'));
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function fixture(){
 const handlers=new Map(),calls=[],listeners=new Set();let time=0,scope={profile:'default',connection:'local',session:'s1',connected:true};
 const engine={state:{enabled:false,muted:true,contextState:'uninitialized',activeVoices:0,lastEvent:null,error:null,energy:0},
  getSnapshot(){return this.state;},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},setTheme(t){calls.push(['theme',structuredClone(t)]);},setCssTarget(t){calls.push(['target',t]);},
  async enable(){this.state={...this.state,enabled:true,muted:false,contextState:'running'};},setMuted(muted){this.state={...this.state,muted,enabled:!muted&&this.state.contextState==='running'};if(muted)this.stopAll();for(const fn of listeners)fn();},
  stopAll(){calls.push(['stop']);},async trigger(event){calls.push(['trigger',event]);return true;},async dispose(){calls.push(['dispose']);},getLiveFrame(){return {wave:new Float32Array(256),peaks:[0,0]};}};
 const doc={documentElement:{id:'desktop-root'},addEventListener(name,fn){handlers.set(name,fn);},removeEventListener(name,fn){if(handlers.get(name)===fn)handlers.delete(name);}};
 const rows=new Map(),store=api.createStudioStore({get:(k,f)=>rows.get(k)??f,set:(k,v)=>rows.set(k,structuredClone(v))});
 const target=api.createDesktopSoundTarget({store,document:doc,readScope:()=>scope,createEngine:()=>engine,now:()=>time});
 const element=(tag='BUTTON',attrs={})=>({tagName:tag,closest(selector){if(selector.startsWith('[data-'))return attrs.studio?this:null;if(selector.startsWith('[disabled]'))return attrs.disabled?this:null;if(selector==='form')return attrs.form?this:null;return this;},getAttribute:n=>attrs[n]??null,hasAttribute:n=>n in attrs,contains:n=>n===attrs.child});
 const emit=(name,node=element(),extra={})=>{time+=1000;handlers.get(name)?.({isTrusted:true,target:node,composedPath:()=>[node],...extra});};
 return {target,store,engine,doc,handlers,calls,element,emit,scope:value=>{scope={...scope,...value};},tick:()=>{time+=1000;},events:()=>calls.filter(c=>c[0]==='trigger').map(c=>c[1])};
}
test('off by default, explicit enable targets desktop and Disable removes listeners and audio',async()=>{
 const f=fixture();assert.equal(f.target.getSnapshot().enabled,false);assert.equal(f.handlers.size,0);assert.deepEqual(f.events(),[]);
 await f.target.enable();assert.equal(f.handlers.size,6);assert.ok(f.calls.some(c=>c[0]==='target'&&c[1]===f.doc.documentElement));assert.deepEqual(f.events(),[]);
 f.target.disable();assert.equal(f.handlers.size,0);assert.equal(f.target.getSnapshot().enabled,false);assert.equal(f.engine.state.muted,true);f.emit('click');assert.deepEqual(f.events(),[]);f.target.dispose();
});
test('trusted host hover/focus/actions/toggles/validation map to the assigned events',async()=>{
 const f=fixture();await f.target.enable();f.emit('pointerover');f.emit('focusin');f.emit('click');f.emit('click',f.element('BUTTON',{role:'switch'}));f.emit('change',f.element('INPUT',{type:'checkbox'}));f.emit('change',f.element('SELECT'));f.emit('invalid',f.element('INPUT'));
 assert.deepEqual(f.events(),['onHover','onFocus','onCommit','onToggle','onToggle','onToggle','onError']);await flush();assert.equal(f.target.getSnapshot().lastEvent,'onError');f.target.dispose();
});
test('Studio controls, synthetic events, disabled controls and non-actions stay quiet',async()=>{
 const f=fixture();await f.target.enable();f.emit('click',f.element('BUTTON',{studio:true}));f.emit('click',f.element(),{isTrusted:false});f.emit('click',f.element('BUTTON',{disabled:true}));f.emit('click',f.element('TEXTAREA'));f.emit('click',f.element('DIV'));f.emit('click',f.element('INPUT',{type:'checkbox'}));f.emit('pointerover',f.element('BUTTON',{child:'nested'}),{relatedTarget:'nested'});
 assert.deepEqual(f.events(),[]);f.target.dispose();
});
test('a form confirmation is emitted by submit, not also by its submit button',async()=>{
 const f=fixture();await f.target.enable();f.emit('click',f.element('BUTTON',{form:true}));assert.deepEqual(f.events(),[]);f.emit('submit',f.element('FORM'));assert.deepEqual(f.events(),['onCommit']);f.target.dispose();
});
test('live assignment edits synchronize all six canonical patches without enabling by themselves',async()=>{
 const f=fixture(),before=f.store.state.theme;f.store.setPatch({...before.events.onCommit,name:'Assigned chime',intensity:42});assert.equal(f.target.getSnapshot().enabled,false);assert.equal(f.calls.at(-1)[0],'theme');assert.equal(f.calls.at(-1)[1].events.onCommit.intensity,42);
 await f.target.enable();f.store.setPatch({...f.store.state.theme.events.onCommit,intensity:21});assert.equal(f.calls.at(-1)[1].events.onCommit.intensity,21);f.target.dispose();
});
test('backend sounds follow focused connection/profile/session and deduplicate completion IDs',async()=>{
 const f=fixture();await f.target.enable();const event={type:'message.complete',session_id:'s1',profile:'default',connectionId:'local',payload:{status:'complete',message_id:'m1'}};
 f.target.handleEvent({...event,session_id:'other'});f.target.handleEvent({...event,profile:'other'});f.target.handleEvent({...event,connectionId:'remote'});assert.deepEqual(f.events(),[]);
 f.target.handleEvent(event);f.tick();f.target.handleEvent(event);assert.deepEqual(f.events(),['onBackgroundTaskComplete']);
 f.tick();f.target.handleEvent({...event,type:'tool.complete',payload:{is_error:true}});assert.deepEqual(f.events(),['onBackgroundTaskComplete','onError']);
 f.scope({profile:'other',connection:'remote',session:'s2'});f.tick();f.target.handleEvent({...event,profile:'other',connectionId:'remote',session_id:'s2'});assert.equal(f.events().at(-1),'onBackgroundTaskComplete');f.target.dispose();
});
test('mute and suspended audio never trigger or silently resume the device',async()=>{
 const f=fixture();await f.target.enable();f.target.setMuted(true);f.emit('click');assert.deepEqual(f.events(),[]);f.target.setMuted(false);f.emit('click');assert.deepEqual(f.events(),['onCommit']);
 f.engine.state={...f.engine.state,contextState:'suspended'};f.emit('click');assert.deepEqual(f.events(),['onCommit']);f.target.dispose();
});
test('cancelling deferred Enable and disposing cannot reattach or schedule late work',async()=>{
 const f=fixture();let resolve;f.engine.enable=()=>new Promise(r=>{resolve=r;});const pending=f.target.enable();assert.equal(f.target.getSnapshot().pending,true);f.target.disable();resolve();assert.equal(await pending,false);assert.equal(f.handlers.size,0);assert.equal(f.target.getSnapshot().enabled,false);
 f.target.dispose();assert.equal(await f.target.enable(),false);assert.equal(f.handlers.size,0);
});
test('scope changes stop old voices while retaining explicit desktop target consent',async()=>{
 const f=fixture();await f.target.enable();f.emit('click');await flush();assert.equal(f.target.getSnapshot().lastEvent,'onCommit');const stops=f.calls.filter(c=>c[0]==='stop').length;
 f.target.scopeChanged();assert.equal(f.target.getSnapshot().enabled,true);assert.equal(f.target.getSnapshot().lastEvent,null);assert.equal(f.calls.filter(c=>c[0]==='stop').length,stops+1);f.emit('click');assert.equal(f.events().at(-1),'onCommit');f.target.dispose();
});
test('scope changes cancel a pending initial Enable without leaving the UI pending',async()=>{
 const f=fixture();let resolve;f.engine.enable=()=>new Promise(r=>{resolve=r;});const pending=f.target.enable();f.target.scopeChanged();assert.equal(f.target.getSnapshot().pending,false);resolve();assert.equal(await pending,false);assert.equal(f.target.getSnapshot().enabled,false);assert.equal(f.handlers.size,0);f.target.dispose();
});
