import {validateComposition,type Composition} from './compose-model';
import type {renderCompositionWav,compositionExportKey} from './compose-export';

export type CompositionExportState={busy:boolean;completed:number;total:number;message:string;error:string};
export const EMPTY_COMPOSITION_EXPORT:CompositionExportState={busy:false,completed:0,total:0,message:'',error:''};
export type CompositionExportSnapshot={composition:Composition;soloLayers:ReadonlySet<string>;scopeKey:string;owner:unknown};
type Options={read:()=>CompositionExportSnapshot;render:typeof renderCompositionWav;key:typeof compositionExportKey;download:(result:Awaited<ReturnType<typeof renderCompositionWav>>,filename:string)=>void;onState:(state:CompositionExportState)=>void};
export function compositionWavFilename(name:string):string{
 let base=name.replace(/\.wav$/i,'').replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g,'-').replace(/\.{2,}/g,'-').replace(/\s+/g,' ').replace(/^[ .]+|[ .]+$/g,'').slice(0,100).replace(/[ .]+$/g,'');
 if(!base)base='composition';
 if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base))base='composition-'+base;
 return base+'.wav';
}
/** Export owns a detached snapshot, never the running transport or persisted consent. */
export function createCompositionWavExporter(options:Options){
 type Request={controller:AbortController;key:string;scopeKey:string;owner:unknown};
 let active:Request|null=null,disposed=false;
 const publish=(state:CompositionExportState)=>{if(!disposed)options.onState(state);};
 const current=(request:Request)=>{
  if(disposed||active!==request||request.controller.signal.aborted)return false;
  try{const live=options.read();return live.owner===request.owner&&live.scopeKey===request.scopeKey&&options.key(live.composition,live.soloLayers)===request.key;}catch{return false;}
 };
 const cancel=(message='WAV export cancelled.')=>{const request=active;if(!request)return;active=null;request.controller.abort();publish({...EMPTY_COMPOSITION_EXPORT,message});};
 const checkCurrent=()=>{if(active&&!current(active))cancel('Composition or mix changed. Export WAV again.');};
 const start=async():Promise<boolean>=>{
  if(disposed||active)return false;
  let request:Request|null=null;
  try{
   const snapshot=options.read(),composition=validateComposition(snapshot.composition),soloLayers=new Set(snapshot.soloLayers);
   request={controller:new AbortController(),key:options.key(composition,soloLayers),scopeKey:snapshot.scopeKey,owner:snapshot.owner};active=request;
   publish({...EMPTY_COMPOSITION_EXPORT,busy:true,message:'Rendering composition WAV…'});
   if(!current(request)){checkCurrent();return false;}
   const owned=request;
   const result=await options.render(composition,{soloLayers,signal:request.controller.signal,onProgress:(completed,total)=>{
    if(active!==owned||disposed)return;
    if(!current(owned)){checkCurrent();return;}
    publish({busy:true,completed,total,message:'Rendering composition WAV…',error:''});
   }});
   if(active!==request||disposed)return false;
   if(!current(request)){checkCurrent();return false;}
   options.download(result,compositionWavFilename(composition.name));
   active=null;
   publish({...EMPTY_COMPOSITION_EXPORT,message:`WAV download requested · ${result.duration.toFixed(2)} s · 48 kHz stereo · one loop + effect tails.`});
   return true;
  }catch(error){
   if(disposed||(request&&active!==request))return false;
   active=null;
   publish({...EMPTY_COMPOSITION_EXPORT,error:`WAV export failed: ${error instanceof Error?error.message:String(error)}`});
   return false;
  }
 };
 return {start,cancel,checkCurrent,dispose:()=>{if(disposed)return;disposed=true;active?.controller.abort();active=null;}};
}
