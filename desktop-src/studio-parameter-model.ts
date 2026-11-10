/** Shared numeric semantics. Rendering never normalizes an imported value. */
export type ParameterRange = {min:number;max:number;step:number};
export function decimalPrecision(value:number):number {
  if(!Number.isFinite(value))return 0;
  const [mantissa,exponent='0']=String(value).toLowerCase().split('e');
  return Math.min(100,Math.max(0,(mantissa.split('.')[1]?.length??0)-Number(exponent)));
}
export function validParameterRange({min,max,step}:ParameterRange):boolean {
  return Number.isFinite(min)&&Number.isFinite(max)&&Number.isFinite(max-min)&&max>=min&&Number.isFinite(step)&&step>0;
}
export function parameterPosition(value:number,{min,max}:ParameterRange):number {
  return max>min&&Number.isFinite(value)&&Number.isFinite(max-min)?Math.max(0,Math.min(1,(value-min)/(max-min))):0;
}
export function snapParameter(value:number,range:ParameterRange):number {
  const {min,max,step}=range;
  if(!validParameterRange(range)||!Number.isFinite(value))return min;
  const precision=Math.max(decimalPrecision(step),decimalPrecision(min));
  const round=(v:number)=>Number(v.toFixed(precision));
  const last=Math.max(0,Math.floor((max-min)/step+Number.EPSILON*8*Math.max(1,Math.abs((max-min)/step))));
  const index=Math.max(0,Math.min(last,Math.round((value-min)/step)));
  return Math.max(min,Math.min(max,round(min+index*step)));
}
export function parameterDraftError(draft:string,range:ParameterRange):string {
  const {min,max,step}=range;
  if(!validParameterRange(range))return 'This parameter range is unavailable.';
  const text=draft.trim();
  // Accept decimal/exponent notation, not JS-only hex, Infinity or an empty draft.
  if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)||!Number.isFinite(Number(text)))return `Enter a number from ${min} to ${max}.`;
  const n=Number(text);
  if(n<min||n>max)return `Enter a value from ${min} to ${max}.`;
  const nearest=snapParameter(n,range);
  const tolerance=Math.min(step*1e-7,Number.EPSILON*8*Math.max(Math.abs(n),Math.abs(min),step));
  return Math.abs(n-nearest)>tolerance?`Use increments of ${step} from ${min}.`:'';
}
export function formatParameter(value:number,range:ParameterRange,unit=''):string {
  const bipolar=range.min<0&&range.max>0;
  if(!Number.isFinite(value))return '—';
  const sign=value<0?'−':bipolar&&value>0?'+':'';
  if(unit.trim()==='Hz'&&Math.abs(value)>=1000)return `${sign}${Number((Math.abs(value)/1000).toFixed(2))} kHz`;
  if(unit.trim()==='s'&&value!==0&&Math.abs(value)<.01)return `${sign}${Number((Math.abs(value)*1000).toFixed(2))} ms`;
  if(value!==0&&Math.abs(value)<.001)return `${sign}${Math.abs(value).toExponential(1)}${unit}`;
  return `${sign}${Number(Math.abs(value).toFixed(2))}${unit}`;
}
export function parameterAngle(value:number,range:ParameterRange):number {return -135+270*parameterPosition(value,range);}
/** Axis annotations are approximate; the editable readout/imported value stay exact. */
export function formatParameterScale(value:number,range:ParameterRange):string {return formatParameter(Number(value.toPrecision(3)),range);}
/** Angles measured clockwise from twelve o'clock; supports either bipolar direction. */
export function parameterArc(start:number,end:number):string {
  const point=(angle:number)=>{const rad=angle*Math.PI/180;return `${24+19*Math.sin(rad)} ${24-19*Math.cos(rad)}`;};
  return `M ${point(start)} A 19 19 0 ${Math.abs(end-start)>180?1:0} ${end>=start?1:0} ${point(end)}`;
}
