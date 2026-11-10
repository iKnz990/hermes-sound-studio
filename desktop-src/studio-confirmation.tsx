import React,{useCallback,useEffect,useId,useRef,useState} from 'react';

type Review={message:string;scope:string;isCurrent?:()=>boolean;resolve:(accepted:boolean)=>void;opener:HTMLElement|null};
/** Non-modal consent: edits remain available, so callers must bind a live snapshot predicate. */
export function useInlineConfirmation(scopeIdentity:string):{request:(message:string,isCurrent?:()=>boolean)=>Promise<boolean>;cancel:()=>void;prompt:React.ReactNode}{
 const [review,setReview]=useState<Review|null>(null),pending=useRef<Review|null>(null),mounted=useRef(true),scope=useRef(scopeIdentity),cancelButton=useRef<HTMLButtonElement|null>(null),titleId=useId();
 scope.current=scopeIdentity;
 const settle=useCallback((accepted:boolean,render=true)=>{
  const current=pending.current;if(!current)return;
  pending.current=null;
  let valid=false;
  try{valid=accepted&&mounted.current&&current.scope===scope.current&&(current.isCurrent?.()??true);}catch{/* A revoked/failed ownership check is cancellation, not permission. */}
  if(render&&mounted.current)setReview(null);
  current.resolve(valid);
  if(current.opener?.isConnected)current.opener.focus();
 },[]);
 const cancel=useCallback(()=>settle(false),[settle]);
 useEffect(()=>{mounted.current=true;setReview(null);return()=>{mounted.current=false;settle(false,false);};},[scopeIdentity,settle]);
 useEffect(()=>{if(review&&pending.current===review)cancelButton.current?.focus();},[review]);
 const request=useCallback((message:string,isCurrent?:()=>boolean)=>{
  // Capture before settling the previous request, whose focus restoration is independent.
  const opener=typeof document==='undefined'?null:document.activeElement as HTMLElement|null;
  settle(false);
  if(!mounted.current)return Promise.resolve(false);
  return new Promise<boolean>(resolve=>{const next={message,isCurrent,scope:scope.current,resolve,opener};pending.current=next;setReview(next);});
 },[settle]);
 const prompt=review?<section className="ss-inline-confirmation" role="region" aria-labelledby={titleId} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancel();}}}>
  <h2 id={titleId}>Review replacement</h2><p>{review.message}</p><div className="ss-inline-confirmation-actions"><button type="button" onClick={()=>{if(pending.current===review)settle(true);}}>Confirm</button><button type="button" ref={cancelButton} onClick={()=>{if(pending.current===review)cancel();}}>Cancel</button></div>
 </section>:null;
 return {request,cancel,prompt};
}
