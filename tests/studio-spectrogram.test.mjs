import test from 'node:test';
import assert from 'node:assert/strict';
import {build,transform} from 'esbuild';
import {readFile} from 'node:fs/promises';
const load=async path=>{const b=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false});return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].contents).toString('base64'));};
const engine=await transform(await readFile('assets/studio-engine.ts','utf8'),{loader:'ts',format:'esm'});
const {analyzePcm}=await import('data:text/javascript;base64,'+Buffer.from(engine.code).toString('base64'));
const model=await load('desktop-src/studio-spectrogram-model.ts').catch(()=>({}));
const pcm=(left,right=left)=>({length:left.length,numberOfChannels:2,sampleRate:48000,getChannelData:c=>c?right:left});
const tone=(hz,gain=1)=>Float32Array.from({length:1024},(_,i)=>gain*Math.sin(2*Math.PI*hz*i/48000));
test('mapping crops original sampled frequencies and normalizes to full matrix',()=>{
 assert.equal(typeof model.mapSpectrogram,'function');
 const a=analyzePcm(pcm(tone(6000)),64),full=model.mapSpectrogram(a),crop=model.mapSpectrogram(a,1000);
 assert.equal(full.binSpacing,375);assert.equal(full.highestHz,23625);assert.equal(crop.highestHz,750);assert.equal(crop.visibleBins,3);
 assert.equal(full.max,crop.max);assert.equal(full.frameStarts.at(-1),768/48000);assert.equal(full.frameStarts[10],Math.floor(10*768/31)/48000);
 assert.ok(full.intensities[0][16]>.999);assert.equal(Math.max(...full.intensities.flat()),1);assert.ok(crop.intensities.flat().every(v=>v<.01));
});
test('real silence, asymmetric stereo and cancelled mono retain honest analysis distinctions',()=>{
 assert.equal(typeof model.mapSpectrogram,'function');
 const zero=analyzePcm(pcm(new Float32Array(1024))),cancel=analyzePcm(pcm(tone(3000),tone(3000,-1))),stereo=analyzePcm(pcm(tone(3000),new Float32Array(1024)));
 assert.equal(model.mapSpectrogram(zero).max,0);assert.ok(model.mapSpectrogram(zero).intensities.flat().every(v=>v===0));
 assert.equal(model.mapSpectrogram(cancel).max,0);assert.notEqual(cancel.peakDb,null);assert.ok(model.mapSpectrogram(stereo).max>0);
});
test('single frame/bin, empty data and invalid rate are bounded without invented resolution',()=>{
 assert.equal(typeof model.mapSpectrogram,'function');
 const base={duration:1/48000,sampleRate:48000,spectrogram:[[.5]],waveform:[],spectrum:[],peakDb:null,rmsDb:null};
 assert.deepEqual(model.mapSpectrogram(base).frameStarts,[0]);assert.equal(model.mapSpectrogram(base).highestHz,0);
 assert.equal(model.mapSpectrogram({...base,spectrogram:[]}).visibleBins,0);
 assert.equal(model.mapSpectrogram({...base,sampleRate:0}).visibleBins,0);
});
test('paint is one cell per actual sample, high frequency at top, zero stays background',()=>{
 assert.equal(typeof model.paintSpectrogram,'function');
 const calls=[],ctx={fillStyle:'',fillRect(...rect){calls.push({color:this.fillStyle,rect});}};
 const a={duration:.1,sampleRate:48000,spectrogram:[[0,1],[.5,0]],waveform:[],spectrum:[],peakDb:null,rmsDb:null};
 model.paintSpectrogram(ctx,model.mapSpectrogram(a),20,10,{low:[0,0,0],high:[200,100,50]});
 assert.deepEqual(calls[1],{color:'rgb(200,100,50)',rect:[0,0,10,5]});
 assert.deepEqual(calls[0],{color:'rgb(0,0,0)',rect:[0,5,10,5]});assert.equal(calls.length,4);
});
