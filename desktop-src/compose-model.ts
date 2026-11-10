import {createSoundPatch,validateSoundPatch,type SoundPatch} from '../assets/studio-engine';

export type ComposeNote = {id:string;beat:number;duration:number;pitch:number;velocity:number};
export type ComposeLayer = {id:string;name:string;patch:SoundPatch;gainDb:number;pan?:number;muted:boolean;notes:ComposeNote[]};
export type Composition = {
 schemaVersion:'Composition/v1';id:string;name:string;tempo:number;meter:3|4;root:number;bars:number;
 layers:ComposeLayer[];selectedLayer:string;loopStart?:number;loopEnd?:number;
};
export const MAX_COMPOSE_LAYERS=8;
export const MAX_COMPOSE_NOTES=256;

function shape(value:unknown,keys:readonly string[],what:string):asserts value is Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))throw new TypeError(`${what}: invalid keys`);
}
function text(value:unknown,what:string,max=80):string{
 if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f\u007f]/.test(value))throw new TypeError(`${what}: expected 1–${max} printable characters`);
 return value;
}
function number(value:unknown,min:number,max:number,what:string,integer=false):number{
 if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||integer&&!Number.isInteger(value))throw new RangeError(`${what}: out of range`);
 return value;
}
function identity(value:unknown,seen:Set<string>,what:string):string{
 const id=text(value,what,128);if(seen.has(id))throw new TypeError(`${what}: duplicate identity`);seen.add(id);return id;
}
function notes(value:unknown,seen:Set<string>):ComposeNote[]{
 if(!Array.isArray(value)||value.length>MAX_COMPOSE_NOTES)throw new RangeError('notes: at most 256 notes');
 const result:ComposeNote[]=[];
 for(const note of value){
  shape(note,['id','beat','duration','pitch','velocity'],'note');
  const id=identity(note.id,seen,'note id'),beat=number(note.beat,0,16,'beat'),duration=number(note.duration,.25,4,'duration');
  if(beat+duration>16)throw new RangeError('note end: must not exceed beat 16');
  result.push({id,beat,duration,pitch:number(note.pitch,28,84,'pitch',true),velocity:number(note.velocity,.1,1,'velocity')});
 }
 return result;
}
function layer(value:unknown,seen:Set<string>):ComposeLayer{
 const panned=!!value&&typeof value==='object'&&Object.hasOwn(value,'pan');
 shape(value,['id','name','patch','gainDb','muted','notes',...(panned?['pan']:[])],'layer');
 if(typeof value.muted!=='boolean')throw new TypeError('muted: expected boolean');
 return {id:identity(value.id,seen,'layer id'),name:text(value.name,'layer name'),patch:validateSoundPatch(value.patch),gainDb:number(value.gainDb,-48,6,'gainDb'),...(panned?{pan:number(value.pan,-1,1,'pan')}:{}),muted:value.muted,notes:notes(value.notes,seen)};
}

/** Strict, detached validation. Notes outside a shortened loop remain editable; schedulers filter them. */
export function validateComposition(value:unknown):Composition{
 const windowed=!!value&&typeof value==='object'&&Object.hasOwn(value,'loopStart');
 shape(value,['schemaVersion','id','name','tempo','meter','root','bars','layers','selectedLayer',...(windowed?['loopStart','loopEnd']:[])],'composition');
 if(value.schemaVersion!=='Composition/v1')throw new TypeError('composition: unsupported version');
 if(value.meter!==3&&value.meter!==4)throw new TypeError('meter: expected 3 or 4');
 if(!Array.isArray(value.layers)||value.layers.length<1||value.layers.length>MAX_COMPOSE_LAYERS)throw new RangeError('layers: expected 1–8 layers');
 const seen=new Set<string>(),id=identity(value.id,seen,'composition id'),layers:ComposeLayer[]=[];
 for(const item of value.layers)layers.push(layer(item,seen));
 if(layers.reduce((count,item)=>count+item.notes.length,0)>MAX_COMPOSE_NOTES)throw new RangeError('composition: at most 256 notes total');
 if(typeof value.selectedLayer!=='string'||!layers.some(item=>item.id===value.selectedLayer))throw new TypeError('selectedLayer: unknown layer');
 const bars=number(value.bars,1,4,'bars',true);
 const loop=windowed?{loopStart:number(value.loopStart,0,bars*value.meter-.5,'loop start'),loopEnd:number(value.loopEnd,.5,bars*value.meter,'loop end')}:{};
 if(windowed&&loop.loopEnd!-loop.loopStart!<.5)throw new RangeError('Loop must contain at least half a beat');
 return {schemaVersion:'Composition/v1',id,name:text(value.name,'composition name'),tempo:number(value.tempo,60,200,'tempo'),meter:value.meter,root:number(value.root,36,72,'root',true),bars,layers,selectedLayer:value.selectedLayer,...loop};
}
export const loopWindow=(c:Composition)=>({start:c.loopStart??0,end:c.loopEnd??c.bars*c.meter});

/** Deterministic default sound, unique identity, detached inputs; no random musical settings. */
export function createLayer(patch:SoundPatch=createSoundPatch(),name='New layer',pattern:ComposeNote[]=[]):ComposeLayer{
 return layer({id:crypto.randomUUID(),name,patch,gainDb:0,muted:false,notes:pattern},new Set());
}

/** Copy sound only by default. Passing true also copies notes with fresh identities. */
export function duplicateLayer(source:ComposeLayer,includePattern=false):ComposeLayer{
 if(typeof includePattern!=='boolean')throw new TypeError('includePattern: expected boolean');
 const valid=layer(source,new Set());
 return {...valid,id:crypto.randomUUID(),name:valid.name,notes:includePattern?valid.notes.map(note=>({...note,id:crypto.randomUUID()})):[]};
}

export function createComposition():Composition{
 const bass=createLayer(createSoundPatch({name:'Compose Bass',seed:0x434f4d50,baseFreq:110,chords:[0],osc1:{enabled:true,type:'triangle',vol:.8,tune:0},osc2:{enabled:true,type:'sine',vol:.35,tune:0},noise:0}),'Bass',
  [0,2,4,6].map(beat=>({id:crypto.randomUUID(),beat,duration:1,pitch:45,velocity:.8})));
 const chords=createLayer(createSoundPatch({name:'Compose Chords',seed:0x434f4d51,baseFreq:220,chords:[0,3,7],osc1:{enabled:true,type:'sine',vol:.65,tune:0},osc2:{enabled:true,type:'triangle',vol:.3,tune:12},noise:0}),'Chords',
  [0,4].map(beat=>({id:crypto.randomUUID(),beat,duration:2,pitch:57,velocity:.65})));
 bass.gainDb=-6;chords.gainDb=-12;
 return validateComposition({schemaVersion:'Composition/v1',id:crypto.randomUUID(),name:'Untitled composition',tempo:120,meter:4,root:57,bars:2,layers:[bass,chords],selectedLayer:bass.id});
}
