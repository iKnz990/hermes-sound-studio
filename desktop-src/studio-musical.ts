/** Equal-tempered display helpers. Pitch edits remain in the existing Hz/semitone schema. */
const NAMES=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'] as const;
export const midiFrequency=(midi:number)=>440*2**((midi-69)/12);
export function parsePitchName(text:string):number {
 const match=/^\s*([A-Ga-g])([#♯b♭]?)(-?\d)\s*$/.exec(text);
 if(!match)return Number(text);
 const pitch=({C:0,D:2,E:4,F:5,G:7,A:9,B:11} as Record<string,number>)[match[1].toUpperCase()];
 return (Number(match[3])+1)*12+pitch+(/[#♯]/.test(match[2])?1:/[b♭]/.test(match[2])?-1:0);
}
export function nearestNote(frequency:number){
 const exact=69+12*Math.log2(frequency/440),midi=Math.round(exact);
 return {midi,name:`${NAMES[((midi%12)+12)%12]}${Math.floor(midi/12)-1}`,cents:Number(((exact-midi)*100).toFixed(1)),frequency};
}
export const chordNotes=(root:number,intervals:readonly number[])=>intervals.map(semi=>({...nearestNote(root*2**(semi/12)),semi}));
export const ROOT_NOTES=Array.from({length:128},(_,i)=>nearestNote(midiFrequency(i))).filter(n=>n.frequency>=40&&n.frequency<=4000);
/** Null is actual zero / -infinity, not a finite dB floor. */
export const gainToDb=(gain:number):number|null=>gain===0?null:20*Math.log10(gain);
export const dbToGain=(db:number|null)=>db===null?0:10**(db/20);
