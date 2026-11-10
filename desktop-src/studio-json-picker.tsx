import React,{useEffect,useId,useRef,useState} from 'react';
import {createJsonImportController,type JsonImportOptions} from './studio-json-import';

/** Native button keeps keyboard activation/focus; the local file input is never submitted. */
export function JsonFileImport<T>({help,options}:{help:string;options:JsonImportOptions<T>}){
 const input=useRef<HTMLInputElement>(null),latest=useRef(options),helpId=useId();latest.current=options;
 const [controller]=useState(()=>createJsonImportController(()=>latest.current));
 useEffect(()=>{controller.activate();return()=>controller.dispose();},[controller]);
 return <span data-json-import="" className="ss-json-import"><button type="button" aria-describedby={helpId} onClick={()=>{controller.invalidate();if(input.current){input.current.value='';input.current.click();}}}>Import JSON</button><input ref={input} type="file" hidden accept=".json,application/json" aria-label="Choose local JSON file" onChange={e=>{void controller.selectInput(e.currentTarget);}}/><span id={helpId} className="ss-json-import-help">{help} Read locally · .json · max 2 MB. Confirmation required.</span></span>;
}
