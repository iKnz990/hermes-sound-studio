import React from 'react';

/** Shared task/document chrome. Each mounted view supplies only actions it actually owns. */
export function StudioTopbar({taskNavigation,documentName,saveStatus,unsaved=false,saveAction,documentActions,viewActions}: {
 taskNavigation?:React.ReactNode;
 documentName:React.ReactNode;
 saveStatus:string;
 unsaved?:boolean;
 saveAction?:React.ReactNode;
 documentActions?:React.ReactNode;
 viewActions?:React.ReactNode;
}) {
 return <header className="ss-topbar">
  <div className="ss-task-switcher" role="navigation" aria-label="Studio task">{taskNavigation}</div>
  <div className="ss-document">{typeof documentName==='string'?<span className="ss-document-name" title={documentName}>{documentName}</span>:documentName}<span className="ss-save-status" data-unsaved={unsaved} role="status">{saveStatus}</span></div>
  <div className="ss-topbar-actions">{saveAction}{documentActions&&<details className="ss-document-menu"><summary>Document actions</summary><div className="ss-menu-pop">{documentActions}</div></details>}{viewActions}</div>
 </header>;
}
