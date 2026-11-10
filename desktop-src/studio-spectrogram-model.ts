import type {PcmAnalysis} from './studio-components';
export type SpectrogramMap = {intensities:number[][];frameStarts:number[];binSpacing:number;highestHz:number;visibleBins:number;max:number};
/** Crop samples, never interpolate frequencies or renormalize a crop. DFT values are not dBFS. */
export function mapSpectrogram(analysis:PcmAnalysis,frequencyMax?:number):SpectrogramMap {
 const columns=analysis.spectrogram,originalBins=columns[0]?.length??0;
 const rate=Number.isFinite(analysis.sampleRate)&&analysis.sampleRate>0?analysis.sampleRate:0;
 const binSpacing=originalBins&&rate?rate/(2*originalBins):0;
 const limit=frequencyMax!==undefined&&Number.isFinite(frequencyMax)&&frequencyMax>=0?frequencyMax:Infinity;
 const visibleBins=binSpacing?Math.min(originalBins,Math.floor(limit/binSpacing)+1):0;
 let max=0;for(const column of columns)for(const value of column)if(Number.isFinite(value))max=Math.max(max,value);
 const length=Math.max(0,Math.round((Number.isFinite(analysis.duration)?analysis.duration:0)*rate));
 const frameStarts=columns.map((_,frame)=>rate?Math.floor(frame*Math.max(0,length-256)/Math.max(1,columns.length-1))/rate:0);
 return {max,binSpacing,visibleBins,highestHz:Math.max(0,visibleBins-1)*binSpacing,frameStarts,
  intensities:columns.map(column=>Array.from({length:visibleBins},(_,bin)=>max&&Number.isFinite(column[bin])?Math.max(0,Math.min(1,column[bin]/max)):0))};
}
export type SpectrogramPalette={low:readonly number[];high:readonly number[]};
/** Integer backing-pixel rectangles avoid gaps; high sampled frequencies are at the top. */
export function paintSpectrogram(ctx:Pick<CanvasRenderingContext2D,'fillStyle'|'fillRect'>,map:SpectrogramMap,width:number,height:number,palette:SpectrogramPalette):void {
 const count=map.intensities.length;
 for(let frame=0;frame<count;frame++)for(let bin=0;bin<map.visibleBins;bin++){
  const t=map.intensities[frame][bin],rgb=palette.low.map((low,i)=>Math.round(low+(palette.high[i]-low)*t));
  ctx.fillStyle=`rgb(${rgb.join(',')})`;
  const x=Math.floor(frame*width/count),x2=Math.floor((frame+1)*width/count);
  const y=Math.floor((map.visibleBins-1-bin)*height/map.visibleBins),y2=Math.floor((map.visibleBins-bin)*height/map.visibleBins);
  ctx.fillRect(x,y,x2-x,y2-y);
 }
}
