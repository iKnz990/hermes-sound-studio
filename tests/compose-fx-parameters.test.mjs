import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
const source=await readFile(new URL('../assets/studio-engine.ts',import.meta.url),'utf8');
const {code}=await transform(source,{loader:'ts',format:'esm'});
const api=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const limits={eq:{frequency:[40,16000],gainDb:[-12,12],q:[0.1,8]},saturation:{drive:[0,10]},compressor:{thresholdDb:[-60,0],ratio:[1,20],attack:[0.001,1],release:[0.01,2],kneeDb:[0,40]},chorus:{rate:[0.1,5],depth:[0,0.01],mix:[0,1]},delay:{time:[0.01,1],feedback:[0,0.7],mix:[0,1]},reverb:{decay:[0.05,2],mix:[0,1]}};
const defaults=drive=>({eq:{frequency:1600,gainDb:3.5,q:0.8},saturation:{drive},compressor:{thresholdDb:-25,ratio:3.5,attack:0.003,release:0.16,kneeDb:10},chorus:{rate:0.9,depth:0.0035,mix:0.22},delay:{time:0.145,feedback:0.22,mix:0.23},reverb:{decay:0.62,mix:0.24}});

test('optional parameters preserve old validation bytes and defaults are independent fresh objects',()=>{
 assert.equal(typeof api.getFxParameters,'function');
 const old=api.createSoundPatch({filter:{type:'lowpass',cutoff:4200,res:1.8,drive:7}}),bytes=JSON.stringify(old);
 assert.equal(Object.hasOwn(old,'fxParameters'),false);
 assert.equal(JSON.stringify(api.validateSoundPatch(old)),bytes);
 assert.deepEqual(api.getFxParameters(old),defaults(7));
 const first=api.getFxParameters(old);first.eq.frequency=400;
 assert.equal(api.getFxParameters(old).eq.frequency,1600);
 assert.equal(JSON.stringify(old),bytes);
});

test('complete optional values survive cloned validation without altering voice drive or legacy mode',()=>{
 const old=api.createSoundPatch(),params=defaults(9),patch={...old,fxParameters:params};
 const clean=api.validateSoundPatch(patch);
 assert.deepEqual(clean.fxParameters,params);
 assert.deepEqual(api.getFxParameters(clean),params);
 assert.notStrictEqual(clean.fxParameters,params);assert.notStrictEqual(clean.fxParameters.eq,params.eq);
 assert.equal(clean.filter.drive,old.filter.drive);assert.equal(Object.hasOwn(clean,'fxOrder'),false);
 const ordered=api.validateSoundPatch({...patch,fxOrder:[...api.FX_ORDER].reverse()});
 assert.deepEqual(ordered.fxOrder,[...api.FX_ORDER].reverse());
 params.saturation.drive=0;assert.equal(clean.fxParameters.saturation.drive,9);
});

test('all parameter bounds agree with JSON schema, accept endpoints and reject every invalid scalar',async()=>{
 const schema=JSON.parse(await readFile(new URL('../assets/sound-patch-v1.schema.json',import.meta.url),'utf8'));
 const rule=schema.properties.fxParameters;
 assert.ok(rule,'schema missing fxParameters');assert.equal(schema.required.includes('fxParameters'),false);
 assert.equal(rule.additionalProperties,false);assert.deepEqual(rule.required,Object.keys(limits));
 assert.deepEqual(api.FX_PARAMETER_LIMITS,limits);
 for(const [effect,fields] of Object.entries(limits)){
  const nested=rule.properties[effect];assert.equal(nested.additionalProperties,false);assert.deepEqual(nested.required,Object.keys(fields));
  for(const [field,[min,max]] of Object.entries(fields)){
   assert.deepEqual(nested.properties[field],{type:'number',minimum:min,maximum:max});
   for(const value of [min,max]){const p=api.createSoundPatch();p.fxParameters=defaults(p.filter.drive);p.fxParameters[effect][field]=value;assert.equal(api.validateSoundPatch(p).fxParameters[effect][field],value);}
   for(const value of [min-0.000001,max+0.000001,NaN,Infinity,-Infinity,null,true,'1',undefined]){
    const p=api.createSoundPatch();p.fxParameters=defaults(p.filter.drive);p.fxParameters[effect][field]=value;
    assert.throws(()=>api.validateSoundPatch(p),`${effect}.${field}=${String(value)}`);
   }
  }
 }
});

test('unknown and incomplete optional structures fail closed, including explicit undefined',()=>{
 const base=api.createSoundPatch();
 for(const value of [undefined,null,[],{},true,{...defaults(3),unknown:{}},Object.assign(Object.create(null),defaults(3))])assert.throws(()=>api.validateSoundPatch({...base,fxParameters:value}));
 for(const [effect,fields] of Object.entries(limits)){
  let value=defaults(3);delete value[effect];assert.throws(()=>api.validateSoundPatch({...base,fxParameters:value}));
  value=defaults(3);value[effect].unknown=1;assert.throws(()=>api.validateSoundPatch({...base,fxParameters:value}));
  for(const field of Object.keys(fields)){value=defaults(3);delete value[effect][field];assert.throws(()=>api.validateSoundPatch({...base,fxParameters:value}));}
 }
});

test('routing matrix labels round display only without mutating modulation amounts',()=>{
 const patch=api.createSoundPatch();patch.modMatrix=[{source:'Velocity',amount:0.3333333333333333,dest:'Pan'}];
 const edge=api.describeSoundRouting(patch).edges.find(e=>e.label?.startsWith('matrix '));
 assert.equal(edge.label,'matrix 0.106667');assert.equal(patch.modMatrix[0].amount,0.3333333333333333);
});
