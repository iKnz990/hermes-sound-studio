import React from 'react';
import { describeSoundRouting, validateSoundPatch, getFxParameters, FX_ORDER, type FxKey, type FxParameters, type SoundPatch } from '../assets/studio-engine';
import { ToggleControl, ModuleCard, ParameterKnob, ParameterGroup } from './studio-components';
import {ParameterPlaneTarget,svgLocalPoint} from './studio-xy-pad';
import {effectPreviewModel} from './studio-effect-preview-model';

const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
/** Parameter-derived previews; these are not measured audio analysis. */
export function CurvePlot({label,path,children,fill=false}:{label:string;path:string;children?:React.ReactNode;fill?:boolean}) {return <svg className="ss-curve" viewBox="0 0 600 125" role="img" aria-label={`${label} · parameter-derived preview`}><path className="ss-env-guide" d="M30 15V108H580 M30 62H580"/>{fill&&<path className="ss-envelope-fill" d={`${path} L580 108 L30 108 Z`}/>}<path className="ss-env-line" d={path}/>{children}</svg>;}
export function CurveHandle({label,x,y,value,min,max,step,onChange,onGestureStart,onGestureEnd,axis='x',mapPointer}:{label:string;x:number;y:number;value:number;min:number;max:number;step:number;onChange:(v:number)=>void;onGestureStart?:()=>void;onGestureEnd?:()=>void;axis?:'x'|'y';mapPointer?:(x:number,y:number)=>number}) {
 const active=React.useRef<{pointerId:number;node:SVGCircleElement}|null>(null),endRef=React.useRef(onGestureEnd);endRef.current=onGestureEnd;
 const emit=(v:number)=>onChange(Number(clamp(Math.round(v/step)*step,min,max).toFixed(6)));
 const finish=(pointerId?:number)=>{const owned=active.current;if(!owned||(pointerId!==undefined&&owned.pointerId!==pointerId))return;active.current=null;try{if(owned.node.hasPointerCapture(owned.pointerId))owned.node.releasePointerCapture(owned.pointerId);}catch{/* Detached SVGs can already have lost capture. */}endRef.current?.();};
 React.useEffect(()=>()=>finish(),[]);
 return <circle className="ss-curve-handle" cx={x} cy={y} r="9" tabIndex={0} role="slider" aria-label={`${label} handle`} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} onPointerDown={e=>{if(e.button!==0||active.current)return;try{e.currentTarget.setPointerCapture(e.pointerId);}catch{return;}active.current={pointerId:e.pointerId,node:e.currentTarget};onGestureStart?.();}} onPointerMove={e=>{if(active.current?.pointerId!==e.pointerId)return;const svg=e.currentTarget.ownerSVGElement;if(!svg)return;const local=svgLocalPoint(svg,e.clientX,e.clientY);if(!local)return;emit(mapPointer?mapPointer(local.x,local.y):axis==='x'?min+(local.x-30)/550*(max-min):max-(local.y-15)/93*(max-min));}} onPointerUp={e=>finish(e.pointerId)} onPointerCancel={e=>finish(e.pointerId)} onLostPointerCapture={e=>finish(e.pointerId)} onKeyDown={e=>{const d=e.key==='ArrowUp'||e.key==='ArrowRight'?1:e.key==='ArrowDown'||e.key==='ArrowLeft'?-1:0;if(d){e.preventDefault();emit(value+d*step*(e.shiftKey?10:1));}else if(e.key==='Home'){e.preventDefault();emit(min);}else if(e.key==='End'){e.preventDefault();emit(max);}}}/>;
}
type FilterType=SoundPatch['filter']['type'];
const FILTER_MIN_DB=-72,FILTER_MAX_DB=24,FILTER_MIN_HZ=40,FILTER_MAX_HZ=16000;
/** Web Audio low/highpass Q is in dB; bandpass/notch use linear Q (Web Audio API BiquadFilterNode). */
export function filterResponseDb(type:FilterType,cutoff:number,res:number,sampleRate:number,frequency:number):number {
 const w0=2*Math.PI*cutoff/sampleRate,w=2*Math.PI*frequency/sampleRate,c=Math.cos(w0),q=type==='lowpass'||type==='highpass'?10**(res/20):res,alpha=Math.sin(w0)/(2*q);
 let b0:number,b1:number,b2:number;
 if(type==='lowpass'){b0=(1-c)/2;b1=1-c;b2=b0;}
 else if(type==='highpass'){b0=(1+c)/2;b1=-(1+c);b2=b0;}
 else if(type==='bandpass'){b0=alpha;b1=0;b2=-alpha;}
 else {b0=1;b1=-2*c;b2=1;}
 const a0=1+alpha,a1=-2*c,a2=1-alpha;
 const magnitude=(v0:number,v1:number,v2:number)=>Math.hypot(v0+v1*Math.cos(w)+v2*Math.cos(2*w),v1*Math.sin(w)+v2*Math.sin(2*w));
 return 20*Math.log10(Math.max(1e-12,magnitude(b0,b1,b2)/magnitude(a0,a1,a2)));
}
export function filterPlotSamples(filter:SoundPatch['filter'],sampleRate:number) {
 return Array.from({length:161},(_,i)=>{const frequency=FILTER_MIN_HZ*(FILTER_MAX_HZ/FILTER_MIN_HZ)**(i/160),rawDb=filterResponseDb(filter.type,filter.cutoff,filter.res,sampleRate,frequency);return {frequency,db:clamp(rawDb,FILTER_MIN_DB,FILTER_MAX_DB),x:30+550*i/160,y:15+93*(FILTER_MAX_DB-clamp(rawDb,FILTER_MIN_DB,FILTER_MAX_DB))/(FILTER_MAX_DB-FILTER_MIN_DB)};});
}
export function filterControlValues(x:number,y:number) {return {cutoff:40*400**clamp((x-30)/550,0,1),res:.1+7.9*clamp((108-y)/93,0,1)};}
export function FilterCurve({patch,sampleRate=48000,onChange,onChangePair,onGestureStart,onGestureEnd}:{patch:SoundPatch;sampleRate?:number;onChange?:(k:'cutoff'|'res',v:number)=>void;onChangePair?:(values:{cutoff:number;res:number})=>void;onGestureStart?:()=>void;onGestureEnd?:()=>void}) {
 const {cutoff,res,type}=patch.filter,x=30+550*Math.log(cutoff/FILTER_MIN_HZ)/Math.log(FILTER_MAX_HZ/FILTER_MIN_HZ),points=filterPlotSamples(patch.filter,sampleRate);
 const gesture={onGestureStart,onGestureEnd};
 return <svg className="ss-curve ss-filter-response" data-sample-rate={sampleRate} viewBox="0 0 600 125" role={onChangePair||onChange?'group':'img'} aria-label={`${type} biquad response in dB, 40 to 16000 Hz · cutoff ${cutoff} Hz, resonance ${res}${type==='lowpass'||type==='highpass'?' dB Q':' Q'} · ${sampleRate} samples per second`}>
  {[24,0,-24,-48,-72].map(db=><g key={db}><path className="ss-env-guide" d={`M30 ${15+93*(24-db)/96}H580`}/><text x="2" y={19+93*(24-db)/96}>{db} dB</text></g>)}<text x="30" y="122">40 Hz</text><text x="512" y="122">16 kHz</text>
  <path className="ss-env-line" d={`M${points.map(p=>`${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L')}`}/>
  <desc>Parameter target: cutoff X, resonance Y; not a response peak or gain control. Scalar controls remain below.</desc>
  {onChangePair?<ParameterPlaneTarget x={(x-30)/550} y={1-(res-.1)/7.9} label={`Filter parameter target: cutoff ${cutoff} Hz, resonance ${res}. Left/right cutoff; up/down resonance; not a response peak.`} onChange={(px,py)=>onChangePair(filterControlValues(30+px*550,15+py*93))} {...gesture}/>:onChange?<CurveHandle label="Cutoff" x={x} y={40} value={cutoff} min={40} max={16000} step={10} mapPointer={localX=>40*400**((localX-30)/550)} onChange={v=>onChange('cutoff',v)} {...gesture}/>:null}
 </svg>;
}
export function ShapePreview({shape,rate=1,label}:{shape:string;rate?:number;label:string}) {const windowSeconds=2/(1+rate/5),points=Array.from({length:161},(_,i)=>{const t=i/160*2*Math.PI*rate*windowSeconds,n=shape==='square'?(Math.sin(t)>=0?1:-1):shape==='triangle'?2/Math.PI*Math.asin(Math.sin(t)):shape==='sawtooth'?2*(t/(2*Math.PI)%1)-1:Math.sin(t);return `${i*2.5} ${23-16*n}`;}).join(' ');return <svg className="ss-shape-preview" viewBox="0 0 400 46" role="img" aria-label={`${label}: ${shape} shape at ${rate} Hz, window ${Math.round(windowSeconds*1000)} ms; not measured audio`}><polyline points={points}/></svg>;}
export function EffectPreview({patch,effect,active,sampleRate=48000}:{patch:SoundPatch;effect:FxKey;active:boolean;sampleRate?:number}) {
 const model=effectPreviewModel(patch,effect,sampleRate);
 return <figure className="ss-fx-parameter-preview" data-effect={effect} data-active={active}><svg className="ss-effect-preview ss-parameter-response" viewBox="0 0 600 125" role="img" aria-label={`${effect}: ${model.description} · Parameter-derived · ${active?'Enabled':'Bypassed'} · not measured PCM`}><path className="ss-env-guide" d="M30 15V108H580 M30 62H580"/><path className="ss-env-line" d={model.path}/></svg><figcaption><strong>Parameter-derived · {active?'Enabled':'Bypassed'}</strong><span>{model.description}; not measured PCM.</span><span>{model.xLabel} · {model.yLabel}</span>{model.annotations.map((text,i)=><span key={i}>{text}</span>)}</figcaption></figure>;
}
const ROUTE_NODE_WIDTH=164,ROUTE_NODE_HEIGHT=46,ROUTE_COLUMNS=4,ROUTE_MIN_ZOOM=.7;
/** Keep engine-owned distinctions, including noise, mono pass-through and gain semantics. */
export function routeNodeCaption(label:string,_zoom=1) { return label; }
/** Conservative glyph budget; wrapping grows the node instead of dropping semantic tokens. */
export function routeNodeMetrics(label:string,zoom=1) {
 const fontSize=12/clamp(zoom,ROUTE_MIN_ZOOM,2),lineHeight=fontSize*1.3;
 const budget=Math.max(1,Math.floor((ROUTE_NODE_WIDTH-20)/(fontSize*.65)));
 const lines:string[]=[];
 let line='';
 for(const word of routeNodeCaption(label,zoom).split(/\s+/)){
  if(line&&(line+' '+word).length>budget){lines.push(line);line='';}
  // Engine labels fit whole words; future unbroken identifiers may wrap without deletion.
  let rest=word;
  while(rest.length>budget){lines.push(rest.slice(0,budget));rest=rest.slice(budget);}
  line=line?line+' '+rest:rest;
 }
 if(line)lines.push(line);
 return {width:ROUTE_NODE_WIDTH,height:Math.max(ROUTE_NODE_HEIGHT,26+lines.length*lineHeight),fontSize,lineHeight,lines};
}
/** Bounds include the actual last node rectangle and margins, not a fixed 900px canvas. */
export function routingBounds(count:number,columnCount=ROUTE_COLUMNS) {
  const columns=Math.min(columnCount,Math.max(1,count));
  return {width:28+(columns-1)*216+ROUTE_NODE_WIDTH+28,height:Math.max(180,30+Math.floor(Math.max(0,count-1)/columns)*100+ROUTE_NODE_HEIGHT+30)};
}
/** Fit bounds first, but never shrink meaningful labels below a readable floor; pan when necessary. */
export function readableRouteFit(width:number,height:number,availableWidth:number,availableHeight:number) {
  return clamp(Math.min(availableWidth/width,availableHeight/height),ROUTE_MIN_ZOOM,2);
}
export function GraphNode({label,x,y,kind,selected=false,pressed=selected,onSelect,onNavigate,overviewIndex,zoom=1}:{label:string;x:number;y:number;kind:string;selected?:boolean;pressed?:boolean;onSelect?:()=>void;onNavigate?:()=>void;overviewIndex?:number;zoom?:number}) {
 const metrics=routeNodeMetrics(label,zoom);
 return <g className={`ss-route-node ss-route-${kind} ss-route-pick`} data-selected={selected} tabIndex={onSelect?0:undefined} role={onSelect?'button':undefined} aria-label={`Inspect node ${label}${onNavigate?'; Enter or double-click to open editor':'; inspect only, no editable parameter'}`} aria-pressed={onSelect?pressed:undefined} onClick={onSelect} onDoubleClick={onNavigate} onKeyDown={e=>{if(e.key==='Enter'&&onNavigate){e.preventDefault();onNavigate();}else if(onSelect&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onSelect();}}} style={{cursor:onSelect?'pointer':undefined}}><rect x={x} y={y} width={metrics.width} height={metrics.height} rx="6"/><text className="ss-route-caption" style={{fontSize:metrics.fontSize}}><title>{label}</title>{metrics.lines.map((line,i)=><tspan key={i} x={x+10} y={y+22+metrics.fontSize+i*metrics.lineHeight}>{line}{i<metrics.lines.length-1?' ':''}</tspan>)}</text>{overviewIndex&&<text className="ss-route-index" x={x+metrics.width-8} y={y+13} textAnchor="end" style={{fontSize:9/clamp(zoom,ROUTE_MIN_ZOOM,2)}}>{String(overviewIndex).padStart(2,'0')}</text>}</g>;
}
export function SignalPort({x,y,kind,selected=false}:{x:number;y:number;kind:string;selected?:boolean}) {return <g>{selected&&<circle cx={x} cy={y} r="9" fill="none" stroke="var(--ss-accent)" strokeWidth="2.5"/>}{kind==='modulation'?<rect className="ss-route-port ss-route-port-modulation" x={x-4} y={y-4} width="8" height="8" transform={`rotate(45 ${x} ${y})`}/>:<circle className={`ss-route-port ss-route-port-${kind}`} cx={x} cy={y} r="4"/>}</g>;}
type RouteEndpoint={x:number;y:number;width?:number;height?:number;rowBottom?:number};
export function SignalCable({a,b,kind,selected=false,pressed=selected,onSelect,markerId='ss-route-arrow',label}:{a:RouteEndpoint;b:RouteEndpoint;kind:string;selected?:boolean;pressed?:boolean;onSelect?:()=>void;markerId?:string;label?:string}) {const right=a.x+(a.width??ROUTE_NODE_WIDTH),sy=a.y+(a.height??ROUTE_NODE_HEIGHT)/2,ty=b.y+(b.height??ROUTE_NODE_HEIGHT)/2,gutter=kind==='modulation'?a.y-14:(a.rowBottom??a.y+(a.height??ROUTE_NODE_HEIGHT))+18;const d=sy===ty&&b.x-right>0&&b.x-right<80?`M${right} ${sy} H${b.x}`:`M${right} ${sy} H${right+12} V${gutter} H${b.x-12} V${ty} H${b.x}`;return <g className={`ss-route-pick ss-route-edge-${kind}`} data-selected={selected} tabIndex={onSelect?0:undefined} role={onSelect?'button':undefined} aria-label={label} aria-pressed={onSelect?pressed:undefined} onClick={onSelect} onKeyDown={e=>{if(onSelect&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onSelect();}}} style={{cursor:onSelect?'pointer':undefined}}><path d={d} fill="none" className={kind==='modulation'?'ss-route-mod':'ss-route-audio'} style={selected?{stroke:'var(--ss-accent)',strokeWidth:3.5}:undefined} markerEnd={`url(#${markerId})`}/>{onSelect&&<path d={d} fill="none" stroke="transparent" strokeWidth="14" pointerEvents="stroke"/>}</g>;}

export type EditorTarget={kind:'module';tab:0|1|2;controlId:string}|{kind:'effect';effect:FxKey}|{kind:'output';controlId:string};
/** Keys are engine node IDs, never localized or state-dependent labels. controlId refers to data-parameter-id. */
export const ROUTE_EDITOR_TARGETS:Readonly<Record<string,EditorTarget>>={
 oscillators:{kind:'module',tab:0,controlId:'ss-osc1-type'},
 drive:{kind:'module',tab:1,controlId:'ss-filter-drive'},filter:{kind:'module',tab:1,controlId:'ss-filter-cutoff'},
 envelope:{kind:'module',tab:1,controlId:'ss-adsr-a'},env1:{kind:'module',tab:1,controlId:'ss-adsr-a'},
 velocity:{kind:'module',tab:0,controlId:'ss-intensity'},
 lfo1:{kind:'module',tab:2,controlId:'ss-lfo1-rate'},lfo2:{kind:'module',tab:2,controlId:'ss-lfo2-rate'},
 'osc1-level':{kind:'module',tab:0,controlId:'ss-osc1-vol'},'osc2-pitch':{kind:'module',tab:0,controlId:'ss-osc2-tune'},
 'filter-cutoff':{kind:'module',tab:1,controlId:'ss-filter-cutoff'},'filter-resonance':{kind:'module',tab:1,controlId:'ss-filter-res'},
 'output-gain':{kind:'output',controlId:'ss-master'},destination:{kind:'output',controlId:'ss-stereo'},pan:{kind:'output',controlId:'ss-stereo'},
 eq:{kind:'effect',effect:'eq'},saturation:{kind:'effect',effect:'saturation'},compressor:{kind:'effect',effect:'compressor'},chorus:{kind:'effect',effect:'chorus'},delay:{kind:'effect',effect:'delay'},reverb:{kind:'effect',effect:'reverb'},
};
export function routeEditorTarget(nodeId:string):EditorTarget|null {return Object.prototype.hasOwnProperty.call(ROUTE_EDITOR_TARGETS,nodeId)?{...ROUTE_EDITOR_TARGETS[nodeId]}:null;}

type RouteSelection={type:'node'|'edge';id:string}|null;
/** Topology-owned audio order; controls occupy a separate lower band. No edge is invented. */
export function routingLayout(route:ReturnType<typeof describeSoundRouting>,columns=ROUTE_COLUMNS,zoom=1) {
 const controls=route.nodes.filter(n=>n.kind==='modulator'||n.kind==='parameter');
 const audioNodes=route.nodes.filter(n=>!controls.includes(n));
 const edges=route.edges.filter(e=>e.kind==='audio');
 const active=audioNodes.filter(n=>edges.some(e=>e.from===n.id||e.to===n.id));
 const waiting=new Set(active.map(n=>n.id)),orderedIds:string[]=[];
 while(waiting.size){const ready=active.find(n=>waiting.has(n.id)&&!edges.some(e=>e.to===n.id&&waiting.has(e.from)));if(!ready)break;orderedIds.push(ready.id);waiting.delete(ready.id);}
 for(const n of audioNodes)if(!orderedIds.includes(n.id))orderedIds.push(n.id);
 const nodeSizes=new Map(route.nodes.map(n=>[n.id,routeNodeMetrics(n.label,zoom)]));
 const positions=new Map<string,{x:number;y:number;rowBottom:number}>();
 const placeRows=(ids:string[],start:number)=>{
  let y=start;
  for(let i=0;i<ids.length;i+=columns){const row=ids.slice(i,i+columns),rowBottom=y+Math.max(...row.map(id=>nodeSizes.get(id)!.height));row.forEach((id,col)=>positions.set(id,{x:28+col*216,y,rowBottom}));y=rowBottom+64;}
  return y;
 };
 const controlStart=placeRows(orderedIds,30)+40;
 placeRows(controls.map(n=>n.id),controlStart);
 const width=routingBounds(route.nodes.length,columns).width,height=Math.max(180,...[...positions.values()].map(p=>p.rowBottom+30));
 return {orderedIds:[...orderedIds,...controls.map(n=>n.id)],positions,nodeSizes,width,height,controlStart};
}
export function routeEdgeId(edge:ReturnType<typeof describeSoundRouting>['edges'][number],i:number) {return `${i}:${edge.from}:${edge.to}:${edge.kind}:${edge.label??''}`;}
/** Derive emphasis exclusively from the engine's returned topology, without editing it. */
export function routingHighlight(route:ReturnType<typeof describeSoundRouting>,selection:RouteSelection) {
  const chosenEdge=selection?.type==='edge'?route.edges.find((edge,i)=>routeEdgeId(edge,i)===selection.id):undefined;
  const chosenNode=selection?.type==='node'&&route.nodes.some(n=>n.id===selection.id)?selection.id:null;
  return {
    edge:(edge:typeof route.edges[number],i:number)=>selection?.type==='edge'?routeEdgeId(edge,i)===selection.id:chosenNode!==null&&(edge.from===chosenNode||edge.to===chosenNode),
    endpoint:(id:string)=>id===chosenNode||id===chosenEdge?.from||id===chosenEdge?.to,
    node:(id:string)=>id===chosenNode,
  };
}
/** A read-only view of the engine-owned route description; selection changes no patch/wiring. */
export function RoutingGraph({patch,onExpand,onNavigate}: {patch:SoundPatch;onExpand?:(opener:HTMLButtonElement)=>void;onNavigate?:(target:EditorTarget)=>void}) {
  const route=describeSoundRouting(patch),nodes=route.nodes;
  const [zoom,setZoom]=React.useState(1),[columns,setColumns]=React.useState(ROUTE_COLUMNS),[autoFit,setAutoFit]=React.useState(true),[selection,setSelection]=React.useState<RouteSelection>(null),viewport=React.useRef<HTMLDivElement|null>(null),markerId=React.useId().replace(/:/g,'');
  const bounds=routingLayout(route,columns,zoom);
  const positions=bounds.positions;
  const highlighted=routingHighlight(route,selection);
  const endpoint=highlighted.endpoint;
  // Fit against the largest readable labels; higher zoom needs no more row space.
  const fit=()=>{const pane=viewport.current;if(!pane)return;const w=Math.max(1,pane.clientWidth-4),h=Math.max(1,pane.clientHeight-4);let best={columns:ROUTE_COLUMNS,scale:0};for(let c=2;c<=Math.min(8,nodes.length);c++){const b=routingLayout(route,c,ROUTE_MIN_ZOOM),scale=Math.min(w/b.width,h/b.height);if(scale>best.scale)best={columns:c,scale};}const b=routingLayout(route,best.columns,ROUTE_MIN_ZOOM);setColumns(best.columns);setZoom(readableRouteFit(b.width,b.height,w,h));pane.scrollLeft=0;pane.scrollTop=0;};
  React.useEffect(()=>{if(!autoFit||!viewport.current)return;fit();const observer=new ResizeObserver(fit);observer.observe(viewport.current);return()=>observer.disconnect();},[autoFit,JSON.stringify(route)]);
  const resetView=()=>{setAutoFit(false);setZoom(1);if(viewport.current){viewport.current.scrollLeft=0;viewport.current.scrollTop=0;}};
  const fitChain=()=>{setAutoFit(true);fit();};
  const labelFor=(id:string)=>nodes.find(n=>n.id===id)?.label??id;
  const pickedNode=selection?.type==='node'?nodes.find(n=>n.id===selection.id):null;
  const pickedEdge=selection?.type==='edge'?route.edges.find((e,i)=>routeEdgeId(e,i)===selection.id):null;
  return <section className="ss-routing" aria-label="Signal routing" data-selection={!!selection}>
    <p className="ss-muted">{route.mode==='legacy-parallel'?'Legacy inserts with parallel effect sends. Converting to serial requires an explicit confirmation in the effects rack.':'Ordered serial effects. Bypassed stages and modulation are shown from the current patch.'} Connections are inspect-only. Click or Space inspects endpoints. Enter or double-click an editable node to open its controls; fixed internals have no editable parameter.</p>
    <div className="ss-canvas-controls"><button type="button" aria-label="Zoom out" disabled={zoom<=ROUTE_MIN_ZOOM} onClick={()=>{setAutoFit(false);setZoom(z=>clamp(z-.25,ROUTE_MIN_ZOOM,2));}}>−</button><output>Zoom {Math.round(zoom*100)}%</output><button type="button" aria-label="Zoom in" disabled={zoom>=2} onClick={()=>{setAutoFit(false);setZoom(z=>clamp(z+.25,ROUTE_MIN_ZOOM,2));}}>+</button><button type="button" onClick={fitChain}>Fit chain</button><button type="button" onClick={resetView}>Reset view</button><button type="button" onClick={e=>onExpand?.(e.currentTarget)} disabled={!onExpand}>Expand routing</button></div>
    <p className="ss-route-selection" role="status">{pickedNode?`${String(bounds.orderedIds.indexOf(pickedNode.id)+1).padStart(2,'0')} · ${pickedNode.label}`:pickedEdge?`${labelFor(pickedEdge.from)} → ${labelFor(pickedEdge.to)} · ${pickedEdge.kind}`:zoom<1?'Chain overview · full labels wrap on the canvas. Scroll to pan; select to trace endpoints.':'Detail view · select a node or connection to highlight its endpoints.'}</p>
    <div className="ss-route-open">{pickedNode?(onNavigate&&routeEditorTarget(pickedNode.id)?<button type="button" onClick={()=>onNavigate(routeEditorTarget(pickedNode.id)!)}>Open {pickedNode.label} controls</button>:<span>{routeEditorTarget(pickedNode.id)?'Editor navigation is unavailable in this view.':'Inspect only: fixed routing internal; no editable parameter.'}</span>):pickedEdge&&onNavigate?[...new Set([pickedEdge.from,pickedEdge.to])].map(id=>routeEditorTarget(id)?<button key={id} type="button" onClick={()=>onNavigate(routeEditorTarget(id)!)}>Open {labelFor(id)} controls</button>:<span key={id}>{labelFor(id)} · inspect only</span>):<span>Select a node or connection to inspect its controls.</span>}</div>
    <div className="ss-canvas-viewport" ref={viewport} tabIndex={0} aria-label="Routing canvas · scroll to pan"><svg className="ss-route-svg" width={bounds.width*zoom} height={bounds.height*zoom} viewBox={`0 0 ${bounds.width} ${bounds.height}`} role="img" aria-label={`${route.mode==='legacy-parallel'?'Legacy parallel':'Ordered'} signal-flow diagram`}>
      <defs>{(['audio','modulation'] as const).map(kind=><marker key={kind} id={`${markerId}-${kind}`} className={`ss-route-marker ss-route-marker-${kind}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10z"/></marker>)}</defs>
      <text className="ss-route-band" x="28" y={bounds.controlStart-20}>Modulation sources and destinations · control signals, not audio</text>
      {route.edges.map((edge,i)=>({edge,i})).sort((a,b)=>Number(highlighted.edge(a.edge,a.i))-Number(highlighted.edge(b.edge,b.i))).map(({edge,i})=>{const a=positions.get(edge.from),b=positions.get(edge.to);return a&&b?<SignalCable key={routeEdgeId(edge,i)} a={{...a,...bounds.nodeSizes.get(edge.from)!}} b={{...b,...bounds.nodeSizes.get(edge.to)!}} kind={edge.kind} selected={highlighted.edge(edge,i)} pressed={selection?.type==='edge'&&selection.id===routeEdgeId(edge,i)} onSelect={()=>setSelection({type:'edge',id:routeEdgeId(edge,i)})} markerId={`${markerId}-${edge.kind}`} label={`Inspect ${edge.kind} connection ${labelFor(edge.from)} to ${labelFor(edge.to)}`}/>:null;})}
      {nodes.map((node)=>{const index=bounds.orderedIds.indexOf(node.id),p=positions.get(node.id)!,size=bounds.nodeSizes.get(node.id)!;return <React.Fragment key={node.id}><GraphNode label={node.label} overviewIndex={index+1} zoom={zoom} x={p.x} y={p.y} kind={node.kind} selected={endpoint(node.id)} pressed={highlighted.node(node.id)} onSelect={()=>setSelection({type:'node',id:node.id})} onNavigate={onNavigate&&routeEditorTarget(node.id)?()=>onNavigate(routeEditorTarget(node.id)!):undefined}/><SignalPort x={p.x} y={p.y+size.height/2} kind={node.kind==='modulator'?'modulation':node.kind} selected={endpoint(node.id)}/><SignalPort x={p.x+size.width} y={p.y+size.height/2} kind={node.kind==='modulator'?'modulation':node.kind} selected={endpoint(node.id)}/></React.Fragment>;})}
    </svg></div>
    <div className="ss-route-legend"><span>━ Audio · solid line, round endpoint</span><span>┄ Modulation · dashed line, diamond endpoint</span></div>
    <div className="ss-route-details" aria-label="Connection details"><div className="ss-route-details-head"><strong>{pickedEdge?'Selected connection':pickedNode?'Connected paths':'Connection details'}</strong><span>{route.edges.length} paths · scroll list · inspect only</span></div><p className="ss-route-detail-current" role="status">{pickedEdge?`${labelFor(pickedEdge.from)} → ${labelFor(pickedEdge.to)} · ${pickedEdge.kind}${pickedEdge.label?` · ${pickedEdge.label}`:''}`:pickedNode?pickedNode.label:'Choose a path to see its full endpoint names.'}</p><ol className="ss-route-edges" aria-label="Signal connections">{route.edges.map((edge,i)=><li key={routeEdgeId(edge,i)}><button type="button" aria-pressed={selection?.type==='edge'&&selection.id===routeEdgeId(edge,i)} data-related={highlighted.edge(edge,i)} onClick={()=>setSelection({type:'edge',id:routeEdgeId(edge,i)})}><span>{edge.kind}</span> {labelFor(edge.from)} → {labelFor(edge.to)}{edge.label?` · ${edge.label}`:''}</button></li>)}</ol></div>
  </section>;
}

export function EnvelopeCurve({patch,onChange,onGestureStart,onGestureEnd}:{patch:SoundPatch;onChange?:(k:keyof SoundPatch['adsr'],v:number)=>void;onGestureStart?:()=>void;onGestureEnd?:()=>void}) {
  const {a,d,s,r}=patch.adsr,t=patch.duration*1000,x=(ms:number)=>30+550*clamp(ms/t,0,1),sy=108-93*s,ax=x(a),dx=x(a+d),rx=x(Math.max(a+d,t-r)),gesture={onGestureStart,onGestureEnd};
  return <CurvePlot fill label={`Envelope: attack ${a} ms, decay ${d} ms, sustain ${s}, release ${r} ms`} path={`M30 108 L${ax} 15 L${dx} ${sy} L${rx} ${sy} L580 108`}><text x="32" y="10">Attack {a} ms</text><text x="170" y="10">Decay {d} ms</text><text x="310" y="10">Sustain {Math.round(s*100)}%</text><text x="450" y="10">Release {r} ms</text><text x="1" y="28">100%</text><text x="4" y="108">0%</text><text x="30" y="122">0 ms</text><text x="470" y="122">{Math.round(t)} ms · note body</text>{onChange&&<><CurveHandle label="Attack" x={ax} y={15} value={a} min={0} max={Math.min(1000,2500-d-r)} step={1} mapPointer={localX=>(localX-30)/550*t} onChange={v=>onChange('a',v)} {...gesture}/><CurveHandle label="Decay" x={dx} y={sy} value={d} min={0} max={Math.min(1500,2500-a-r)} step={1} mapPointer={localX=>(localX-30)/550*t-a} onChange={v=>onChange('d',v)} {...gesture}/><CurveHandle label="Sustain" x={(dx+rx)/2} y={sy} value={s} min={0} max={1} step={.01} mapPointer={(_localX,localY)=>(108-localY)/93} onChange={v=>onChange('s',v)} {...gesture}/><CurveHandle label="Release" x={rx} y={sy} value={r} min={0} max={Math.min(2000,2500-a-d)} step={1} mapPointer={localX=>t-(localX-30)/550*t} onChange={v=>onChange('r',v)} {...gesture}/></>}</CurvePlot>;
}

export function insertEffectOrder(order:readonly FxKey[],fromIndex:number,slot:number):FxKey[] {
 if(!Number.isInteger(fromIndex)||!Number.isInteger(slot)||fromIndex<0||fromIndex>=order.length||slot<0||slot>order.length)throw new RangeError('Invalid effect insertion slot');
 const next=[...order],item=next.splice(fromIndex,1)[0];
 next.splice(slot>fromIndex?slot-1:slot,0,item);
 return next;
}

export function canonicalPatchReceipt(patch:SoundPatch):string { return JSON.stringify(validateSoundPatch(patch)); }

type FxControl<K extends FxKey>={key:keyof FxParameters[K];label:string;min:number;max:number;step:number;unit:string};
export const FX_CONTROL_SPECS:{[K in FxKey]:readonly FxControl<K>[]}={
 eq:[{key:'frequency',label:'Frequency',min:40,max:16000,step:1,unit:' Hz'},{key:'gainDb',label:'Gain',min:-12,max:12,step:.1,unit:' dB'},{key:'q',label:'Q',min:.1,max:8,step:.1,unit:''}],
 saturation:[{key:'drive',label:'Drive',min:0,max:10,step:.1,unit:''}],
 compressor:[{key:'thresholdDb',label:'Threshold',min:-60,max:0,step:.1,unit:' dB'},{key:'ratio',label:'Ratio',min:1,max:20,step:.1,unit:':1'},{key:'attack',label:'Attack',min:.001,max:1,step:.001,unit:' s'},{key:'release',label:'Release',min:.01,max:2,step:.01,unit:' s'},{key:'kneeDb',label:'Knee',min:0,max:40,step:.1,unit:' dB'}],
 chorus:[{key:'rate',label:'Rate',min:.1,max:5,step:.1,unit:' Hz'},{key:'depth',label:'Depth',min:0,max:.01,step:.0001,unit:' s'},{key:'mix',label:'Wet mix',min:0,max:1,step:.01,unit:''}],
 delay:[{key:'time',label:'Time',min:.01,max:1,step:.01,unit:' s'},{key:'feedback',label:'Feedback',min:0,max:.7,step:.01,unit:''},{key:'mix',label:'Wet mix',min:0,max:1,step:.01,unit:''}],
 reverb:[{key:'decay',label:'Decay',min:.05,max:2,step:.01,unit:' s'},{key:'mix',label:'Wet mix',min:0,max:1,step:.01,unit:''}],
};
export function setFxParameter<K extends FxKey>(patch:SoundPatch,effect:K,key:keyof FxParameters[K],value:number):SoundPatch {
 const parameters=getFxParameters(patch);
 return {...patch,fxParameters:{...parameters,[effect]:{...parameters[effect],[key]:value}}};
}
export function FxParameterEditor<K extends FxKey>({patch,effect,onEdit}:{patch:SoundPatch;effect:K;onEdit:(next:SoundPatch)=>void}) {
 const parameters=getFxParameters(patch);
 return <ParameterGroup label={`${effect} parameters`}>{FX_CONTROL_SPECS[effect].map(spec=><ParameterKnob key={String(spec.key)} id={`ss-fx-param-${effect}-${String(spec.key)}`} label={spec.label} help={`Adjust ${effect} ${spec.label.toLowerCase()}. Editing is silent; audition to hear changes.`} value={Number(parameters[effect][spec.key])} min={spec.min} max={spec.max} step={spec.step} unit={spec.unit} onChange={value=>onEdit(setFxParameter(patch,effect,spec.key,value))}/>)}</ParameterGroup>;
}
export function EffectsRack({patch,onEdit,onUndo,sampleRate=48000,selectedEffect:controlledSelection,onSelectedEffectChange}:{patch:SoundPatch;onEdit:(next:SoundPatch)=>void;onUndo?:()=>void;sampleRate?:number;selectedEffect?:FxKey|null;onSelectedEffectChange?:(effect:FxKey|null)=>void}) {
 const ordered=Array.isArray(patch.fxOrder),order:readonly FxKey[]=patch.fxOrder??FX_ORDER;
 const label=(key:FxKey)=>key==='saturation'?'Saturation / overdrive':key==='eq'?'EQ':key[0].toUpperCase()+key.slice(1);
 const [confirm,setConfirm]=React.useState(false),[dragged,setDragged]=React.useState<number|null>(null),[slot,setSlot]=React.useState<number|null>(null),[receipt,setReceipt]=React.useState<string|null>(null),[localSelection,setLocalSelection]=React.useState<FxKey|null>(null);
 const selectedEffect=controlledSelection===undefined?localSelection:controlledSelection;
 const setSelectedEffect=(effect:FxKey|null)=>{if(controlledSelection===undefined)setLocalSelection(effect);onSelectedEffectChange?.(effect);};
 const canUndo=!!onUndo&&ordered&&receipt!==null&&receipt===canonicalPatchReceipt(patch);
 React.useEffect(()=>{if(receipt&&receipt!==canonicalPatchReceipt(patch))setReceipt(null);},[patch,receipt]);
 const edit=(next:SoundPatch)=>{setReceipt(null);onEdit(next);};
 const insert=(from:number,to:number)=>{if(!ordered)return;const next=insertEffectOrder(order,from,to);if(next.some((key,i)=>key!==order[i]))edit({...patch,fxOrder:next});};
 const drop=(to:number,e:React.DragEvent)=>{e.preventDefault();const key=e.dataTransfer.getData('text/plain');if(dragged!==null&&order[dragged]===key)insert(dragged,to);setDragged(null);setSlot(null);};
 const slotTarget=(index:number,name:string)=><div className="ss-fx-slot" key={`slot-${index}`} data-active={slot===index&&dragged!==null} aria-label={name} onDragOver={e=>{if(dragged!==null){e.preventDefault();e.dataTransfer.dropEffect='move';setSlot(index);}}} onDragLeave={()=>{if(slot===index)setSlot(null);}} onDrop={e=>drop(index,e)}><span aria-hidden="true"/></div>;
 return <section className="ss-effects-rack" aria-label="Effects rack"><p className="ss-muted">{ordered?'Ordered serial rack · enabled effects run one after another; bypassed stages are skipped. Drag to an insertion line or use ↑ ↓.':'Legacy inserts + parallel sends · EQ, saturation and compression insert in the voice chain; chorus, delay and reverb receive parallel sends.'}</p>
  {!ordered&&<div className="ss-fx-conversion"><button type="button" onClick={()=>setConfirm(true)}>Convert to serial routing…</button>{confirm&&<div role="group" aria-label="Confirm serial routing"><p>Serial routing changes the audible path: enabled effects run in the displayed order instead of legacy insert + parallel sends. This is a deliberate conversion, not a move. Undo immediately to restore the omitted fxOrder and legacy routing.</p><button type="button" onClick={()=>{const next={...patch,fxOrder:[...FX_ORDER]};onEdit(next);setReceipt(canonicalPatchReceipt(next));setConfirm(false);}}>Confirm serial conversion</button><button type="button" onClick={()=>setConfirm(false)}>Cancel</button></div>}</div>}
  {ordered&&<><p className="ss-fx-path" aria-label="Serial signal path">{order.map((key,i)=>`${String(i+1).padStart(2,'0')} ${label(key)}${patch.fx[key]?'':' (bypassed)'}`).join(' → ')}</p>{canUndo&&<div className="ss-fx-receipt" role="status">Serial conversion applied. <button type="button" onClick={()=>{setReceipt(null);onUndo?.();}}>Undo conversion · restore legacy routing</button></div>}</>}
  <div className="ss-fx-list">{ordered&&slotTarget(0,`Insert before ${label(order[0])}`)}{order.map((key,index)=><React.Fragment key={key}>
   <section className="ss-module-card ss-fx-card" data-enabled={patch.fx[key]} aria-label={label(key)}>
    <div className="ss-fx-line ss-fx-header" draggable={ordered} onDragStart={e=>{if(!ordered)return;setDragged(index);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',key);}} onDragEnd={()=>{setDragged(null);setSlot(null);}}>
     <span className="ss-fx-handle" aria-hidden="true">{ordered?'⠿':'·'}</span><span className="ss-fx-number">{String(index+1).padStart(2,'0')}</span>
     <h3>{label(key)}</h3><span className="ss-fx-state">{patch.fx[key]?'Enabled':'Bypassed'}</span>
     <label className="ss-toggle ss-fx-toggle" htmlFor={`ss-fx-${key}`}><input id={`ss-fx-${key}`} type="checkbox" aria-label={`Enable ${label(key)}`} checked={patch.fx[key]} onChange={e=>edit({...patch,fx:{...patch.fx,[key]:e.target.checked}})}/><span>Enable</span></label>
     <button type="button" className="ss-fx-edit" aria-label={`Edit ${label(key)} parameters`} aria-expanded={selectedEffect===key} aria-controls={`ss-fx-drawer-${key}`} onClick={()=>setSelectedEffect(selectedEffect===key?null:key)}>Edit parameters <span aria-hidden="true">{selectedEffect===key?'▾':'▸'}</span></button>
     {ordered&&<div className="ss-fx-moves"><button type="button" aria-label={`Move ${key} up`} disabled={index===0} onClick={()=>insert(index,index-1)}>↑</button><button type="button" aria-label={`Move ${key} down`} disabled={index===order.length-1} onClick={()=>insert(index,index+2)}>↓</button></div>}
    </div>
    {selectedEffect===key&&<section className="ss-fx-drawer" id={`ss-fx-drawer-${key}`} aria-label={`${label(key)} parameters`}>
     <p className="ss-muted">{patch.fx[key]?'':'Bypassed: edits are saved, but this effect is not heard until enabled. '}Parameter edits do not start playback.</p>
     <FxParameterEditor patch={patch} effect={key} onEdit={edit}/>
     <EffectPreview patch={patch} effect={key} active={patch.fx[key]} sampleRate={sampleRate}/>
     <button type="button" className="ss-fx-close" onClick={e=>{const opener=e.currentTarget.closest('.ss-module-card')?.querySelector<HTMLButtonElement>('.ss-fx-edit');setSelectedEffect(null);requestAnimationFrame(()=>opener?.focus());}}>Close parameters</button>
    </section>}
   </section>
   {ordered&&slotTarget(index+1,index===order.length-1?`Insert after ${label(key)}`:`Insert before ${label(order[index+1])}`)}
  </React.Fragment>)}</div>
  <p className="ss-fx-preview-note">Parameter-derived previews show the current settings, not measured PCM. Bypassed effects retain their settings; editing and opening drawers are silent.</p>
 </section>;
}
