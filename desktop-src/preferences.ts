import { SONIC_EVENTS, type SonicPatch, type SonicVoice } from '../assets/audio-engine';

export const DEFAULT_VOLUME = .12;
export const PREFERENCES_KEY = 'preferences-v1';
export type Preferences = { preset: string; patch: SonicPatch; volume: number };
export type PreferenceStorage = { get<T>(key: string, fallback: T): T; set(key: string, value: unknown): void };
const waves = new Set(['sine','triangle','square','sawtooth']);
const filters = new Set(['lowpass','bandpass','highpass']);
const limits: Record<string, [number, number]> = {
  freq_ratio:[.01,16], pitch_bend_ratio:[.1,4], mod_freq_ratio:[.01,32], mod_index:[0,500],
  noise_mix:[0,1], cutoff_hz:[20,18000], q_factor:[.1,25], attack_ms:[0,3000],
  decay_ms:[1,3000], gain:[0,.2], pan:[-1,1]
};
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exactFields = (v: Record<string, unknown>, names: readonly string[]) =>
  Object.keys(v).length === names.length && names.every(name => Object.hasOwn(v, name));
const printable = (v: unknown, maximum: number): v is string => typeof v === 'string' &&
  [...v].length >= 1 && [...v].length <= maximum && !/[\u0000-\u001f]/.test(v);
const patchFields = ['palette_name','aesthetic_rationale','fundamental_hz','css_accent_hex','events'];
const voiceFields = ['waveform','mod_waveform','filter_type','chord_intervals',...Object.keys(limits)];
export function safePatch(value: unknown): SonicPatch | null {
  if (!record(value) || !exactFields(value,patchFields) || !record(value.events) ||
      !exactFields(value.events,SONIC_EVENTS) || !printable(value.palette_name,80) ||
      !printable(value.aesthetic_rationale,400) || typeof value.css_accent_hex !== 'string' ||
      value.css_accent_hex.length !== 7 || !/^#[0-9a-fA-F]{6}$/.test(value.css_accent_hex) ||
      typeof value.fundamental_hz !== 'number' || !Number.isFinite(value.fundamental_hz) ||
      value.fundamental_hz < 40 || value.fundamental_hz > 1000) return null;
  const voices: Record<string, SonicVoice> = {};
  for (const name of SONIC_EVENTS) {
    const v = value.events[name];
    if (!record(v) || !exactFields(v,voiceFields) || !waves.has(v.waveform as string) || !waves.has(v.mod_waveform as string) ||
        !filters.has(v.filter_type as string) || !Array.isArray(v.chord_intervals) ||
        v.chord_intervals.length < 1 || v.chord_intervals.length > 6 ||
        !v.chord_intervals.every(n => Number.isInteger(n) && n >= -24 && n <= 24) ||
        Object.entries(limits).some(([k,[min,max]]) => typeof v[k] !== 'number' ||
          !Number.isFinite(v[k]) || (v[k] as number) < min || (v[k] as number) > max) ||
        v.chord_intervals.some(n => {
          const hz=(value.fundamental_hz as number)*(v.freq_ratio as number)*2**(n/12);
          return hz<20 || hz>18000 || hz*(v.pitch_bend_ratio as number)<20 ||
            hz*(v.pitch_bend_ratio as number)>18000;
        })) return null;
    if (name === 'onHover' && (v.gain as number) > .04) return null;
    voices[name] = {...v, chord_intervals:[...v.chord_intervals]} as unknown as SonicVoice;
  }
  return {...value, events:voices} as unknown as SonicPatch;
}
export function loadPreferences(storage: PreferenceStorage | undefined, defaults: Preferences): Preferences {
  try {
    const data = storage?.get<unknown>(PREFERENCES_KEY, null);
    if (!record(data) || typeof data.preset !== 'string' ||
        !(data.preset === 'custom' || data.preset === defaults.preset ||
          data.preset === 'post_bop_chamber' || data.preset === 'brutalist_mono') ||
        typeof data.volume !== 'number' || !Number.isFinite(data.volume) ||
        data.volume < 0 || data.volume > 1) return defaults;
    const patch = safePatch(data.patch);
    return patch ? {preset:data.preset, patch, volume:data.volume} : defaults;
  } catch { return defaults; }
}
export function savePreferences(storage: PreferenceStorage | undefined, prefs: Preferences): void {
  try { storage?.set(PREFERENCES_KEY, prefs); } catch { /* preferences are optional */ }
}
