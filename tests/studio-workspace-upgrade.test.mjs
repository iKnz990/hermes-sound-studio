import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({stdin:{contents:`export * from './desktop-src/compose-model';export * from './desktop-src/compose-audio';export * from './desktop-src/studio-parameter-model';export * from './desktop-src/studio-musical';export * from './assets/studio-engine';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const api=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'));

test('display precision is bounded while imported data remains exact',()=>{
 const range={min:0,max:16000,step:.1},values=[1806.30552345295,3.785489130193537,-7.800000000000001];
 assert.equal(api.formatParameter(values[0],range,' Hz'),'1.81 kHz');
 assert.equal(api.formatParameter(values[1],range),'3.79');
 assert.equal(api.formatParameter(values[2],{min:-60,max:0,step:.1},' dB'),'−7.8 dB');
 assert.equal(api.formatParameter(.003,range,' s'),'3 ms');
 assert.equal(values[0],1806.30552345295);
});
test('root entry supports sharps, flats, octaves and MIDI numbers',()=>{
 for(const [text,midi] of [['A3',57],['C#4',61],['D♭4',61],['B#3',60],['Cb4',59],['57',57]])assert.equal(api.parsePitchName(text),midi);
 assert.ok(Number.isNaN(api.parsePitchName('garbage')));
});
test('oscillator additions are optional, detached, bounded and included in band safety',()=>{
 const p=api.createSoundPatch();assert.deepEqual(Object.keys(p.osc1),['enabled','type','vol','tune']);
 p.osc1={...p.osc1,detune:12,pan:-.5,spread:20};assert.deepEqual(api.validateSoundPatch(p).osc1,p.osc1);
 for(const [key,value] of [['detune',101],['detune',NaN],['pan',1.01],['spread',-1],['spread',51],['unknown',0]])assert.throws(()=>api.validateSoundPatch({...p,osc1:{...p.osc1,[key]:value}}));
 const edge=api.createSoundPatch({baseFreq:4000,chords:[0],osc1:{enabled:true,type:'sine',vol:1,tune:24},osc2:{enabled:false,type:'sine',vol:0,tune:0},osc3:{enabled:false,type:'sine',vol:0,tune:0}});
 assert.throws(()=>api.validateSoundPatch({...edge,osc1:{...edge.osc1,detune:100,spread:50}}),/frequency/);
});
test('loop markers and layer pan round-trip without changing legacy records',()=>{
 const c=api.createComposition();assert.deepEqual(api.loopWindow(c),{start:0,end:8});assert.equal('pan' in c.layers[0],false);
 c.loopStart=1.5;c.loopEnd=6;c.layers[0].pan=.75;assert.deepEqual(api.validateComposition(JSON.parse(JSON.stringify(c))),c);
 for(const change of [{loopStart:6},{loopEnd:9},{loopStart:NaN},{loopStart:2,loopEnd:2.2}])assert.throws(()=>api.validateComposition({...c,...change}));
 assert.throws(()=>api.validateComposition({...c,layers:c.layers.map(l=>({...l,pan:2}))}));
});
function rig(){
 let now=10,ticker=()=>{},renders=0;const sources=[],pans=[];
 const gain=()=>({gain:{value:0,setValueAtTime(v){this.value=v;}},connect(){},disconnect(){}});
 const ctx={state:'running',currentTime:now,destination:{},resume:async()=>{},close:async()=>{},createGain:gain,
  createStereoPanner(){const p={pan:{value:0,setValueAtTime(v){this.value=v;}},connect(){},disconnect(){}};pans.push(p);return p;},
  createAnalyser:()=>({fftSize:256,connect(){},disconnect(){},getFloatTimeDomainData(data){data.fill(.25);}}),
  createDynamicsCompressor:()=>({threshold:{},knee:{},ratio:{},attack:{},release:{},connect(){},disconnect(){}}),
  createBufferSource(){const source={buffer:null,at:0,connect(){},disconnect(){},start(at){source.at=at;sources.push(source);},stop(){},onended:null};return source;}};
 const audio=new api.ComposeAudio({createContext:()=>ctx,render:async()=>{renders++;return {length:12000,numberOfChannels:2,duration:.25};},setInterval(fn){ticker=fn;return 1;},clearInterval(){ticker=()=>{};}});
 return {audio,sources,pans,get renders(){return renders;},tick(seconds){now+=seconds;ctx.currentTime=now;ticker();}};
}
test('bounded loop schedules only in-range onsets, wraps position and seeks using the audio clock',async()=>{
 const r=rig(),c=api.createComposition();c.layers=c.layers.slice(0,1);c.loopStart=2;c.loopEnd=3;
 c.layers[0].notes=[0,2,2.5,3].map((beat,i)=>({...c.layers[0].notes[0],id:`n${i}`,beat,duration:.25}));
 r.audio.setComposition(c);await r.audio.enable();assert.equal(await r.audio.play(),true);assert.equal(r.sources.length,1);assert.equal(r.renders,1);
 assert.ok(Math.abs(r.sources[0].at-10.06)<1e-8);r.tick(.3);assert.equal(r.sources.length,2);
 r.tick(.3);assert.ok(r.audio.getSnapshot().positionBeat>=2&&r.audio.getSnapshot().positionBeat<3);
 r.audio.stop();r.audio.seek(2.5);assert.equal(r.audio.getSnapshot().positionBeat,2.5);await r.audio.play();assert.ok(r.sources.at(-1).at>=10.6);
 await r.audio.dispose();
});
test('pan edits are immediate mix changes, and meters read actual bus samples only during playback',async()=>{
 const r=rig(),c=api.createComposition();r.audio.setComposition(c);assert.equal(r.audio.readLevel(c.layers[0].id),0);await r.audio.enable();await r.audio.play();
 assert.equal(r.audio.readLevel(c.layers[0].id),.25);const count=r.renders;c.layers[0].pan=-.75;r.audio.setComposition(c);
 assert.equal(r.renders,count);assert.equal(r.pans[0].pan.value,-.75);assert.equal(r.audio.getSnapshot().playing,true);
 r.audio.stop();assert.equal(r.audio.readLevel(c.layers[0].id),0);await r.audio.dispose();
});
