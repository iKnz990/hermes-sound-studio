import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import Module from 'node:module';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
let slots=[],cursor=0,cleanups=[];
const React={createContext:value=>({_value:value}),useRef:init=>{const i=cursor++;return slots[i]??(slots[i]={current:init});},useEffect:fn=>{const i=cursor++;if(!slots[i]){slots[i]={};const off=fn();if(off)cleanups.push(off);}},useLayoutEffect:fn=>React.useEffect(fn)};
const jsx=(type,props)=>({type,props});
async function load(entry,stub=false){const b=await build({absWorkingDir:root,entryPoints:[entry],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime']});const m=new Module(path.join(root,'tests/curve-gesture.memory.cjs'));m.filename=m.id;m.paths=Module._nodeModulePaths(root);const require=m.require.bind(m);m.require=id=>stub&&id==='react'?React:stub&&id==='react/jsx-runtime'?{jsx,jsxs:jsx,Fragment:'Fragment'}:require(id);m._compile(b.outputFiles[0].text,m.filename);return m.exports;}
const ui=await load('desktop-src/studio-workspace.tsx',true),{createComposeStore}=await load('desktop-src/compose-store.ts'),{setAdsrStage}=await load('desktop-src/studio-data.ts');
const flatten=v=>Array.isArray(v)?v.flatMap(flatten):v&&typeof v==='object'?[v,...flatten(v.props?.children)]:[];
function fixture(){
 slots=[];cursor=0;cleanups=[];const data=new Map(),store=createComposeStore({get:(k,f)=>data.has(k)?structuredClone(data.get(k)):f,set:(k,v)=>data.set(k,structuredClone(v))});
 const initial=structuredClone(store.state.composition);let begins=0,ends=0,circle,releases=0;
 const envelope=ui.EnvelopeCurve({patch:initial.layers[0].patch,onChange:(key,value)=>store.update(c=>({...c,layers:c.layers.map((l,i)=>i?l:{...l,patch:setAdsrStage(l.patch,key,value)})})),onGestureStart:()=>{begins++;store.beginGesture();},onGestureEnd:()=>{ends++;store.endGesture();}});
 const props=flatten(envelope).find(n=>n.type?.name==='CurveHandle'&&n.props.label==='Attack').props;
 const captured=new Set(),node={setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>{releases++;captured.delete(id);circle.props.onLostPointerCapture?.(event(id));},ownerSVGElement:{getScreenCTM:()=>({inverse:()=>({a:1,b:0,c:0,d:1,e:0,f:0})}),createSVGPoint:()=>({x:0,y:0,matrixTransform(){return {x:this.x,y:this.y};}})}};
 const event=(id=1,button=0)=>({button,pointerId:id,currentTarget:node,clientX:305,clientY:15});
 const render=(overrides={})=>{cursor=0;return circle=ui.CurveHandle({...props,...overrides});};render();
 return {store,initial,event,node,captured,render,get circle(){return circle;},counts:()=>({begins,ends,releases}),unmount:()=>cleanups.forEach(off=>off()),drag:()=>{circle.props.onPointerDown(event());circle.props.onPointerMove(event());}};
}
for(const ending of ['pointerup','pointercancel','lostcapture','unmount'])test(`ADSR ${ending} closes one gesture before an independent layer-name edit`,()=>{
 const f=fixture();f.drag();const changed=structuredClone(f.store.state.composition);assert.notEqual(changed.layers[0].patch.adsr.a,f.initial.layers[0].patch.adsr.a);
 if(ending==='pointerup')f.circle.props.onPointerUp(f.event());
 if(ending==='pointercancel')f.circle.props.onPointerCancel(f.event());
 if(ending==='lostcapture'){f.captured.delete(1);f.circle.props.onLostPointerCapture?.(f.event());}
 if(ending==='unmount')f.unmount();
 assert.equal(f.counts().begins,1);assert.equal(f.counts().ends,1);assert.equal(f.captured.size,0);
 f.circle.props.onPointerUp(f.event());f.circle.props.onPointerCancel(f.event());f.unmount();assert.equal(f.counts().ends,1,'duplicate termination is inert');
 f.store.update(c=>({...c,layers:c.layers.map((l,i)=>i?l:{...l,name:'Independent name'})}));f.store.undo();
 assert.equal(f.store.state.composition.layers[0].name,f.initial.layers[0].name);
 assert.deepEqual(f.store.state.composition.layers[0].patch,changed.layers[0].patch,'Undo only the later edit');
 f.store.undo();assert.deepEqual(f.store.state.composition.layers[0].patch,f.initial.layers[0].patch);
});
test('curve gesture owns one primary pointer; foreign moves and endings are inert',()=>{
 const f=fixture();f.circle.props.onPointerDown(f.event(2,2));assert.equal(f.counts().begins,0);
 f.circle.props.onPointerDown(f.event());f.circle.props.onPointerDown(f.event(2));assert.equal(f.counts().begins,1);
 f.circle.props.onPointerMove(f.event(2));assert.deepEqual(f.store.state.composition,f.initial);
 f.circle.props.onPointerUp(f.event(2));f.circle.props.onPointerCancel(f.event(2));f.circle.props.onLostPointerCapture?.(f.event(2));assert.equal(f.counts().ends,0);
 f.circle.props.onPointerMove(f.event());f.circle.props.onPointerUp(f.event());assert.equal(f.counts().ends,1);
});
test('unmount invokes the current end callback and never emits another patch edit',()=>{
 const f=fixture();f.drag();const before=f.store.getSnapshot();let current=0;f.render({onGestureEnd:()=>{current++;f.store.endGesture();}});f.unmount();assert.equal(current,1);assert.equal(f.counts().ends,0);assert.equal(f.store.getSnapshot(),before);
});
