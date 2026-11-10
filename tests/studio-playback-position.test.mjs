import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const load=async path=>{try{const b=await build({entryPoints:[path],bundle:true,platform:'node',format:'cjs',write:false,external:['react']});const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);return m.exports;}catch{return {};}};
const {CanvasSpectrogram}=await load('desktop-src/studio-spectrogram.tsx');
const playback=await load('desktop-src/studio-playback-position.tsx');
const a={waveform:[],spectrum:[],spectrogram:[[0,1]],sampleRate:48000,duration:.1,peakDb:-1,rmsDb:-2};
test('canvas accessible summary is truthful before context initialization and uses one canvas',()=>{
 assert.equal(typeof CanvasSpectrogram,'function');const html=renderToStaticMarkup(React.createElement(CanvasSpectrogram,{analysis:a,label:'Tone'}));
 assert.equal((html.match(/<canvas/g)||[]).length,1);assert.match(html,/relative/i);assert.match(html,/not.*dBFS/i);assert.match(html,/Window starts/);assert.match(html,/absolute.*Peak.*RMS/i);assert.doesNotMatch(html,/ss-spectral-column/);
});
test('playback matching requires actual analysis object, selected event and current complete render key',()=>{
 assert.equal(typeof playback.matchPlaybackPosition,'function');
 const position={voiceId:1,event:'onCommit',renderIdentity:'inputs',startedAt:10,contextTime:10.25,renderedDuration:1,playing:true};
 const engine={getPlaybackPosition:()=>position,getAnalysisIdentity:x=>x===a?'inputs':null,getRenderIdentity:()=> 'inputs'};
 assert.equal(playback.matchPlaybackPosition(engine,'onCommit',a),position);
 assert.equal(playback.matchPlaybackPosition(engine,'onError',a),null);assert.equal(playback.matchPlaybackPosition(engine,'onCommit',{...a}),null);
 assert.equal(playback.matchPlaybackPosition({...engine,getRenderIdentity:()=> 'edited'},'onCommit',a),null);
 assert.equal(playback.matchPlaybackPosition({...engine,getPlaybackPosition:()=>null},'onCommit',a),null);
});
test('idle timeline reserves space without fabricating playback or duration',()=>{
 assert.equal(typeof playback.PlaybackPosition,'function');
 const engine={getPlaybackPosition:()=>null};
 const html=renderToStaticMarkup(React.createElement(playback.PlaybackPosition,{engine,event:'onCommit',analysis:null}));assert.match(html,/data-active="false"/);assert.match(html,/Audition playback timeline/);assert.match(html,/— \/ — s/);
});
