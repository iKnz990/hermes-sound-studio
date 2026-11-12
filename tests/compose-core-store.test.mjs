import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {build} from 'esbuild';

// Isolated bundle only: never invoke the shared build or write shared outputs.
const modules=['desktop-src/compose-model.ts','desktop-src/compose-store.ts'];
let api={};
if(modules.every(file=>fs.existsSync(file))){
 const result=await build({stdin:{contents:modules.map(file=>`export * from './${file}';`).join('\n'),resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs'});
 fs.mkdirSync('evidence/full-plan-v1/compose/store',{recursive:true});
 const path='evidence/full-plan-v1/compose/store/core-store-test.cjs';fs.writeFileSync(path,result.outputFiles[0].text);
 const require=createRequire(import.meta.url);delete require.cache[require.resolve('../'+path)];api=require('../'+path);
}
const clone=value=>JSON.parse(JSON.stringify(value));
const memory=()=>{const data=new Map();return {data,get:(key,fallback)=>data.has(key)?clone(data.get(key)):fallback,set:(key,value)=>{data.set(key,clone(value));}};};
function model(){assert.equal(typeof api.createComposition,'function','strict Composition/v1 model must be implemented');return api.createComposition();}
function store(storage=memory()){assert.equal(typeof api.createComposeStore,'function','durable isolated Compose repository must be implemented');return api.createComposeStore(storage);}
const edit=(a,tempo)=>a.update(c=>({...c,tempo}));

test('32-bar documents retain late notes through shorten, save, reload, undo and JSON import',()=>{
 const storage=memory(),a=store(storage);
 assert.equal(a.update(c=>({...c,bars:32,layers:c.layers.map((l,i)=>({...l,notes:[{id:`late-${i}`,beat:127.75,duration:.25,pitch:45,velocity:.8}]}))})),true);
 const full=clone(a.state.composition);
 assert.equal(a.save('Long arrangement'),true);
 assert.equal(a.update(c=>({...c,bars:1})),true);
 const b=store(storage);assert.equal(b.state.composition.bars,1);
 assert.equal(b.state.composition.layers[0].notes[0].beat,127.75);
 assert.equal(a.undo(),true);assert.equal(a.state.composition.bars,32);
 assert.equal(b.importComposition(JSON.parse(a.exportJson())),false,'stale storage is fenced');
 const fresh=store(memory());assert.equal(fresh.importComposition(full),true);
 assert.deepEqual(fresh.state.composition,full);
 for(const meter of [3,4])assert.equal(api.validateComposition({...full,meter}).bars,32);
 const crowded=clone(full);crowded.layers[1].notes=[];
 crowded.layers[0].notes=Array.from({length:2048},(_,i)=>({id:`n-${i}`,beat:(i%256)/2,duration:.25,pitch:45,velocity:.8}));
 assert.equal(api.validateComposition(crowded).layers[0].notes.length,2048);
 crowded.layers[1].notes=[{id:'overflow',beat:0,duration:1,pitch:45,velocity:.8}];
 assert.throws(()=>api.validateComposition(crowded),/2048/);
});

test('default composition has two independent patches and deterministic blank layers',()=>{
 const c=model();assert.equal(c.schemaVersion,'Composition/v1');assert.equal(c.layers.length,2);assert.notDeepEqual(c.layers[0].patch,c.layers[1].patch);assert.ok(c.layers.every(l=>l.notes.length));
 const before=c.layers[1].patch.osc1.vol;c.layers[0].patch.osc1.vol=.12;assert.equal(c.layers[1].patch.osc1.vol,before);
 const blank=api.createLayer();assert.deepEqual(blank.notes,[]);assert.deepEqual(blank.patch,api.createLayer().patch);assert.notEqual(blank.id,api.createLayer().id);
 const custom=api.createLayer(c.layers[0].patch,'Custom',c.layers[0].notes);custom.patch.osc1.vol=.22;assert.equal(c.layers[0].patch.osc1.vol,.12);custom.notes[0].pitch=50;assert.notEqual(c.layers[0].notes[0].pitch,50);
 assert.deepEqual(api.validateComposition(clone(c)),c);
});

test('duplicate supports sound-only or sound plus independently identified pattern',()=>{
 const c=model(),source=c.layers[0],sound=api.duplicateLayer(source),pattern=api.duplicateLayer(source,true);
 assert.notEqual(sound.id,source.id);assert.equal(sound.notes.length,0);assert.deepEqual(sound.patch,source.patch);
 assert.equal(pattern.notes.length,source.notes.length);assert.ok(pattern.notes.every(n=>!source.notes.some(s=>s.id===n.id)));assert.notEqual(pattern.id,sound.id);
 pattern.patch.osc1.vol=.01;pattern.notes[0].pitch=49;assert.notEqual(source.patch.osc1.vol,.01);assert.notEqual(source.notes[0].pitch,49);
});

test('strict model rejects wrong keys, types, ranges, identities and invalid patches',()=>{
 const c=model();
 const invalid=[
  x=>{x.extra=true},x=>{delete x.name},x=>{x.schemaVersion='Composition/v2'},x=>{x.tempo='120'},x=>{x.tempo=NaN},x=>{x.tempo=59},x=>{x.tempo=201},
  x=>{x.meter=5},x=>{x.root=35},x=>{x.root=73},x=>{x.root=48.5},x=>{x.bars=0},x=>{x.bars=33},x=>{x.bars=1.5},x=>{x.name=' '},x=>{x.id='bad\n'},
  x=>{x.selectedLayer='missing'},x=>{x.layers=[]},x=>{x.layers[1].id=x.layers[0].id},x=>{x.layers[0].extra=1},x=>{x.layers[0].muted=1},
  x=>{x.layers[0].gainDb=-49},x=>{x.layers[0].gainDb=7},x=>{x.layers[0].patch.noise=2},x=>{x.layers[0].patch.unknown=true},
  x=>{x.layers[0].notes[0].extra=true},x=>{x.layers[0].notes[0].beat=-.1},x=>{x.layers[0].notes[0].beat=128},x=>{x.layers[0].notes[0].duration=.24},
  x=>{x.layers[0].notes[0].duration=4.1},x=>{x.layers[0].notes[0].pitch=27},x=>{x.layers[0].notes[0].pitch=85},x=>{x.layers[0].notes[0].pitch=48.1},
  x=>{x.layers[0].notes[0].velocity=.09},x=>{x.layers[0].notes[0].velocity=1.1},x=>{x.layers[1].notes[0].id=x.layers[0].notes[0].id},
  x=>{x.layers=Array.from({length:9},(_,i)=>({...clone(x.layers[0]),id:'layer'+i,notes:[]}));x.selectedLayer='layer0'},
  x=>{x.layers[0].notes=Array.from({length:2049},(_,i)=>({...clone(x.layers[0].notes[0]),id:'note'+i}))},
 ];
 for(const mutate of invalid){const value=clone(c);mutate(value);assert.throws(()=>api.validateComposition(value),mutate.toString());}
 assert.throws(()=>api.validateComposition(Object.assign(Object.create({inherited:true}),c)));
 const boundary=clone(c);Object.assign(boundary,{tempo:60,meter:3,root:36,bars:1});Object.assign(boundary.layers[0],{gainDb:-48,muted:true,notes:[{id:'boundary',beat:15.75,duration:.25,pitch:28,velocity:.1}]});
 assert.deepEqual(api.validateComposition(boundary),boundary); // shortened-loop notes are retained up to beat 16.
 Object.assign(boundary,{tempo:200,root:72,bars:4});Object.assign(boundary.layers[0],{gainDb:6,notes:[{id:'boundary',beat:12,duration:4,pitch:84,velocity:1}]});assert.deepEqual(api.validateComposition(boundary),boundary);
});

test('draft roundtrip preserves every musical field and never touches event-sound keys',()=>{
 const s=memory();s.data.set('sound-studio-v1',{untouched:true});const a=store(s),c=a.state.composition;
 assert.equal(a.state.recovery,'new');assert.equal(a.state.blocked,false);
 assert.equal(a.update(x=>({...x,tempo:137.5,meter:3,root:57,bars:2,layers:x.layers.map((l,i)=>({...l,gainDb:i?-4:-12,muted:!!i,patch:{...l.patch,name:i?'Independent chords':'Independent bass'},notes:[{id:'custom'+i,beat:i?9:0,duration:1.5,pitch:i?64:40,velocity:.65}]}))})),true);
 assert.equal(a.select(c.layers[1].id),true);const b=store(s);assert.deepEqual(b.state.composition,a.state.composition);assert.equal(b.state.recovery,'draft');assert.equal(b.state.dirty,true);
 assert.deepEqual(s.data.get('sound-studio-v1'),{untouched:true});assert.ok([...s.data.keys()].every(k=>k==='sound-studio-v1'||k.startsWith('compose-workspace-v1')));
 assert.deepEqual(api.validateComposition(JSON.parse(a.exportJson())),a.state.composition);
});

test('named snapshots stay separate from current draft; open, new and undo work',()=>{
 const s=memory(),a=store(s);edit(a,111);assert.equal(a.save('First'),true);const first=a.state.activeId;assert.equal(a.state.dirty,false);assert.equal(a.state.recovery,'saved');
 edit(a,145);assert.equal(a.state.compositions[0].composition.tempo,111);assert.equal(a.save('Second'),true);assert.equal(a.state.compositions.length,2);const second=a.state.activeId;
 edit(a,167);const b=store(s);assert.equal(b.state.composition.tempo,167);assert.equal(b.open(first),true);assert.equal(b.state.composition.tempo,111);assert.equal(b.state.dirty,false);
 edit(b,112);assert.equal(b.save('First'),true);assert.equal(b.state.compositions.length,2);assert.equal(b.state.activeId,first);
 assert.equal(b.open(second),true);assert.equal(b.state.composition.tempo,145);const previous=b.state.composition.id;assert.equal(b.newComposition(),true);assert.notEqual(b.state.composition.id,previous);assert.equal(b.state.activeId,null);assert.equal(b.state.compositions.length,2);
 assert.equal(b.undo(),true);assert.equal(b.state.composition.id,previous);assert.equal(b.state.activeId,second);assert.equal(b.state.dirty,true);
});

test('subscription snapshot is stable between updates; state is deeply immutable',()=>{
 const a=store();let calls=0;const stop=a.subscribe(()=>calls++),before=a.getSnapshot();assert.equal(a.getSnapshot(),before);edit(a,121);assert.notEqual(a.getSnapshot(),before);assert.ok(calls>0);stop();const count=calls;edit(a,122);assert.equal(calls,count);
 assert.throws(()=>{a.state.composition.layers[0].patch.osc1.vol=.99});assert.throws(()=>{a.state.compositions.push({})});
});

test('failed write keeps distinctive edits in memory/export and last durable state on restart',()=>{
 const s=memory(),a=store(s);assert.equal(edit(a,111),true);const real=s.set;s.set=()=>{throw Error('quota')};assert.equal(edit(a,166),false);assert.equal(a.state.composition.tempo,166);assert.equal(a.state.dirty,true);assert.match(a.state.error,/quota/);assert.equal(JSON.parse(a.exportJson()).tempo,166);
 assert.equal(a.save('Failed snapshot'),false);assert.equal(a.state.compositions.length,0);s.set=real;assert.equal(store(s).state.composition.tempo,111);assert.equal(edit(a,167),true);assert.equal(store(s).state.composition.tempo,167);
});

test('unavailable storage still permits undoable/exportable editing',()=>{
 assert.equal(typeof api.createComposeStore,'function','durable isolated Compose repository must be implemented');const a=api.createComposeStore();assert.equal(a.state.recovery,'unavailable');assert.equal(a.state.blocked,true);const tempo=a.state.composition.tempo;assert.equal(edit(a,155),false);assert.equal(a.state.composition.tempo,155);assert.equal(a.undo(),false);assert.equal(a.state.composition.tempo,tempo);assert.ok(a.state.error);assert.equal(a.save('No disk'),false);
});

test('silently dropped primary, backup and marker writes each fail exact readback',()=>{
 for(const keyName of ['COMPOSE_STORE_KEY','COMPOSE_BACKUP_KEY','COMPOSE_MARKER_KEY']){
  const s=memory(),a=store(s);const fresh=keyName==='COMPOSE_MARKER_KEY';if(!fresh)assert.equal(edit(a,111),true);
  const real=s.set;s.set=(key,v)=>{if(key!==api[keyName])real(key,v)};
  assert.equal(edit(a,151),false,keyName);assert.equal(a.state.composition.tempo,151);assert.ok(a.state.error,keyName);if(fresh)assert.equal(s.data.has(api.COMPOSE_STORE_KEY),false);else assert.equal(s.data.get(api.COMPOSE_STORE_KEY).composition.tempo,111);
 }
});

test('dropped primary readback cannot claim persistence',()=>{
 const s=memory(),a=store(s);assert.equal(edit(a,111),true);const real=s.get;let hide=false;const set=s.set;s.set=(k,v)=>{set(k,v);if(k===api.COMPOSE_STORE_KEY)hide=true};s.get=(k,f)=>hide&&k===api.COMPOSE_STORE_KEY?f:real(k,f);
 assert.equal(edit(a,152),false);assert.ok(a.state.error);assert.equal(a.state.composition.tempo,152);assert.equal(a.state.blocked,true);
});

test('stale view cannot overwrite another writer and retains its rejected edit',()=>{
 const s=memory(),a=store(s),b=store(s);edit(a,111);assert.equal(edit(b,177),false);assert.equal(b.state.blocked,true);assert.equal(b.state.composition.tempo,177);assert.equal(store(s).state.composition.tempo,111);
});

test('concurrent primary change during backup is detected before committing',()=>{
 const s=memory(),a=store(s);edit(a,111);const newer=clone(s.data.get(api.COMPOSE_STORE_KEY));newer.composition.tempo=188;newer.revision++;const real=s.set;s.set=(key,v)=>{real(key,v);if(key===api.COMPOSE_BACKUP_KEY)s.data.set(api.COMPOSE_STORE_KEY,newer)};
 assert.equal(edit(a,122),false);assert.equal(a.state.blocked,true);assert.equal(store(s).state.composition.tempo,188);
});

test('corrupt primary recovers strict backup read-only without repairing either record',()=>{
 const s=memory(),a=store(s);edit(a,111);edit(a,122);const backup=clone(s.data.get(api.COMPOSE_BACKUP_KEY));s.data.set(api.COMPOSE_STORE_KEY,{corrupt:'preserve'});
 const b=store(s);assert.equal(b.state.recovery,'backup');assert.equal(b.state.composition.tempo,111);assert.equal(b.state.blocked,true);assert.ok(b.state.error);assert.equal(edit(b,133),false);assert.equal(b.save('No overwrite'),false);assert.equal(b.newComposition(),false);
 assert.deepEqual(s.data.get(api.COMPOSE_STORE_KEY),{corrupt:'preserve'});assert.deepEqual(s.data.get(api.COMPOSE_BACKUP_KEY),backup);
});

test('missing primary with marker or backup never initializes over lost data',()=>{
 for(const markerOnly of [true,false]){
  const s=memory(),a=store(s);edit(a,111);if(!markerOnly)edit(a,122);s.data.delete(api.COMPOSE_STORE_KEY);const before=clone([...s.data]);const b=store(s);assert.equal(b.state.blocked,true);assert.ok(b.state.error);assert.equal(edit(b,144),false);assert.deepEqual([...s.data],before);
 }
});

test('strict malformed marker, missing marker and invalid backup are protected',()=>{
 for(const corrupt of [s=>s.data.set(api.COMPOSE_MARKER_KEY,'true'),s=>s.data.set(api.COMPOSE_MARKER_KEY,false),s=>s.data.delete(api.COMPOSE_MARKER_KEY),s=>s.data.set(api.COMPOSE_BACKUP_KEY,{invalid:true})]){
  const s=memory(),a=store(s);edit(a,111);edit(a,122);corrupt(s);const before=clone([...s.data]);const b=store(s);assert.equal(b.state.blocked,true);assert.ok(b.state.error);assert.equal(edit(b,155),false);assert.deepEqual([...s.data],before);
 }
});

test('strict repository envelope and named snapshots reject corruption',()=>{
 const mutations=[x=>{x.extra=true},x=>{x.revision=-1},x=>{x.dirty='false'},x=>{x.activeId='missing'},x=>{x.compositions[0].extra=1},x=>{x.compositions[0].updatedAt=NaN},x=>{x.compositions.push(clone(x.compositions[0]))},x=>{x.compositions[0].composition.tempo=900}];
 for(const mutate of mutations){const s=memory(),a=store(s);edit(a,111);a.save('Named');const value=clone(s.data.get(api.COMPOSE_STORE_KEY));mutate(value);s.data.set(api.COMPOSE_STORE_KEY,value);const b=store(s);assert.equal(b.state.blocked,true);assert.ok(b.state.error);assert.equal(edit(b,144),false);}
});

test('gesture groups accepted edits into one Undo including failed persistence',()=>{
 for(const unavailable of [false,true]){const a=unavailable?api.createComposeStore():store();const before=clone(a.state.composition);
 assert.equal(typeof a.beginGesture,'function');a.beginGesture();
 a.update(c=>({...c,layers:c.layers.map((l,i)=>i?l:{...l,gainDb:-8})}));
 a.update(c=>({...c,layers:c.layers.map((l,i)=>i?l:{...l,gainDb:-10})}));a.endGesture();
 assert.equal(a.state.composition.layers[0].gainDb,-10);a.undo();assert.deepEqual(a.state.composition,before);assert.equal(a.state.canUndo,false);
 }
});
test('gesture returning to its initial values consumes its Undo without stale canUndo or false durability',()=>{
 const a=store();a.beginGesture();edit(a,155);edit(a,120);a.endGesture();assert.equal(a.state.canUndo,true);a.undo();assert.equal(a.state.canUndo,false);
 const unavailable=api.createComposeStore();assert.equal(unavailable.update(c=>c),false);assert.equal(unavailable.state.canUndo,false);
});
test('empty/invalid gesture creates no Undo and replacements end a gesture',()=>{
 const a=store();assert.equal(typeof a.beginGesture,'function');a.beginGesture();a.endGesture();assert.equal(a.state.canUndo,false);
 a.beginGesture();a.update(c=>({...c,tempo:999}));a.endGesture();assert.equal(a.state.canUndo,false);
 a.beginGesture();edit(a,111);a.newComposition();a.update(c=>({...c,tempo:155}));a.undo();assert.notEqual(a.state.composition.tempo,111);a.undo();assert.equal(a.state.composition.tempo,111);a.undo();assert.equal(a.state.composition.tempo,120);
});

test('invalid updates, names, selections and missing opens do not mutate composition',()=>{
 const a=store(),before=clone(a.state.composition);assert.equal(a.update(c=>({...c,tempo:500})),false);assert.equal(a.update(()=>{throw Error('bad callback')}),false);assert.equal(a.select('missing'),false);assert.equal(a.open('missing'),false);assert.equal(a.save(' '),false);assert.equal(a.undo(),false);assert.deepEqual(a.state.composition,before);assert.equal(a.state.compositions.length,0);
});
