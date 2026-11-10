import test from 'node:test';
import assert from 'node:assert/strict';
import { build, transform } from 'esbuild';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const require=createRequire(import.meta.url);
let loaded;
async function api(){
  assert.ok(await access(path.join(root,'desktop-src/studio-sonic-export.ts')).then(()=>true,()=>false),'explicit lossy Sonic converter must exist');
  if(!loaded)loaded=(async()=>{
    const result=await build({absWorkingDir:root,stdin:{contents:"export * from './desktop-src/studio-sonic-export';export * from './assets/studio-engine';export {safePatch} from './desktop-src/preferences';",resolveDir:root,loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'raw-engine',setup(b){b.onResolve({filter:/\?raw$/},a=>({path:path.resolve(a.resolveDir,a.path.slice(0,-4)),namespace:'raw'}));b.onLoad({filter:/.*/,namespace:'raw'},async a=>({contents:JSON.stringify(await readFile(a.path,'utf8')),loader:'json'}));}}]});
    const m={exports:{}};new Function('module','exports','require',result.outputFiles[0].text)(m,m.exports,require);return m.exports;
  })();
  return loaded;
}
const palettes=JSON.parse(await readFile(path.join(root,'assets/studio-palettes.json'),'utf8'));
function theme(a,p=a.createSoundPatch()) {return {schemaVersion:'SoundTheme/v1',engineVersion:'sound-studio-dsp/v1',name:'Conversion',sampleRate:48000,masterGain:.5,events:Object.fromEntries(a.SOUND_EVENTS.map(e=>[e,structuredClone(p)]))};}

test('converter deterministically maps all palettes without mutation or aliases',async()=>{
  const a=await api();
  for(const input of palettes){
    const before=JSON.stringify(input),one=a.soundThemeToSonicPatch(input),two=a.soundThemeToSonicPatch(input);
    assert.deepEqual(one,two);assert.ok(a.safePatch(one));assert.equal(JSON.stringify(input),before);
    assert.notStrictEqual(one.events.onCommit,two.events.onCommit);
    assert.notStrictEqual(one.events.onCommit.chord_intervals,input.events.onCommit.chords);
    assert.ok(one.events.onHover.gain<=.04);
  }
});

test('carrier, relative FM tuning and envelope mapping are explicit and bounded',async()=>{
  const a=await api(),p=a.createSoundPatch({baseFreq:220,osc1:{enabled:true,type:'triangle',vol:.8,tune:12},osc2:{enabled:true,type:'sine',vol:.5,tune:-12},duration:1});
  const input=theme(a,p),out=a.soundThemeToSonicPatch(input),v=out.events.onCommit;
  assert.equal(out.fundamental_hz*v.freq_ratio,440);
  assert.equal(v.mod_freq_ratio,2**((-12-12)/12));assert.equal(v.mod_index,.5*500);
  assert.equal(v.attack_ms,p.adsr.a);assert.equal(v.decay_ms,p.adsr.d+p.adsr.r);
  assert.equal(v.gain,.11*p.intensity/100*p.osc1.vol*10**(p.playback.gainDb/20)*input.masterGain);
  assert.equal(v.waveform,'triangle');assert.equal(v.pitch_bend_ratio,1);
});

test('loss warnings disclose model changes and constrained edge conversions remain valid',async()=>{
  const a=await api();
  const cases=[
    a.createSoundPatch(),
    a.createSoundPatch({baseFreq:4000,chords:[0],osc1:{enabled:true,type:'sine',vol:1,tune:24},osc2:{enabled:false,type:'sine',vol:0,tune:0},osc3:{enabled:false,type:'sine',vol:0,tune:0}}),
    a.createSoundPatch({baseFreq:40,chords:[-24],osc1:{enabled:true,type:'sine',vol:1,tune:-24}}),
    a.createSoundPatch({chords:[-.7,2.4,4.6],filter:{type:'notch',cutoff:4000,res:2,drive:2}}),
    a.createSoundPatch({osc1:{enabled:false,type:'sine',vol:1,tune:0}}),
    a.createSoundPatch({duration:.02,adsr:{a:0,d:0,s:0,r:0},intensity:0})
  ];
  for(const p of cases){const d=a.describeSonicConversion(theme(a,p));assert.ok(a.safePatch(d.patch));assert.match(d.warnings.join(' '),/not.*equivalent|different.*sound|lossy/i);}
  const changed=a.describeSonicConversion(theme(a,cases[3]));
  assert.match(changed.warnings.join(' '),/notch/i);assert.match(changed.warnings.join(' '),/rounded/i);
  assert.equal(a.soundThemeToSonicPatch(theme(a,cases[4])).events.onCommit.gain,0);
});

test('unsupported or nonfinite source data is not silently repaired at export',async()=>{
  const a=await api(),input=theme(a);
  assert.throws(()=>a.soundThemeToSonicPatch({...input,masterGain:Infinity}));
  assert.throws(()=>a.soundThemeToSonicPatch({...input,unknown:true}));
  assert.throws(()=>a.soundThemeToSonicPatch({...input,events:{...input.events,onCommit:{...input.events.onCommit,duration:.02}}}));
});

test('actual generated alternate runtime compiles, discloses loss and stays silent on import',async()=>{
  const a=await api(),source=a.compileSonicApproximation(theme(a));
  assert.match(source,/SONIC_CONVERSION/);assert.match(source,/approximate|lossy/i);
  assert.doesNotMatch(source,/SoundStudioEngine|OfflineAudioContext|<2KB|zero.latency/i);
  const compiled=await transform(source,{loader:'ts',format:'esm'});
  let allocated=0;const original=globalThis.AudioContext;
  globalThis.AudioContext=class{constructor(){allocated++;throw Error('import must not allocate');}};
  try {
    const runtime=await import(`data:text/javascript;base64,${Buffer.from(compiled.code).toString('base64')}`);
    assert.deepEqual(runtime.SONIC_PATCH,a.soundThemeToSonicPatch(theme(a)));
    assert.equal(allocated,0);assert.equal(runtime.sonic.getSnapshot().enabled,false);
    assert.equal(runtime.sonic.getSnapshot().muted,true);assert.equal(runtime.sonic.onCommit(),false);
    assert.equal(typeof runtime.sonic.startPulse,'function');assert.equal(typeof runtime.sonic.setCssTarget,'function');
    assert.ok(runtime.SONIC_CONVERSION.warnings.length);await runtime.sonic.dispose();
  }finally{globalThis.AudioContext=original;}
});

test('converted palette and boundary cohort is accepted by the actual native Sonic schema',async()=>{
  const a=await api(),inputs=[...palettes];
  for(const baseFreq of [40,220,1000,4000])for(const tune of [-24,0,24])for(const chords of [[-24],[0],[24],[-23.5,0,23.5]]){
    try { inputs.push(theme(a,a.createSoundPatch({baseFreq,chords,osc1:{enabled:true,type:'sine',vol:1,tune},osc2:{enabled:false,type:'sine',vol:0,tune:0},osc3:{enabled:false,type:'sine',vol:0,tune:0}}))); }
    catch(e){assert.match(String(e),/frequency exceeds supported band/);}
  }
  const patches=inputs.map(input=>a.soundThemeToSonicPatch(input));
  const command='import json,sys;from synth_schema import validate_patch;rows=json.load(sys.stdin);[validate_patch(x) for x in rows];print(json.dumps({"validated":len(rows)}))';
  const result=JSON.parse(execFileSync('python',['-B','-c',command],{cwd:root,input:JSON.stringify(patches),encoding:'utf8'}));
  assert.equal(result.validated,patches.length);assert.ok(result.validated>30);
});
