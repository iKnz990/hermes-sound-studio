import React from 'react';
import type {PcmAnalysis} from './studio-components';
import {mapSpectrogram,paintSpectrogram} from './studio-spectrogram-model';
const hz=(v:number)=>v>=1000?`${Number((v/1000).toFixed(2))} kHz`:`${Number(v.toFixed(1))} Hz`;
/** One canvas, populated only from canonical PCM analysis. No synthesized or decorative noise. */
export function CanvasSpectrogram({analysis,label,frequencyMax,detailDisclosure=false}:{analysis:PcmAnalysis;label:string;frequencyMax?:number;detailDisclosure?:boolean}) {
 const map=React.useMemo(()=>mapSpectrogram(analysis,frequencyMax),[analysis,frequencyMax]);
 const ref=React.useRef<HTMLCanvasElement>(null),captionId=React.useId();
 const [unavailable,setUnavailable]=React.useState(false);
 React.useEffect(()=>{
  const canvas=ref.current;if(!canvas)return;
  let ctx:CanvasRenderingContext2D|null=null;
  try{ctx=canvas.getContext('2d');}catch{/* Platform blocks canvas. */}
  if(!ctx){setUnavailable(true);return;}setUnavailable(false);
  let frame:number|null=null,disposed=false;
  const paint=()=>{
   frame=null;if(disposed||!ctx)return;
   const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
   const width=Math.max(1,Math.round(rect.width*dpr)),height=Math.max(1,Math.round(rect.height*dpr));
   if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
   const style=getComputedStyle(canvas);
   // Native color parsing handles host tokens in rgb, color-mix, oklch, etc.
   const rgb=(color:string)=>{ctx!.fillStyle=color;ctx!.fillRect(0,0,1,1);return Array.from(ctx!.getImageData(0,0,1,1).data).slice(0,3);};
   const low=rgb(style.backgroundColor),high=rgb(style.color);
   ctx.fillStyle=style.backgroundColor;ctx.fillRect(0,0,width,height);
   paintSpectrogram(ctx,map,width,height,{low,high});
  };
  const queue=()=>{if(!disposed&&frame===null)frame=requestAnimationFrame(paint);};
  const resize=typeof ResizeObserver==='function'?new ResizeObserver(queue):null;resize?.observe(canvas);
  const theme=new MutationObserver(queue);
  for(let parent=canvas.parentElement;parent;parent=parent.parentElement)theme.observe(parent,{attributes:true,attributeFilter:['class','style','data-theme','data-color-mode']});
  const scheme=window.matchMedia('(prefers-color-scheme: dark)');scheme.addEventListener('change',queue);
  let resolution=window.matchMedia(`(resolution: ${window.devicePixelRatio||1}dppx)`);
  const dprChanged=()=>{resolution.removeEventListener('change',dprChanged);resolution=window.matchMedia(`(resolution: ${window.devicePixelRatio||1}dppx)`);resolution.addEventListener('change',dprChanged);queue();};
  resolution.addEventListener('change',dprChanged);window.addEventListener('resize',queue);queue();
  return()=>{disposed=true;if(frame!==null)cancelAnimationFrame(frame);resize?.disconnect();theme.disconnect();scheme.removeEventListener('change',queue);resolution.removeEventListener('change',dprChanged);window.removeEventListener('resize',queue);};
 },[map]);
 if(!map.visibleBins||!map.intensities.length)return <div className="ss-plot ss-empty">No spectral data in this render.</div>;
 const details=<>256-sample Hann-windowed DFT of mono-averaged PCM. Sampled frequencies through {hz(map.highestHz)}; bin spacing {hz(map.binSpacing)}. Only existing samples are cropped; no new resolution or zero-padded bins. Time labels are window starts, not buffer-end times. {map.max===0?'No energy in sampled bins; all cells have zero intensity.':'Intensity is relative to the strongest cell in the full, uncropped matrix.'} Not calibrated dBFS. Absolute channel Peak / RMS levels are separate; mono cancellation can leave zero spectral energy with nonzero channel levels.</>;
 return <figure className="ss-analysis-figure ss-canvas-spectrogram" aria-label={`${label} from rendered PCM`}>
  <div className="ss-plot-frame"><div className="ss-plot-y"><span>{hz(map.highestHz)}</span><span>Frequency (Hz)</span><span>0 Hz</span></div>
   <canvas ref={ref} className="ss-plot ss-spectrogram-canvas" role="img" aria-label={`${label}: sampled time and frequency; relative intensity`} aria-describedby={captionId} hidden={unavailable}>Canvas unavailable. Read the analysis summary below.</canvas>
   {unavailable&&<div className="ss-plot ss-empty" role="status">Canvas unavailable. Spectral summary remains below; no image is being displayed.</div>}
  </div>
  <div className="ss-plot-x"><span>0 s</span><span>Time (s) · Window starts</span><span>{(map.frameStarts.at(-1)??0).toFixed(3)} s</span></div>
  <figcaption id={captionId} className="ss-plot-caption"><p>{map.max===0?'No energy in sampled bins. ':'Colors show relative strength. '}Relative intensity, not a loudness meter or dBFS. <span className="ss-canvas-intensity-key"><i aria-hidden="true"/>0% → 100%</span></p>
   {detailDisclosure?<details className="ss-plot-details"><summary>Details</summary>{details}</details>:details}
  </figcaption>
 </figure>;
}
