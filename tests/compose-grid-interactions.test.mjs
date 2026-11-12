import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import Module from 'node:module';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
let api={};
try {const out=await build({absWorkingDir:root,entryPoints:['desktop-src/compose-view-model.ts'],bundle:true,write:false,platform:'node',format:'cjs'});const m=new Module(path.join(root,'tests/grid-model.cjs'));m._compile(out.outputFiles[0].text,m.id);api=m.exports;}catch(e){if(!String(e).includes('Could not resolve'))throw e;}
const notes=[{id:'early',beat:0,duration:2,pitch:45,velocity:.8},{id:'late',beat:.5,duration:1,pitch:45,velocity:.8},{id:'short',beat:2,duration:.25,pitch:45,velocity:.8}];
test('grid editing reaches bar 32 and bounds notes at the storage horizon',()=>{
 assert.equal(api.visibleDuration(16,128,2),2);
 assert.equal(api.visibleDuration(127.5,128,4),.5);
 assert.equal(api.visibleDuration(127.75,128,4),.25);
 assert.equal(api.visibleDuration(128,128,1),null);
 assert.equal(api.visibleDuration(96,96,1),null);
});
test('half-open sustain hits prioritize selected overlap then latest onset and stable identity',()=>{
 assert.equal(typeof api.notesAtBeat,'function');
 assert.deepEqual(api.notesAtBeat(notes,1,45,null).map(n=>n.id),['late','early']);
 assert.deepEqual(api.notesAtBeat(notes,1,45,'early').map(n=>n.id),['early','late']);
 assert.deepEqual(api.notesAtBeat(notes,2,45,null).map(n=>n.id),['short']);
 assert.deepEqual(api.notesAtBeat(notes,2.25,45,null),[]);
 const tied=[...notes,{...notes[1],id:'aaa'}];assert.deepEqual(api.notesAtBeat(tied,1,45,null).map(n=>n.id),['aaa','late','early']);
});
test('first onset/sustain click selects; selected onset alone deletes; sustain never deletes',()=>{
 assert.equal(typeof api.gridAction,'function');
 assert.deepEqual(api.gridAction(notes,null,0,45,false),{kind:'select',id:'early'});
 assert.deepEqual(api.gridAction(notes,'early',0,45,false),{kind:'delete',id:'early'});
 assert.deepEqual(api.gridAction(notes,'early',1,45,false),{kind:'select',id:'early'});
 assert.deepEqual(api.gridAction(notes,null,1,45,true),{kind:'delete',id:'late'});
 assert.deepEqual(api.gridAction(notes,null,3,45,true),{kind:'none'});
 assert.deepEqual(api.gridAction(notes,null,3,45,false),{kind:'create'});
});
test('off-grid imported onsets remain selectable and painted without changing their exact storage',()=>{
 assert.equal(typeof api.notesInCell,'function');const stored={...notes[2],beat:.25,duration:.75};
 assert.equal(api.notesInCell([stored],0,45,null)[0].id,'short');
 assert.deepEqual(api.gridAction([stored],null,0,45,false),{kind:'select',id:'short'});
 assert.deepEqual(api.cellCoverage(stored,0),{left:.5,width:.5,onset:true});
 assert.equal(stored.beat,.25);assert.equal(stored.duration,.75);
});

test('duration edits and pitch projection obey loop without trimming retained notes',()=>{
 assert.equal(typeof api.visibleDuration,'function');
 assert.equal(api.visibleDuration(3.5,4,4),.5);assert.equal(api.visibleDuration(0,8,1.13),1.25);
 assert.equal(api.visibleDuration(4,4,1),null);assert.equal(api.visibleDuration(0,16,20),4);
 assert.ok(api.pitchTop(84)<api.pitchTop(28));assert.equal(api.pitchTop(45),api.pitchTop(45));
 assert.deepEqual(api.cellCoverage(notes[2],2,.5),{left:0,width:.5,onset:true});
 assert.equal(api.cellCoverage(notes[2],2.5,.5),null);
});
test('session colors/audibility use identity not order; root transpose validates all or nothing',()=>{
 assert.equal(typeof api.layerColor,'function');assert.equal(api.layerColor('stable'),api.layerColor('stable'));
 assert.equal(api.layerAudible({id:'a',muted:false},new Set()),true);
 assert.equal(api.layerAudible({id:'a',muted:true},new Set(['a'])),false);
 assert.equal(api.layerAudible({id:'a',muted:false},new Set(['b'])),false);
 const c={root:57,layers:[{notes:[{pitch:84}]},{notes:[{pitch:28}]}]};
 assert.throws(()=>api.transposeRoot(c,58),/pitch/i);assert.equal(c.layers[0].notes[0].pitch,84);
 const moved=api.transposeRoot({root:57,layers:[{notes:[{pitch:45}]}]},60);assert.equal(moved.layers[0].notes[0].pitch,48);
});
