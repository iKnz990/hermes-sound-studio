import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const built=await build({entryPoints:['assets/studio-engine.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {renderSoundPatch,createSoundPatch}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].contents).toString('base64'));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function context(gate,throwOnDisconnect=false){
 const nodes=[],param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){}});
 const ctx={sampleRate:48000,destination:{},nodes,startRendering:()=>gate.promise,
  createBuffer(channels,length,rate){const data=Array.from({length:channels},()=>new Float32Array(length));return {numberOfChannels:channels,length,sampleRate:rate,getChannelData:c=>data[c]};}};
 for(const method of ['createGain','createOscillator','createBiquadFilter','createWaveShaper','createDynamicsCompressor','createDelay','createConvolver','createStereoPanner','createBufferSource','createConstantSource'])ctx[method]=()=>{
  const node={method,disconnections:0,connect(){},start(){},stop(){},disconnect(){this.disconnections++;if(throwOnDisconnect&&nodes[0]===this)throw Error('cleanup fault');}};
  for(const key of ['frequency','detune','Q','gain','pan','delayTime','threshold','knee','ratio','attack','release','offset'])node[key]=param();
  nodes.push(node);return node;
 };
 return ctx;
}
function patch(ordered){return createSoundPatch({noise:.2,osc1:{enabled:true,type:'sine',vol:.5,tune:0,pan:.2,spread:10},lfo1:{enabled:true,type:'sine',rate:1,depth:.2},lfo2:{enabled:true,type:'sine',rate:2,depth:.1},modMatrix:[{source:'LFO 1',dest:'Osc 2 Pitch',amount:.2},{source:'LFO 2',dest:'Pan',amount:.2},{source:'Env 1 (ADSR)',dest:'Filter Cutoff',amount:.2},{source:'Velocity',dest:'Osc 1 Level',amount:.2}],fx:{eq:true,saturation:true,compressor:true,chorus:true,delay:true,reverb:true},...(ordered?{fxOrder:['eq','saturation','compressor','chorus','delay','reverb']}:{})});}

test('parallel and ordered FX graphs remain connected until rendering finishes, then release every node',async()=>{
 const original=globalThis.OfflineAudioContext;
 try{for(const ordered of [false,true]){
  const gate=deferred(),ctx=context(gate);globalThis.OfflineAudioContext=class{constructor(){return ctx;}};
  const pending=renderSoundPatch(patch(ordered));
  assert.ok(ctx.nodes.some(n=>n.method==='createConvolver'));
  assert.ok(ctx.nodes.some(n=>n.method==='createConstantSource'));
  assert.ok(ctx.nodes.every(n=>n.disconnections===0));
  const result={complete:true};gate.resolve(result);assert.strictEqual(await pending,result);
  assert.ok(ctx.nodes.every(n=>n.disconnections===1),JSON.stringify(ctx.nodes.filter(n=>n.disconnections!==1).map(n=>n.method)));
 }}finally{globalThis.OfflineAudioContext=original;}
});

test('failed renders release all nodes and preserve the render error even if cleanup throws',async()=>{
 const original=globalThis.OfflineAudioContext,gate=deferred(),ctx=context(gate,true);
 globalThis.OfflineAudioContext=class{constructor(){return ctx;}};
 try{const pending=renderSoundPatch(patch(true)),error=Error('render failed');gate.reject(error);await assert.rejects(pending,e=>e===error);assert.ok(ctx.nodes.every(n=>n.disconnections===1));}
 finally{globalThis.OfflineAudioContext=original;}
});
