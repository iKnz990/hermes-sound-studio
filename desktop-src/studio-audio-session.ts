import {SoundStudioEngine} from '../assets/studio-engine';
import {ComposeAudio} from './compose-audio';
import type {StudioStore} from './studio-store';

/** Plugin-owned audio readiness. View navigation stops playback, never revokes consent. */
export function createStudioAudioSession(store:StudioStore) {
 const studio=new SoundStudioEngine(store.state.theme),compose=new ComposeAudio();
 const unsubscribe=store.subscribe(()=>studio.setTheme(store.state.theme));
 return {
  studio,compose,
  stop(){studio.stopAll();compose.stop();},
  dispose(){unsubscribe();return Promise.allSettled([studio.dispose(),compose.dispose()]);},
 };
}
export type StudioAudioSession=ReturnType<typeof createStudioAudioSession>;
