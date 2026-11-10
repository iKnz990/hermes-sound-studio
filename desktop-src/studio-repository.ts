/** Durable, plugin-namespaced studio data. No audio or host/network dependency. */
export const STUDIO_STORE_KEY = 'sound-studio-v1';
export const STUDIO_BACKUP_KEY = 'sound-studio-v1-backup';
export const STUDIO_MARKER_KEY = 'sound-studio-v1-initialized';
export type StudioStorage = { get<T>(key:string,fallback:T):T; set(key:string,value:unknown):void };
type Project<T> = {id:string;name:string;theme:T;updatedAt:number};
type Preset<P> = {id:string;name:string;patch:P;updatedAt:number};
type Doc<T,P,E> = {version:1;revision:number;theme:T;selected:E;mode:'beginner'|'advanced';projects:Project<T>[];presets:Preset<P>[];activeProject:string|null;dirty:boolean};
const copy = <T,>(value:T):T => JSON.parse(JSON.stringify(value));
const freeze = <T,>(value:T):T => { if(value && typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);} return value; };
const object = (v:unknown):v is Record<string,unknown> => !!v && typeof v==='object' && !Array.isArray(v);
const exact = (v:unknown,keys:string[]):v is Record<string,unknown> => object(v) && Object.keys(v).length===keys.length && keys.every(k=>Object.hasOwn(v,k));
function label(v:unknown):string {if(typeof v!=='string'||![...v.trim()].length||[...v.trim()].length>80||/[\u0000-\u001f]/.test(v))throw Error('Use a name of 1–80 printable characters.');return v.trim();}
function stamp(v:unknown):number {if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw Error('Invalid save timestamp.');return v;}

