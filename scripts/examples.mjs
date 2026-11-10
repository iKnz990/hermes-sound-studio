import {build} from 'esbuild';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const result=await build({stdin:{contents:`export * from './assets/studio-engine';export * from './desktop-src/compose-model';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const api=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'));
const dry={eq:true,compressor:true,saturation:false,chorus:false,delay:true,reverb:true};
const bass=api.createSoundPatch({name:'Signal Bass',seed:5701,baseFreq:110,chords:[0],noise:0,filter:{type:'lowpass',cutoff:1100,res:.7,drive:.6},osc1:{enabled:true,type:'triangle',vol:.65,tune:0},osc2:{enabled:true,type:'sine',vol:.25,tune:-12},osc3:{enabled:false,type:'sine',vol:0,tune:0},fx:{...dry,delay:false,reverb:false},modMatrix:[],lfo1:{enabled:false,type:'sine',rate:1,depth:0},lfo2:{enabled:false,type:'sine',rate:1,depth:0}});
const chords=api.createSoundPatch({name:'Glass Chords',seed:5702,baseFreq:220,chords:[0,3,7],duration:.7,adsr:{a:30,d:120,s:.55,r:400},noise:0,filter:{type:'lowpass',cutoff:3500,res:.8,drive:0},osc1:{enabled:true,type:'sine',vol:.45,tune:0,detune:-4,pan:-.25},osc2:{enabled:true,type:'triangle',vol:.2,tune:12,detune:4,pan:.25,spread:6},osc3:{enabled:false,type:'square',vol:0,tune:0},fx:dry,modMatrix:[],lfo1:{enabled:false,type:'sine',rate:1,depth:0},lfo2:{enabled:false,type:'sine',rate:1,depth:0}});
const lead=api.createSoundPatch({name:'Orbit Lead',seed:5703,baseFreq:440,chords:[0],duration:.28,adsr:{a:6,d:70,s:.4,r:120},noise:.01,filter:{type:'lowpass',cutoff:5800,res:1.2,drive:1},osc1:{enabled:true,type:'sine',vol:.6,tune:0,pan:-.12},osc2:{enabled:true,type:'triangle',vol:.12,tune:12,detune:7,pan:.2},osc3:{enabled:false,type:'square',vol:0,tune:0},fx:dry,modMatrix:[],lfo1:{enabled:false,type:'sine',rate:1,depth:0},lfo2:{enabled:false,type:'sine',rate:1,depth:0}});
const notes=(prefix,rows)=>rows.map(([beat,pitch,duration=1,velocity=.75],i)=>({id:`${prefix}-${i+1}`,beat,pitch,duration,velocity}));
const composition=api.validateComposition({schemaVersion:'Composition/v1',id:'signal-garden-demo-v1',name:'Signal Garden',tempo:96,meter:4,root:57,bars:4,selectedLayer:'lead-demo',loopStart:0,loopEnd:16,layers:[
 {id:'bass-demo',name:'Bass',patch:bass,gainDb:-8,pan:0,muted:false,notes:notes('bass',[[0,45,1.5],[2,45,.75,.6],[4,50,1.5],[6,50,.75,.65],[8,52,1.5],[10,52,.75,.6],[12,45,1.5],[14,45,1,.7]])},
 {id:'chords-demo',name:'Chords',patch:chords,gainDb:-14,pan:0,muted:false,notes:notes('chord',[[0,57,3,.6],[4,62,3,.6],[8,64,3,.6],[12,57,3,.65]])},
 {id:'lead-demo',name:'Melodic Lead',patch:lead,gainDb:-9,pan:.08,muted:false,notes:notes('lead',[[0,69,.5],[1,64,.5,.6],[2,67,.5],[3,71,.5,.65],[4,69,.5],[5.5,65,.5,.6],[6,64,.5],[7,62,.5,.65],[8,64,.5],[9,67,.5,.6],[10,71,.5],[11,69,.5,.7],[12,69,.5],[13,67,.5,.65],[14,64,.5],[15,69,.75,.85]])}
]});
await mkdir('examples',{recursive:true});
await writeFile('examples/signal-garden.composition.json',JSON.stringify(composition,null,2)+'\n');
await writeFile('examples/glass-chords.sound.json',JSON.stringify(chords,null,2)+'\n');
const palette=JSON.parse(await readFile('assets/studio-palettes.json','utf8'))[0];
const theme=api.validateSoundTheme({...palette,name:'Signal Garden UI',events:{...palette.events,onCommit:chords}});
await writeFile('examples/signal-garden.theme.json',JSON.stringify(theme,null,2)+'\n');
console.log('Wrote validated Signal Garden composition and Glass Chords patch.');
