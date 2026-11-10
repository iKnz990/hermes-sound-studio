import engineSource from '../assets/audio-engine.ts?raw';
import { type SonicPatch, type SonicVoice } from '../assets/audio-engine';
import { SOUND_EVENTS, validateSoundTheme, type SoundTheme } from '../assets/studio-engine';
import { safePatch } from './preferences';
import { compactPythonJson } from './export';

const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const FUNDAMENTAL_HZ=1000; // Shared anchor permits carrier frequencies through 16 kHz.
const APPROXIMATION_NOTICE='Lossy approximation: Sonic FM synthesis is not sonically equivalent to Studio precision PCM.';

/** Explicit alternate export only. Never used to apply a Studio theme to host event audio. */
export function describeSonicConversion(theme:SoundTheme):{patch:SonicPatch;warnings:string[]} {
  const valid=validateSoundTheme(theme);
  const warnings=new Set<string>([
    APPROXIMATION_NOTICE,
    'Oscillator 1 becomes the carrier; oscillator 2 becomes FM, not a second additive voice.',
    'ADSR becomes attack plus exponential decay (decay + release); sustain level and hold are omitted.',
    'The Studio output limiter, sample-rate setting and noise seed/timbre are not preserved.',
    'Master gain is folded into bounded event gain; the alternate runtime starts at volume 1.'
  ]);
  const events={} as Record<typeof SOUND_EVENTS[number],SonicVoice>;
  for(const event of SOUND_EVENTS) {
    const p=valid.events[event];
    const chord_intervals=p.chords.map(n=>Math.round(n));
    if(chord_intervals.some((n,i)=>n!==p.chords[i]))warnings.add(`${event}: fractional chord intervals are rounded to semitones.`);
    const requestedFrequency=p.baseFreq*2**(p.osc1.tune/12);
    // Small inward margins avoid floating-point violations of the legacy derived-frequency bounds.
    const minimum=Math.max(10,(20+1e-9)/2**(Math.min(...chord_intervals)/12));
    const maximum=Math.min(FUNDAMENTAL_HZ*16,(18000-1e-6)/2**(Math.max(...chord_intervals)/12));
    const frequency=clamp(requestedFrequency,minimum,maximum);
    if(frequency!==requestedFrequency)warnings.add(`${event}: carrier pitch is clamped to the legacy engine's playable range.`);
    const requestedGain=p.osc1.enabled
      ? .11*p.intensity/100*p.osc1.vol*10**(p.playback.gainDb/20)*valid.masterGain : 0;
    const gain=clamp(requestedGain,0,event==='onHover'?.04:.2);
    if(gain!==requestedGain)warnings.add(`${event}: event gain is capped${event==='onHover'?' at the 0.04 hover ceiling':''}.`);
    if(!p.osc1.enabled||p.osc1.vol===0)warnings.add(`${event}: oscillator 1 is off; this approximation is silent even if other Studio sources are active.`);
    if(p.osc3.enabled&&p.osc3.vol>0)warnings.add('Oscillator 3 is omitted.');
    if(Object.values(p.fx).some(Boolean))warnings.add('Studio EQ, compression, saturation, chorus, delay, reverb and their order are omitted.');
    if(p.filter.drive>0)warnings.add('Voice drive is omitted.');
    if([p.osc1,p.osc2,p.osc3].some(osc=>osc.detune||osc.pan||osc.spread))warnings.add('Oscillator fine detune, pan and unison spread are omitted.');
    if(p.lfo1.enabled||p.lfo2.enabled||p.modMatrix.some(row=>row.amount!==0))warnings.add('LFOs and the modulation matrix are omitted.');
    if(p.playback.stereo==='Stereo')warnings.add('Studio stereo placement is replaced by centered legacy voices.');
    if(p.filter.type==='notch')warnings.add(`${event}: notch filtering becomes low-pass filtering.`);
    events[event]={
      waveform:p.osc1.type,
      freq_ratio:frequency/FUNDAMENTAL_HZ,
      pitch_bend_ratio:1,
      mod_waveform:p.osc2.type,
      mod_freq_ratio:2**((p.osc2.tune-p.osc1.tune)/12),
      mod_index:p.osc2.enabled?p.osc2.vol*500:0,
      noise_mix:p.noise,
      filter_type:p.filter.type==='notch'?'lowpass':p.filter.type,
      cutoff_hz:p.filter.cutoff,
      q_factor:p.filter.res,
      attack_ms:p.adsr.a,
      decay_ms:Math.max(1,p.adsr.d+p.adsr.r),
      gain,
      pan:0,
      chord_intervals
    };
  }
  const patch:SonicPatch={
    palette_name:Array.from(`${valid.name} (approximate)`).slice(0,80).join(''),
    aesthetic_rationale:APPROXIMATION_NOTICE+' Additive oscillators, sustain, FX and modulation are reduced to the legacy FM voice model. Re-audition before use.',
    fundamental_hz:FUNDAMENTAL_HZ,
    css_accent_hex:'#d84b68',
    events
  };
  const checked=safePatch(patch);
  if(!checked)throw new Error('Approximation does not satisfy the legacy SonicPatch contract.');
  return {patch:checked,warnings:[...warnings]};
}

export function soundThemeToSonicPatch(theme:SoundTheme):SonicPatch {
  return describeSonicConversion(theme).patch;
}

/** Includes the actual canonical SonicEngine, not a claimed sub-2KB substitute. */
export function compileSonicApproximation(theme:SoundTheme):string {
  const result=describeSonicConversion(theme);
  return engineSource.replace(/\r\n?/g,'\n')+'\n\n'+
    '// APPROXIMATE FM EXPORT: this will sound different from the Studio audition and WAV.\n'+
    `export const SONIC_CONVERSION = ${compactPythonJson({version:'SoundTheme-to-SonicPatch/v1',mode:'lossy-approximation',warnings:result.warnings})} as const;\n`+
    `export const SONIC_PATCH = ${compactPythonJson(result.patch)} as const;\n`+
    'export const sonic = new SonicEngine(SONIC_PATCH, {enableCssVars: true, volume: 1});\n'+
    'sonic.setMuted(true);\n'+
    '// Call only from an explicitly labeled audio action. Hover/background events never enable audio.\n'+
    'export async function enableSonicPreview(): Promise<boolean> { const ready = await sonic.enable(); if (ready) sonic.setMuted(false); return ready; }\n'+
    'export const useSonicUI = () => sonic;\n';
}
