import {validateSoundPatch,type SoundPatch} from '../assets/studio-engine';
import {setDuration} from './studio-data';
import {type ComposeNote} from './compose-model';

/** The note body is musical; FX are rendered AFTER synthesis at the note's actual pitch. */
export function adaptComposeNote(patch:SoundPatch,note:ComposeNote,tempo:number){
 if(!Number.isFinite(tempo)||tempo<60||tempo>200||!Number.isFinite(note.duration)||note.duration<.25||note.duration>4||!Number.isInteger(note.pitch)||note.pitch<28||note.pitch>84||!Number.isFinite(note.velocity)||note.velocity<.1||note.velocity>1)throw new RangeError('Compose note or tempo out of range.');
 const rawSeconds=note.duration*60/tempo,seconds=Math.min(2.5,Math.max(.02,rawSeconds));
 const scaled=setDuration(validateSoundPatch(patch),seconds);
 const next=validateSoundPatch({...scaled,baseFreq:440*2**((note.pitch-69)/12),intensity:scaled.intensity*note.velocity});
 return {patch:next,rawSeconds,clamped:rawSeconds>2.5||rawSeconds<.02};
}

export {ComposeAudio,type ComposeAudioSnapshot} from './compose-live-transport';

