import {SOUND_EVENTS,validateSoundPatch,validateSoundTheme,type SoundTheme,type SoundPatch,type SoundEvent} from '../assets/studio-engine';
import {STUDIO_PALETTES} from './studio-data';
import {createRepository,type StudioStorage} from './studio-repository';
export function createStudioStore(storage?:StudioStorage){return createRepository<SoundTheme,SoundPatch,SoundEvent>(storage,STUDIO_PALETTES[0],validateSoundTheme,validateSoundPatch,SOUND_EVENTS);}
export type StudioStore=ReturnType<typeof createStudioStore>;