export function createRepository<T extends {name:string;events:Record<E,P>},P extends {name:string},E extends string>(
 storage:StudioStorage|undefined, defaults:T, validateTheme:(v:unknown)=>T, validatePatch:(v:unknown)=>P, eventNames:readonly E[]
){
 let doc:Doc<T,P,E>={version:1,revision:0,theme:validateTheme(defaults),selected:(eventNames.includes('onCommit' as E)?'onCommit':eventNames[0]) as E,mode:'beginner',projects:[],presets:[],activeProject:null,dirty:false};
 let baseline:unknown=null,blocked=false,error='',status='New project',revision=0;
 const history:T[]=[],redo:T[]=[],listeners=new Set<()=>void>();
 let gestureActive=false,gestureRecorded=false;
 const decode=(value:unknown):Doc<T,P,E>=>{
  if(!exact(value,['version','revision','theme','selected','mode','projects','presets','activeProject','dirty'])||value.version!==1||typeof value.revision!=='number'||!Number.isSafeInteger(value.revision)||value.revision<0||!eventNames.includes(value.selected as E)||!['beginner','advanced'].includes(value.mode as string)||typeof value.dirty!=='boolean'||!(value.activeProject===null||typeof value.activeProject==='string')||!Array.isArray(value.projects)||value.projects.length>100||!Array.isArray(value.presets)||value.presets.length>256)throw Error('Invalid saved studio data.');
  const projects=value.projects.map((v:unknown)=>{if(!exact(v,['id','name','theme','updatedAt']))throw Error('Invalid project.');return {id:label(v.id),name:label(v.name),theme:validateTheme(v.theme),updatedAt:stamp(v.updatedAt)};});
  const presets=value.presets.map((v:unknown)=>{if(!exact(v,['id','name','patch','updatedAt']))throw Error('Invalid preset.');return {id:label(v.id),name:label(v.name),patch:validatePatch(v.patch),updatedAt:stamp(v.updatedAt)};});
  if(new Set(projects.map(p=>p.id)).size!==projects.length||new Set(presets.map(p=>p.id)).size!==presets.length||value.activeProject!==null&&!projects.some(p=>p.id===value.activeProject))throw Error('Invalid library identities.');
  return {version:1,revision:value.revision,theme:validateTheme(value.theme),selected:value.selected as E,mode:value.mode as 'beginner'|'advanced',projects,presets,activeProject:value.activeProject as string|null,dirty:value.dirty};
 };
 if(storage){
  try{baseline=copy(storage.get(STUDIO_STORE_KEY,null));if(baseline!==null){doc=decode(baseline);status='Recovered local workspace';}
   else if(storage.get(STUDIO_MARKER_KEY,false)||storage.get(STUDIO_BACKUP_KEY,null)!==null)throw Error('Previously saved primary is unavailable.');}
  catch{blocked=true;error='Saved data is unreadable. Export your work; local saves are paused to protect it.';try{const b=storage.get(STUDIO_BACKUP_KEY,null);if(b!==null){doc=decode(b);status='Recovered previous local snapshot';}}catch{/* preserve both bad records */}}
 }else{blocked=true;error='Local storage unavailable. Export your work before closing.';}
 type State=Doc<T,P,E>&{status:string;error:string;canUndo:boolean;canRedo:boolean};
 let state:State;
 const updateState=()=>{state=freeze({...copy(doc),status,error,canUndo:history.length>0,canRedo:redo.length>0});revision++;for(const fn of listeners)fn();};
 const fail=(message:string)=>{error=message;status='Not saved';updateState();return false;};
 const persist=(candidate:Doc<T,P,E>,message:string):boolean=>{
  if(blocked||!storage)return fail(error||'Local saving is unavailable. Export your work.');
  try{
   const current=storage.get(STUDIO_STORE_KEY,null);
   if(JSON.stringify(current)!==JSON.stringify(baseline)){blocked=true;throw Error('Storage changed in another view. Reload before saving; export these edits first.');}
   const next=decode({...candidate,revision:doc.revision+1});
   const serialized=JSON.stringify(next);if(serialized.length>4_000_000)throw Error('Local library is full. Export this project instead.');
   if(baseline!==null){storage.set(STUDIO_BACKUP_KEY,baseline);if(JSON.stringify(storage.get(STUDIO_BACKUP_KEY,null))!==JSON.stringify(baseline))throw Error('Backup could not be verified.');}
   storage.set(STUDIO_MARKER_KEY,true);
   if(storage.get<boolean>(STUDIO_MARKER_KEY,false)!==true)throw Error('Save marker could not be verified.');
   storage.set(STUDIO_STORE_KEY,next);
   if(JSON.stringify(storage.get(STUDIO_STORE_KEY,null))!==serialized)throw Error('Save could not be verified. Export your work.');
   baseline=copy(next);doc=next;error='';status=message;updateState();return true;
  }catch(e){return fail(e instanceof Error?e.message:'Local save failed. Export your work.');}
 };
 const apply=(next:T,record=true)=>{
  try{next=validateTheme(next);}catch{return fail('Invalid sound settings. Nothing changed.');}
  if(record&&(!gestureActive||!gestureRecorded)){history.push(copy(doc.theme));if(history.length>50)history.shift();redo.length=0;if(gestureActive)gestureRecorded=true;}
  doc={...doc,theme:next,dirty:true};return persist(doc,'Draft recovered locally');
 };
 updateState();
 return {
  get state(){return state;},
  subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};},getSnapshot:()=>revision,
  setTheme:(theme:T)=>apply(theme),
  beginGesture:()=>{gestureActive=true;gestureRecorded=false;},
  endGesture:()=>{gestureActive=false;gestureRecorded=false;},
  setPatch:(patch:P)=>{try{const p=validatePatch(patch);return apply({...doc.theme,events:{...doc.theme.events,[doc.selected]:p}});}catch{return fail('Invalid sound settings. Nothing changed.');}},
  select:(event:E)=>{if(!eventNames.includes(event))return fail('Unknown event.');doc={...doc,selected:event};return persist(doc,'Selection remembered');},
  setMode:(mode:'beginner'|'advanced')=>{if(!['beginner','advanced'].includes(mode))return false;doc={...doc,mode};return persist(doc,'View remembered');},
  undo:()=>{gestureActive=false;gestureRecorded=false;const theme=history.pop();if(!theme)return false;redo.push(copy(doc.theme));return apply(theme,false);},
  redo:()=>{gestureActive=false;gestureRecorded=false;const theme=redo.pop();if(!theme)return false;history.push(copy(doc.theme));return apply(theme,false);},
  saveProject:(name?:string)=>{
   try{
    const title=label(name??doc.theme.name),old=doc.projects.find(p=>p.id===doc.activeProject&&p.name===title);
    if(!old&&doc.projects.length>=100)return fail('Project library is full. Export this project.');
    const theme=validateTheme({...doc.theme,name:title});const row={id:old?.id??crypto.randomUUID(),name:title,theme,updatedAt:Date.now()};
    const projects=old?doc.projects.map(p=>p.id===old.id?row:p):[row,...doc.projects];
    return persist({...doc,theme,projects,activeProject:row.id,dirty:false},'Project saved locally');
   }catch(e){return fail(e instanceof Error?e.message:'Project save failed.');}
  },
  loadProject:(id:string)=>{const row=doc.projects.find(p=>p.id===id);if(!row)return fail('Project not found.');history.push(copy(doc.theme));redo.length=0;doc={...doc,theme:validateTheme(row.theme),activeProject:id,dirty:false};return persist(doc,'Project loaded');},
  savePreset:(name?:string)=>{
   try{if(doc.presets.length>=256)return fail('Preset library is full. Export this sound.');const title=label(name??doc.theme.events[doc.selected].name),patch=validatePatch({...doc.theme.events[doc.selected],name:title});const row={id:crypto.randomUUID(),name:title,patch,updatedAt:Date.now()};return persist({...doc,presets:[row,...doc.presets]},'Preset saved locally');}catch(e){return fail(e instanceof Error?e.message:'Preset save failed.');}
  },
  loadPreset:(id:string)=>{const row=doc.presets.find(p=>p.id===id);if(!row)return fail('Preset not found.');return apply({...doc.theme,events:{...doc.theme.events,[doc.selected]:validatePatch(row.patch)}});}
 };
}
