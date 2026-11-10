import {SONIC_UI_CSS} from './plugin-style';

type StyleLease={node:HTMLStyleElement;users:number;owned:boolean};
const leases=new WeakMap<Document,StyleLease>();
/** One scoped sheet per document; non-DOM registration and foreign sheets are safe. */
export function installPluginStyles(target:Document|undefined=typeof document==='undefined'?undefined:document):()=>void {
 if(!target?.head||typeof target.querySelector!=='function'||typeof target.createElement!=='function')return()=>{};
 let lease=leases.get(target);
 if(!lease){
  const existing=target.querySelector<HTMLStyleElement>('style[data-sonic-ui-styles]');
  const node=existing??target.createElement('style');
  if(!existing){node.setAttribute('data-sonic-ui-styles','');node.textContent=SONIC_UI_CSS;target.head.appendChild(node);}
  lease={node,users:0,owned:!existing};leases.set(target,lease);
 }
 lease.users++;let disposed=false;
 return()=>{if(disposed)return;disposed=true;if(--lease.users===0){if(lease.owned)lease.node.remove();leases.delete(target);}};
}
