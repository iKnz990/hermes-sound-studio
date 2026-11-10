import {createComposition,validateComposition,type Composition} from './compose-model';
import type {StudioStorage} from './studio-repository';
export type {StudioStorage} from './studio-repository';

export const COMPOSE_STORE_KEY='compose-workspace-v1';
export const COMPOSE_BACKUP_KEY='compose-workspace-v1-backup';
export const COMPOSE_MARKER_KEY='compose-workspace-v1-initialized';
export type SavedComposition={id:string;name:string;composition:Composition;updatedAt:number};
export type ComposeRecovery='new'|'draft'|'saved'|'backup'|'unavailable';
export type ComposeState={composition:Composition;compositions:SavedComposition[];activeId:string|null;dirty:boolean;status:string;error:string;canUndo:boolean;recovery:ComposeRecovery;blocked:boolean};
type Document={version:1;revision:number;composition:Composition;compositions:SavedComposition[];activeId:string|null;dirty:boolean};
type UndoEntry={composition:Composition;activeId:string|null};
const copy=<T,>(value:T):T=>JSON.parse(JSON.stringify(value));
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function freeze<T>(value:T):T{
 if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;
}
function shape(value:unknown,keys:string[],what:string):asserts value is Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))throw new TypeError(`${what}: invalid keys`);
}
function text(value:unknown,what:string,max=80):string{
 if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f\u007f]/.test(value))throw new TypeError(`${what}: expected 1–${max} printable characters`);return value;
}
function natural(value:unknown,what:string):number{
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw new TypeError(`${what}: expected nonnegative safe integer`);return value;
}
function decode(value:unknown):Document{
 shape(value,['version','revision','composition','compositions','activeId','dirty'],'Compose workspace');
 if(value.version!==1||typeof value.dirty!=='boolean'||!(value.activeId===null||typeof value.activeId==='string')||!Array.isArray(value.compositions)||value.compositions.length>100)throw new TypeError('Invalid saved Compose workspace.');
 const revision=natural(value.revision,'revision'),composition=validateComposition(value.composition),compositions:SavedComposition[]=[],ids=new Set<string>();
 for(const item of value.compositions){
  shape(item,['id','name','composition','updatedAt'],'saved composition');const id=text(item.id,'saved id',128),name=text(item.name,'saved name');
  if(ids.has(id))throw new TypeError('Duplicate saved composition id.');ids.add(id);
  const saved=validateComposition(item.composition);if(saved.name!==name)throw new TypeError('Saved composition name mismatch.');
  compositions.push({id,name,composition:saved,updatedAt:natural(item.updatedAt,'updatedAt')});
 }
 if(value.activeId!==null&&!ids.has(value.activeId))throw new TypeError('Unknown active composition.');
 return {version:1,revision,composition,compositions,activeId:value.activeId,dirty:value.dirty};
}

/**
 * Own namespace, current draft plus detached named snapshots. Mutations return durable-save
 * success, not edit acceptance: a false result with an error may still retain an in-memory edit.
 * Corruption/staleness blocks writes for this instance; export remains available. No auto-repair.
 * Storage has no CAS: checks detect observed races, not an atomic cross-process transaction.
 */
