import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import {build} from 'esbuild';
let active;
const React={createElement:(type,props,...children)=>({type,props:{...props,children}}),
 useState:init=>{const h=active,i=h.cursor++;if(!(i in h.slots))h.slots[i]=typeof init==='function'?init():init;return [h.slots[i],v=>{h.slots[i]=typeof v==='function'?v(h.slots[i]):v}]},
 useRef:init=>{const h=active,i=h.cursor++;return h.slots[i]??(h.slots[i]={current:init})},
 useId:()=>{const h=active,i=h.cursor++;return `test-${i}`},
 useCallback:(fn,deps)=>{const h=active,i=h.cursor++,prior=h.slots[i];if(!prior||deps.some((x,j)=>x!==prior.deps[j]))h.slots[i]={deps,fn};return h.slots[i].fn}, 
 useEffect:(fn,deps)=>{const h=active,i=h.cursor++,prior=h.effects[i];if(!prior||deps.some((x,j)=>x!==prior.deps[j]))h.pending.push(()=>{prior?.cleanup?.();h.effects[i]={deps,cleanup:fn()}})},
};
let api={};
if(fs.existsSync('desktop-src/studio-confirmation.tsx')){
 const out=await build({entryPoints:['desktop-src/studio-confirmation.tsx'],bundle:true,write:false,format:'cjs',platform:'node',external:['react']});
 const m=new Module(process.cwd()+'/tests/inline-confirmation-fixture.cjs');m.filename=m.id;m.paths=Module._nodeModulePaths(process.cwd());const req=m.require.bind(m);m.require=id=>id==='react'?React:req(id);m._compile(out.outputFiles[0].text,m.filename);api=m.exports;
}
function fixture(){
 assert.equal(typeof api.useInlineConfirmation,'function','shared inline asynchronous confirmation is required');
 const h={slots:[],cursor:0,effects:[],pending:[],scope:'A',value:null};
 h.render=(scope=h.scope)=>{h.scope=scope;h.cursor=0;active=h;h.value=api.useInlineConfirmation(scope);h.pending.splice(0).forEach(fn=>fn());return h.value};
 h.unmount=()=>h.effects.forEach(e=>e?.cleanup?.());h.render();return h;
}
const nodes=t=>!t?[]:Array.isArray(t)?t.flatMap(nodes):typeof t==='object'?[t,...nodes(t.props?.children)]:[];
const click=(h,label)=>{h.render();const node=nodes(h.value.prompt).find(n=>n.type==='button'&&n.props.children.flat().includes(label));assert.ok(node,`${label} button`);node.props.onClick()};
test('confirmation CSS uses canonical readable ink and host shadow tokens',()=>{const css=fs.readFileSync('desktop-src/studio-confirmation-style.ts','utf8');assert.match(css,/color:var\(--ss-ink\)/);assert.match(css,/box-shadow:var\(--ss-shadow-soft\)/);assert.doesNotMatch(css,/--ss-text|#0004/)});
test('inline review remains pending until explicit Confirm, then settles once and restores connected opener',async()=>{
 const old=globalThis.document;let focus=0;globalThis.document={activeElement:{isConnected:true,focus:()=>focus++}};
 try{const h=fixture();let settled=false;const p=h.value.request('Replace selected sound?').then(v=>{settled=true;return v});await Promise.resolve();assert.equal(settled,false);h.render();const panel=nodes(h.value.prompt).find(n=>n.props.role==='region');assert.ok(panel);assert.ok(panel.props['aria-labelledby']);click(h,'Confirm');assert.equal(await p,true);assert.equal(focus,1);h.render();assert.equal(h.value.prompt,null);h.value.cancel();assert.equal(focus,1);h.unmount()}finally{globalThis.document=old}
});
test('new request cancels previous and keeps only the latest review',async()=>{const h=fixture(),first=h.value.request('First'),second=h.value.request('Second');assert.equal(await first,false);h.render();assert.match(JSON.stringify(h.value.prompt),/Second/);assert.doesNotMatch(JSON.stringify(h.value.prompt),/First/);click(h,'Confirm');assert.equal(await second,true);h.unmount()});
for(const invalidation of ['cancel','button','scope','unmount'])test(`${invalidation} settles pending review false`,async()=>{const h=fixture(),p=h.value.request('Pending');if(invalidation==='cancel')h.value.cancel();if(invalidation==='button')click(h,'Cancel');if(invalidation==='scope'){h.render('B');h.render('B');assert.equal(h.value.prompt,null,'scope change removes stale review');}if(invalidation==='unmount')h.unmount();assert.equal(await p,false);if(invalidation!=='unmount')h.unmount()});
for(const mode of ['changed','throws'])test(`Confirm checks live isCurrent (${mode}) and fails closed`,async()=>{const h=fixture();let valid=true;const p=h.value.request('Review',()=>{if(mode==='throws')throw Error('revoked');return valid});valid=false;click(h,'Confirm');assert.equal(await p,false);h.unmount()});
test('disconnected opener is never focused and unmounted hook refuses new requests',async()=>{const old=globalThis.document;globalThis.document={activeElement:{isConnected:false,focus:()=>{throw Error('disconnected focus')}}};try{const h=fixture(),p=h.value.request('Review');h.unmount();assert.equal(await p,false);assert.equal(await h.value.request('Too late'),false)}finally{globalThis.document=old}});
