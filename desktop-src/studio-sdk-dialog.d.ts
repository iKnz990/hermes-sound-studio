declare module '@hermes/plugin-sdk' {
  import type { ComponentType, ReactNode } from 'react';
  type Readable<T>={get:()=>T;listen:(listener:()=>void)=>()=>void};
  export const ROUTES_AREA:string;
  export const SIDEBAR_NAV_AREA:string;
  export const STATUSBAR_AREAS:{right:string};
  export const host:{
    state:{focusedSessionOwner:Readable<{profile:string;connectionId:string}|null>;focusedSessionId:Readable<string|null>;gateway:Readable<string>;profile:Readable<string>;connectionId:Readable<string|null>;cwd?:Readable<string>};
    profileRoutes?:()=>Promise<import('./studio-background-draft').DraftRoute[]>;
    retainProfile?:(route:import('./studio-background-draft').DraftRoute)=>Promise<()=>void>;
    requestProfile?:(route:import('./studio-background-draft').DraftRoute,method:string,params:Record<string,unknown>,timeoutMs?:number)=>Promise<any>;
    newChat?:(profile?:string)=>void;
    composer?:{getDraft:(address:string)=>Promise<string|null>;setDraft:(address:string,text:string)=>Promise<boolean>;submit:(address:string,text:string)=>boolean;focus?:(address:string)=>void};
    notify?:(value:{kind:'info'|'success'|'error';message:string})=>void;
  };
  export const Dialog: ComponentType<{open:boolean;onOpenChange:(open:boolean)=>void;children?:ReactNode}>;
  export const DialogContent: ComponentType<{className?:string;onCloseAutoFocus?:(event:Event)=>void;children?:ReactNode}>;
  export const DialogHeader: ComponentType<{children?:ReactNode}>;
  export const DialogTitle: ComponentType<{children?:ReactNode}>;
}
