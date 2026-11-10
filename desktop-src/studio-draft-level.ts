import {analyzePcm,renderSoundPatch,validateSoundPatch,type SoundPatch} from '../assets/studio-engine';

/** Measure actual canonical PCM at unity master, without opening an audible context. */
export async function measureDraftLevel(patch:SoundPatch,sampleRate:44100|48000|96000=48000) {
 const {peakDb,rmsDb}=analyzePcm(await renderSoundPatch(patch,{sampleRate,masterGain:1}));
 return {peakDb,rmsDb};
}

/** Explicit draft-only adjustment. Never normalize existing projects or exported PCM. */
export async function balanceDraftLevel(input:SoundPatch,sampleRate:44100|48000|96000=48000) {
 let patch=validateSoundPatch(input),measurement=await measureDraftLevel(patch,sampleRate);
 if(measurement.peakDb===null||measurement.peakDb < -90)throw Error('This draft is silent or nearly silent. Check enabled sources, intensity, envelope and filter before adjusting level.');
 const target=-18;
 for(let pass=0;pass<6;pass++){
  const difference=target-measurement.peakDb!;
  if(Math.abs(difference)<0.4)break;
  const gain=Math.max(-24,Math.min(6,patch.playback.gainDb+difference));
  if(Math.abs(gain-patch.playback.gainDb)>.05)patch={...patch,playback:{...patch.playback,gainDb:gain}};
  else if(difference>0){
   // Preserve the source mix, including noise, until a source reaches its limit.
   const largest=Math.max(patch.osc1.enabled?patch.osc1.vol:0,patch.osc2.enabled?patch.osc2.vol:0,patch.osc3.enabled?patch.osc3.vol:0,patch.noise);
   const factor=largest>0?Math.min(10**(difference/20),1/largest):1;
   if(factor>1.01){
    const scale=(osc:SoundPatch['osc1'])=>osc.enabled?{...osc,vol:Math.min(1,osc.vol*factor)}:osc;
    patch={...patch,osc1:scale(patch.osc1),osc2:scale(patch.osc2),osc3:scale(patch.osc3),noise:Math.min(1,patch.noise*factor)};
   }else if(patch.intensity>0&&patch.intensity<100)patch={...patch,intensity:Math.min(100,patch.intensity*10**(difference/20))};
   else break;
  }else break;
  patch=validateSoundPatch(patch);measurement=await measureDraftLevel(patch,sampleRate);
 }
 if(measurement.peakDb===null||measurement.peakDb < -24)throw Error('Gain limits could not bring this draft to a useful level. Check the envelope, filter and compressor. The draft was kept.');
 return {patch,...measurement};
}
