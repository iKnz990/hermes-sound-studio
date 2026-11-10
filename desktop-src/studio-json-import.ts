import {validateSoundPatch,validateSoundTheme,type SoundPatch,type SoundTheme} from '../assets/studio-engine';
import type {StudioStore} from './studio-store';

/** Decimal MB; reject before Blob.text() allocates the UTF-8 document. */
export const MAX_JSON_IMPORT_BYTES=2_000_000;
export type SoundImport={kind:'theme';value:SoundTheme}|{kind:'patch';value:SoundPatch};
export function validateSoundImport(value:unknown):SoundImport{
 const schema=value&&typeof value==='object'?(value as {schemaVersion?:unknown}).schemaVersion:undefined;
 if(schema==='SoundTheme/v1')return {kind:'theme',value:validateSoundTheme(value)};
 if(schema==='SoundPatch/v1')return {kind:'patch',value:validateSoundPatch(value)};
 throw new TypeError('Sound Design accepts SoundTheme/v1 or SoundPatch/v1 JSON only.');
}
/** Strict validation precedes even stopping playback. No audio enablement is performed. */
export function applySoundImport(store:StudioStore,candidate:SoundImport,stop:()=>void):boolean{
 const next=validateSoundImport(candidate.value);
 stop();store.endGesture();
 return next.kind==='theme'?store.setTheme(next.value):store.setPatch(next.value);
}
export type ImportSnapshot={target:unknown;revision:number;scope?:string;selection?:string};
export type JsonImportOptions<T>={
 snapshot:()=>ImportSnapshot;inScope:()=>boolean;validate:(value:unknown)=>T;
 confirm:(value:T,isCurrent?:()=>boolean)=>boolean|Promise<boolean>;cancelConfirmation?:()=>void;apply:(value:T)=>boolean;report:(message:string,error:boolean)=>void;
};
type JsonFile=Pick<File,'name'|'size'|'text'>;
export type ImportResult='imported'|'unsaved'|'cancelled'|'rejected'|'stale';
const unchanged=(a:ImportSnapshot,b:ImportSnapshot)=>a.target===b.target&&a.revision===b.revision&&a.scope===b.scope&&a.selection===b.selection;

/** File.text cannot be aborted: ownership checks discard late reads without touching music. */
export function createJsonImportController<T>(latest:()=>JsonImportOptions<T>){
 let mounted=true,sequence=0;
 const select=async(file:JsonFile|undefined):Promise<ImportResult>=>{
  const token=++sequence;
  latest().cancelConfirmation?.();
  if(!file||!mounted)return 'cancelled';
  const start=latest().snapshot();
  const owns=()=>mounted&&sequence===token;
  const current=()=>owns()&&latest().inScope()&&unchanged(start,latest().snapshot());
  const stale=():ImportResult=>{if(owns())latest().report('Workspace or selection changed. Import again; current edits were kept.',true);return 'stale';};
  try{
   if(!current())return stale();
   if(!/\.json$/i.test(file.name))throw new TypeError('Choose a .json file. File type hints do not validate its contents.');
   if(!Number.isSafeInteger(file.size)||file.size<0||file.size>MAX_JSON_IMPORT_BYTES)throw new RangeError('JSON file is too large. Maximum: 2 MB (2,000,000 bytes).');
   const text=await file.text();
   if(!current())return stale();
   const candidate=latest().validate(JSON.parse(text));
   if(!current())return stale();
   // Explicit replacement consent is required even for a pristine document.
   const accepted=await latest().confirm(candidate,current);
   if(!current())return stale();
   if(!accepted){latest().report('Import cancelled. Current work kept.',false);return 'cancelled';}
   const saved=latest().apply(candidate);
   if(owns())latest().report(saved?'Imported JSON. Draft saved locally; Undo can restore the previous work.':'Imported JSON, but local saving could not be verified. Export JSON before closing.',!saved);
   return saved?'imported':'unsaved';
  }catch(e){
   if(!owns())return 'stale';
   if(!current())return stale();
   latest().report(`JSON import failed: ${e instanceof Error?e.message:String(e)}`,true);return 'rejected';
  }
 };
 return {
  select,
  selectInput:(input:Pick<HTMLInputElement,'files'|'value'>)=>{const file=input.files?.[0];input.value='';return select(file);},
  invalidate:()=>{sequence++;latest().cancelConfirmation?.();},
  activate:()=>{mounted=true;},
  dispose:()=>{mounted=false;sequence++;latest().cancelConfirmation?.();},
 };
}