export function createComposeStore(storage?:StudioStorage){
 let doc:Document={version:1,revision:0,composition:createComposition(),compositions:[],activeId:null,dirty:false};
 let baseline:unknown=null,knownBackup:unknown=null,knownMarker:unknown=null;
 let status='New composition',error='',blocked=false,recovery:ComposeRecovery='new',snapshot=0;
 const history:UndoEntry[]=[],listeners=new Set<()=>void>();
 let gesture=false,gestureRecorded=false;
 const endGesture=()=>{gesture=false;gestureRecorded=false;};
 if(!storage){blocked=true;recovery='unavailable';error='Local storage unavailable. Export your composition before closing.';}
 else{
  let validPrimary=false;
  try{
   baseline=copy(storage.get(COMPOSE_STORE_KEY,null));knownMarker=copy(storage.get(COMPOSE_MARKER_KEY,null));knownBackup=copy(storage.get(COMPOSE_BACKUP_KEY,null));
   if(baseline!==null){doc=decode(baseline);validPrimary=true;recovery=doc.dirty?'draft':'saved';status=doc.dirty?'Recovered local draft':'Recovered saved composition';}
   if(knownMarker!==null&&knownMarker!==true)throw new Error('Invalid Compose save marker.');
   if(baseline!==null&&knownMarker!==true)throw new Error('Compose save marker is missing.');
   if(knownBackup!==null)decode(knownBackup);
   if(baseline===null&&(knownMarker!==null||knownBackup!==null))throw new Error('Previously saved Compose primary is unavailable.');
  }catch(e){
   blocked=true;error=`${e instanceof Error?e.message:'Saved Compose data is unreadable.'} Local saves are paused to protect existing data; export your work.`;
   if(!validPrimary){
    recovery='unavailable';status='Saved workspace unavailable';
    try{const backup=storage.get(COMPOSE_BACKUP_KEY,null);if(backup!==null){doc=decode(backup);recovery='backup';status='Recovered previous snapshot (read-only)';}}catch{/* Preserve corrupt records verbatim. */}
   }
  }
 }
 let state:ComposeState;
 const publish=()=>{
  state=freeze({...copy({composition:doc.composition,compositions:doc.compositions,activeId:doc.activeId,dirty:doc.dirty}),status,error,canUndo:history.length>0,recovery,blocked});
  snapshot++;for(const listener of listeners){try{listener();}catch{/* A subscriber cannot undo a verified storage operation. */}}
 };
 const fail=(message:string)=>{error=message;status='Not saved';publish();return false;};
 const remember=()=>{history.push(copy({composition:doc.composition,activeId:doc.activeId}));if(history.length>50)history.shift();};
 const assertPrimaryUnchanged=()=>{
  if(!storage||!same(storage.get(COMPOSE_STORE_KEY,null),baseline)){
   blocked=true;throw new Error('Compose storage changed in another view. Reload before saving; export these edits first.');
  }
 };
 const persist=(candidate:Document,message:string):boolean=>{
  if(blocked||!storage){doc={...doc,dirty:true};return fail(error||'Local saving is unavailable. Export your composition.');}
  let attemptedPrimary=false;
  try{
   assertPrimaryUnchanged();
   if(!same(storage.get(COMPOSE_MARKER_KEY,null),knownMarker)||!same(storage.get(COMPOSE_BACKUP_KEY,null),knownBackup)){
    blocked=true;throw new Error('Compose storage marker or backup changed. Export and reload before saving.');
   }
   const next=decode({...candidate,revision:natural(doc.revision+1,'revision')});const serialized=JSON.stringify(next);
   if(serialized.length>4_000_000)throw new Error('Compose library is full. Export this composition.');
   if(baseline!==null){
    storage.set(COMPOSE_BACKUP_KEY,copy(baseline));const check=storage.get(COMPOSE_BACKUP_KEY,null);
    if(!same(check,baseline))throw new Error('Compose backup could not be verified. Export your work.');
    decode(check);knownBackup=copy(check);
   }
   storage.set(COMPOSE_MARKER_KEY,true);
   if(storage.get(COMPOSE_MARKER_KEY,null)!==true)throw new Error('Compose save marker could not be verified.');
   knownMarker=true;
   // Recheck after preparation, so a concurrent write observed during backup cannot be lost.
   assertPrimaryUnchanged();
   attemptedPrimary=true;storage.set(COMPOSE_STORE_KEY,copy(next));const check=storage.get(COMPOSE_STORE_KEY,null);
   if(JSON.stringify(check)!==serialized){
    if(!same(check,baseline))blocked=true;
    throw new Error('Compose save could not be verified. Export your work.');
   }
   decode(check);baseline=copy(check);doc=next;error='';status=message;recovery=doc.dirty?'draft':'saved';publish();return true;
  }catch(e){
   // A throwing setter may have committed. Never blindly retry over uncertain primary data.
   if(attemptedPrimary&&!blocked){try{if(!same(storage.get(COMPOSE_STORE_KEY,null),baseline))blocked=true;}catch{blocked=true;}}
   doc={...doc,dirty:true};return fail(e instanceof Error?e.message:'Local Compose save failed. Export your work.');
  }
 };
 const apply=(composition:Composition,activeId=doc.activeId,record=true):boolean=>{
  if(same(composition,doc.composition)&&activeId===doc.activeId){if(!record)publish();return !blocked&&!error;}
  if(record&&(!gesture||!gestureRecorded)){remember();if(gesture)gestureRecorded=true;}
  doc={...doc,composition,activeId,dirty:true};return persist(doc,'Draft saved locally');
 };
 publish();
 return {
  get state(){return state;},
  subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},
  getSnapshot:()=>snapshot,
  beginGesture:()=>{if(!gesture){gesture=true;gestureRecorded=false;}},
  endGesture,
  update:(make:(composition:Composition)=>Composition):boolean=>{
   let next:Composition;try{next=validateComposition(make(copy(doc.composition)));}catch(e){return fail(e instanceof Error?e.message:'Invalid composition. Nothing changed.');}
   return apply(next);
  },
  importComposition:(value:unknown):boolean=>{
   let next:Composition;try{next=validateComposition(value);}catch(e){return fail(e instanceof Error?e.message:'Invalid composition. Nothing changed.');}
   endGesture();
   return apply(next,null);
  },
  select:(id:string):boolean=>{
   if(!doc.composition.layers.some(item=>item.id===id))return fail('Unknown Compose layer.');
   endGesture();
   return apply(validateComposition({...doc.composition,selectedLayer:id}));
  },
  save:(name:string=doc.composition.name):boolean=>{
   endGesture();
   try{
    const title=text(name,'composition name').trim(),composition=validateComposition({...doc.composition,name:title});
    const old=doc.compositions.find(item=>item.id===doc.activeId&&item.name===title);
    if(!old&&doc.compositions.length>=100)return fail('Compose library is full. Export your composition.');
    const item:SavedComposition={id:old?.id??crypto.randomUUID(),name:title,composition,updatedAt:Date.now()};
    return persist({...doc,composition,compositions:old?doc.compositions.map(row=>row.id===old.id?item:row):[item,...doc.compositions],activeId:item.id,dirty:false},'Composition saved locally');
   }catch(e){return fail(e instanceof Error?e.message:'Composition save failed.');}
  },
  open:(id:string):boolean=>{
   const item=doc.compositions.find(row=>row.id===id);if(!item)return fail('Saved composition not found.');
   endGesture();
   remember();doc={...doc,composition:validateComposition(item.composition),activeId:id,dirty:false};return persist(doc,'Composition opened');
  },
  newComposition:():boolean=>{endGesture();remember();doc={...doc,composition:createComposition(),activeId:null,dirty:false};return persist(doc,'New composition');},
  undo:():boolean=>{
   endGesture();
   const previous=history.pop();if(!previous)return false;
   return apply(validateComposition(previous.composition),previous.activeId,false);
  },
  exportJson:()=>JSON.stringify(validateComposition(doc.composition),null,2),
 };
}
export type ComposeStore=ReturnType<typeof createComposeStore>;
