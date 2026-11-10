// Canonical, standalone WebAudio engine. No imports or external runtime dependencies.
export const SONIC_EVENTS = ['onHover', 'onFocus', 'onCommit', 'onToggle', 'onError', 'onBackgroundTaskComplete'] as const;
export type SonicEventName = typeof SONIC_EVENTS[number];
export interface SonicVoice {
  readonly waveform: OscillatorType;
  readonly freq_ratio: number;
  readonly pitch_bend_ratio: number;
  readonly mod_waveform: OscillatorType;
  readonly mod_freq_ratio: number;
  readonly mod_index: number;
  readonly noise_mix: number;
  readonly filter_type: BiquadFilterType;
  readonly cutoff_hz: number;
  readonly q_factor: number;
  readonly attack_ms: number;
  readonly decay_ms: number;
  readonly gain: number;
  readonly pan: number;
  readonly chord_intervals: readonly number[];
}
export interface SonicPatch {
  readonly palette_name: string;
  readonly aesthetic_rationale: string;
  readonly fundamental_hz: number;
  readonly css_accent_hex: string;
  readonly events: Readonly<Record<SonicEventName, SonicVoice>>;
}
export interface SonicSnapshot {
  readonly enabled: boolean;
  readonly muted: boolean;
  readonly volume: number;
  readonly energy: number;
  readonly lastEvent: SonicEventName | null;
  readonly activeVoices: number;
  readonly error: string | null;
}
const MAX_VOICES = 24;
const MAX_TRIGGERS_PER_SECOND = 28;
const BEAT_SECONDS = 60 / 126;
// One 3:2 cycle spans two quarter-note beats (120/126 s): six equal
// subdivisions, three accents at 0/2/4 and two at 0/3. No interval clocks.
const STEP_SECONDS = (2 * BEAT_SECONDS) / 6;
const VALID_WAVES = new Set(['sine', 'triangle', 'square', 'sawtooth']);
const VALID_FILTERS = new Set(['lowpass', 'bandpass', 'highpass']);
const clamp = (v: number, lo: number, hi: number) => Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
function validVoice(p: SonicPatch, v: SonicVoice): boolean {
  const numbers = [p.fundamental_hz, v.freq_ratio, v.pitch_bend_ratio, v.mod_freq_ratio, v.mod_index,
    v.noise_mix, v.cutoff_hz, v.q_factor, v.attack_ms, v.decay_ms, v.gain, v.pan];
  return numbers.every(Number.isFinite) && p.fundamental_hz >= 40 && p.fundamental_hz <= 1000 &&
    v.freq_ratio >= .01 && v.freq_ratio <= 16 && v.pitch_bend_ratio >= .1 && v.pitch_bend_ratio <= 4 &&
    v.mod_freq_ratio >= .01 && v.mod_freq_ratio <= 32 && v.mod_index >= 0 && v.mod_index <= 500 &&
    v.noise_mix >= 0 && v.noise_mix <= 1 && v.cutoff_hz >= 20 && v.cutoff_hz <= 18000 &&
    v.q_factor >= .1 && v.q_factor <= 25 && v.attack_ms >= 0 && v.attack_ms <= 3000 &&
    v.decay_ms >= 1 && v.decay_ms <= 3000 && v.gain >= 0 && v.gain <= .2 &&
    (v !== p.events.onHover || v.gain <= .04) && v.pan >= -1 && v.pan <= 1 &&
    VALID_WAVES.has(v.waveform) && VALID_WAVES.has(v.mod_waveform) &&
    VALID_FILTERS.has(v.filter_type) && Array.isArray(v.chord_intervals) &&
    v.chord_intervals.length >= 1 && v.chord_intervals.length <= 6 &&
    v.chord_intervals.every(n => Number.isInteger(n) && n >= -24 && n <= 24) &&
    v.chord_intervals.every(n => {
      const hz = p.fundamental_hz * v.freq_ratio * 2 ** (n / 12);
      return hz >= 20 && hz <= 18000 && hz * v.pitch_bend_ratio >= 20 && hz * v.pitch_bend_ratio <= 18000;
    });
}
type VoiceNodes = { sources: AudioScheduledSourceNode[]; nodes: AudioNode[]; end: number; start: number; attack: number; decay: number; peak: number; finished: boolean };
function seededNoise(ctx: AudioContext, key: string): AudioBuffer {
  let seed = 2166136261;
  for (let i = 0; i < key.length; i++) seed = Math.imul(seed ^ key.charCodeAt(i), 16777619) >>> 0;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .085), ctx.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < channel.length; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    channel[i] = ((seed >>> 0) / 2147483648 - 1) * Math.exp(-i / (ctx.sampleRate * .014));
  }
  return buffer;
}
export class SonicEngine {
  private patch: SonicPatch;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private voices = new Set<VoiceNodes>();
  private listeners = new Set<() => void>();
  private snapshot: SonicSnapshot;
  private disposed = false;
  private enablePending: Promise<boolean> | null = null;
  private pulseTimer: ReturnType<typeof setTimeout> | null = null;
  private frame: number | null = null;
  private lastEnergyPublication = -Infinity;
  private nextPulseStep = 0;
  private pulseOrigin = 0;
  private triggerTimes: number[] = [];
  private cssTarget?: HTMLElement;
  private readonly enableCssVars: boolean;
  private readonly reducedMotion: boolean;
  constructor(patch: SonicPatch, options: { enableCssVars?: boolean; cssTarget?: HTMLElement; volume?: number } = {}) {
    this.patch = patch;
    this.cssTarget = options.cssTarget ?? (options.enableCssVars && typeof document !== 'undefined' ? document.documentElement : undefined);
    this.enableCssVars = options.enableCssVars === true && !!this.cssTarget;
    this.reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.snapshot = Object.freeze({ enabled: false, muted: false, volume: clamp(options.volume ?? .12, 0, 1), energy: 0,
      lastEvent: null, activeVoices: 0, error: null });
  }
  getSnapshot = (): SonicSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    if (this.disposed) return () => {};
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private update(fields: Partial<SonicSnapshot>) {
    const next = { ...this.snapshot, ...fields };
    if ((Object.keys(fields) as (keyof SonicSnapshot)[]).every(k => this.snapshot[k] === next[k])) return;
    this.snapshot = Object.freeze(next);
    for (const fn of this.listeners) fn();
  }
  async enable(): Promise<boolean> {
    if (this.disposed) return false;
    if (this.ctx?.state === 'running') return true;
    if (this.enablePending) return this.enablePending;
    const pending = (async () => {
      try {
        // Only this explicit user-gesture method may create/resume the context.
        const ctor = globalThis.AudioContext;
        if (!ctor) throw new Error('WebAudio unavailable');
        const ctx = this.ctx ?? new ctor();
        this.ctx = ctx;
        if (ctx.state !== 'running') await ctx.resume();
        if (this.disposed) { await ctx.close(); return false; }
        if (ctx.state !== 'running') throw new Error('Audio context did not resume');
        if (!this.master) {
          const master = ctx.createGain(); master.connect(ctx.destination); this.master = master;
        }
        this.applyMaster();
        this.update({ enabled: true, error: null });
        return true;
      } catch (error) {
        this.update({ enabled: false, error: error instanceof Error ? error.message : 'Audio unavailable' });
        return false;
      }
    })();
    this.enablePending = pending;
    try { return await pending; }
    finally { if (this.enablePending === pending) this.enablePending = null; }
  }
  private applyMaster() {
    if (!this.master || !this.ctx) return;
    const param = this.master.gain;
    param.cancelScheduledValues(this.ctx.currentTime);
    param.setValueAtTime(this.snapshot.muted ? 0 : this.snapshot.volume, this.ctx.currentTime);
  }
  setMuted(muted: boolean) {
    if (this.disposed) return;
    this.update({ muted: !!muted, energy: 0 });
    this.applyMaster();
    if (muted) this.writeEnergy(0);
  }
  setVolume(volume: number) {
    if (this.disposed) return;
    this.update({ volume: clamp(volume, 0, 1) });
    this.applyMaster();
  }
  setPatch(patch: SonicPatch) {
    if (this.disposed) return;
    this.patch = patch;
    this.noise = null;
  }
  setCssTarget(target?: HTMLElement) {
    if (this.disposed || !this.enableCssVars || this.cssTarget === target) return;
    this.cssTarget?.style.removeProperty('--sonic-energy');
    this.cssTarget = target;
    if (target && !this.reducedMotion) this.writeEnergy(this.snapshot.energy);
  }
  private writeEnergy(energy: number) {
    if (this.enableCssVars && this.cssTarget) this.cssTarget.style.setProperty('--sonic-energy', String(energy));
  }
  private frameEnergy = () => {
    this.frame = null;
    if (!this.ctx || this.disposed || this.snapshot.muted || !this.voices.size) {
      this.update({ energy: 0 }); this.writeEnergy(0); return;
    }
    const now = this.ctx.currentTime;
    // Analytical envelope from the same AudioContext clock and gain ramps as the graph.
    // This is a normalized control envelope, not a measurement of output RMS/latency.
    const energy = clamp(Math.max(0, ...Array.from(this.voices, v => {
      const elapsed = now - v.start;
      if (elapsed < 0 || elapsed >= v.attack + v.decay) return 0;
      const gain = elapsed < v.attack
        ? .00001 + (v.peak - .00001) * elapsed / v.attack
        : v.peak * Math.pow(.00001 / v.peak, (elapsed - v.attack) / v.decay);
      return gain * this.snapshot.volume / .2;
    })), 0, 1);
    // Keep CSS at frame cadence; publish only coarse energy to React subscribers.
    if (energy === 0 || now - this.lastEnergyPublication >= .08) {
      this.lastEnergyPublication = now;
      this.update({ energy: energy === 0 ? 0 : Math.round(energy * 20) / 20 });
    }
    this.writeEnergy(energy);
    if (typeof requestAnimationFrame === 'function') this.frame = requestAnimationFrame(this.frameEnergy);
  };
  private release(v: VoiceNodes, stop: boolean) {
    if (v.finished) return;
    v.finished = true; this.voices.delete(v);
    for (const source of v.sources) {
      source.onended = null;
      if (stop) { try { source.stop(); } catch { /* already stopped */ } }
    }
    for (const node of v.nodes) { try { node.disconnect(); } catch { /* closing context */ } }
    this.update({ activeVoices: this.voices.size });
    if (!this.voices.size) { this.update({ energy: 0 }); this.writeEnergy(0); }
  }
  private schedule(event: SonicEventName, when: number, pulse = false): boolean {
    const ctx = this.ctx, cfg = this.patch.events[event];
    if (!ctx || ctx.state !== 'running' || this.snapshot.muted || !cfg || !validVoice(this.patch, cfg) || cfg.gain === 0) return false;
    const now = ctx.currentTime;
    this.triggerTimes = this.triggerTimes.filter(t => t > now - 1);
    if (this.triggerTimes.length >= MAX_TRIGGERS_PER_SECOND || this.voices.size + cfg.chord_intervals.length > MAX_VOICES) return false;
    this.triggerTimes.push(now);
    const at = Math.max(when, now), attack = Math.max(.001, cfg.attack_ms / 1000), decay = cfg.decay_ms / 1000;
    const volume = pulse ? .28 : 1;
    try {
      for (const [index, semi] of cfg.chord_intervals.entries()) {
        const t = at + index * (pulse ? 0 : .024);
        const stopAt = t + attack + decay + .028;
        const freq = this.patch.fundamental_hz * cfg.freq_ratio * 2 ** (semi / 12);
        const peak = Math.max(.00002, cfg.gain * volume / Math.sqrt(cfg.chord_intervals.length));
        const voice: VoiceNodes = { sources: [], nodes: [], end: stopAt, start: t, attack, decay, peak, finished: false };
        this.voices.add(voice);
        // Track each allocation immediately so a later factory failure cannot leak it.
        const node = <T extends AudioNode>(value: T): T => { voice.nodes.push(value); return value; };
        const sourceNode = <T extends AudioScheduledSourceNode>(value: T): T => { voice.sources.push(value); return node(value); };
        const osc = sourceNode(ctx.createOscillator()), mod = sourceNode(ctx.createOscillator()), modGain = node(ctx.createGain());
        const filter = node(ctx.createBiquadFilter()), pan = node(ctx.createStereoPanner()), env = node(ctx.createGain());
        osc.type = cfg.waveform; osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * cfg.pitch_bend_ratio), t + attack + decay * .8);
        mod.type = cfg.mod_waveform; mod.frequency.setValueAtTime(freq * cfg.mod_freq_ratio, t);
        modGain.gain.setValueAtTime(Math.max(.001, cfg.mod_index), t);
        modGain.gain.exponentialRampToValueAtTime(.001, t + attack + decay);
        mod.connect(modGain); modGain.connect(osc.frequency);
        filter.type = cfg.filter_type; filter.frequency.setValueAtTime(cfg.cutoff_hz, t); filter.Q.setValueAtTime(cfg.q_factor, t);
        pan.pan.setValueAtTime(cfg.pan, t);
        env.gain.setValueAtTime(.00001, t);
        env.gain.linearRampToValueAtTime(peak, t + attack);
        env.gain.exponentialRampToValueAtTime(.00001, t + attack + decay);
        osc.connect(filter); filter.connect(pan); pan.connect(env); env.connect(this.master!);
        if (index === 0 && cfg.noise_mix > 0) {
          this.noise ??= seededNoise(ctx, this.patch.palette_name);
          const source = sourceNode(ctx.createBufferSource()), noiseGain = node(ctx.createGain());
          source.buffer = this.noise;
          noiseGain.gain.setValueAtTime(Math.max(.00001, cfg.gain * cfg.noise_mix * volume), t);
          noiseGain.gain.exponentialRampToValueAtTime(.00001, t + Math.min(decay, .04));
          source.connect(noiseGain); noiseGain.connect(filter);
          source.start(t); source.stop(Math.min(stopAt, t + .084));
        }
        osc.onended = () => this.release(voice, false);
        osc.start(t); mod.start(t); osc.stop(stopAt); mod.stop(stopAt);
      }
      this.update({ activeVoices: this.voices.size, lastEvent: event });
      if (!this.reducedMotion && this.enableCssVars) {
        if (this.frame === null) this.frameEnergy();
      }
      return true;
    } catch (error) {
      this.stopAll();
      this.update({ error: error instanceof Error ? error.message : 'Audio scheduling failed' });
      return false;
    }
  }
  trigger(event: SonicEventName): boolean {
    if (this.disposed || !SONIC_EVENTS.includes(event)) return false;
    return this.schedule(event, this.ctx?.currentTime ?? 0);
  }
  onHover = () => this.trigger('onHover');
  onFocus = () => this.trigger('onFocus');
  onCommit = () => this.trigger('onCommit');
  onToggle = () => this.trigger('onToggle');
  onError = () => this.trigger('onError');
  onBackgroundTaskComplete = () => this.trigger('onBackgroundTaskComplete');
  // Evaluate the original JSX callback once at render time, retaining optionality
  // and its unbound invocation semantics instead of re-reading props on click.
  wrap<Args extends unknown[], R>(handler: ((...args: Args) => R) | null | undefined, event: SonicEventName): (...args: Args) => R | undefined {
    return (...args: Args) => { this.trigger(event); return handler?.(...args); };
  }
  startPulse(): void {
    if (this.disposed || this.pulseTimer || !this.ctx || this.ctx.state !== 'running' || this.snapshot.muted) return;
    this.pulseOrigin = this.ctx.currentTime + .03; this.nextPulseStep = 0;
    const tick = () => {
      this.pulseTimer = null;
      if (!this.ctx || this.disposed || this.ctx.state !== 'running' || this.snapshot.muted) return;
      const now = this.ctx.currentTime;
      // Skip missed steps; never unleash a backlog after tab suspension.
      while (this.pulseOrigin + this.nextPulseStep * STEP_SECONDS < now - .025) this.nextPulseStep++;
      while (this.pulseOrigin + this.nextPulseStep * STEP_SECONDS < now + .13) {
        const index = this.nextPulseStep % 6;
        const at = this.pulseOrigin + this.nextPulseStep * STEP_SECONDS;
        if (index === 0 || index === 2 || index === 4) this.schedule('onFocus', at, true);
        if (index === 0 || index === 3) this.schedule('onToggle', at, true);
        this.nextPulseStep++;
      }
      this.pulseTimer = setTimeout(tick, 32);
    };
    tick();
  }
  stopPulse(): void {
    if (this.pulseTimer !== null) clearTimeout(this.pulseTimer);
    this.pulseTimer = null;
    // A pulse owns queued events; stopAll also stops audition voices for safety.
    this.stopAll();
  }
  stopAll(): void {
    if (this.pulseTimer !== null) clearTimeout(this.pulseTimer);
    this.pulseTimer = null;
    if (this.frame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.frame);
    this.frame = null;
    for (const voice of [...this.voices]) this.release(voice, true);
    this.update({ energy: 0, activeVoices: 0 }); this.writeEnergy(0);
  }
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.stopPulse();
    if (this.enablePending) await this.enablePending;
    const ctx = this.ctx;
    this.ctx = null;
    if (this.master) { this.master.gain.setValueAtTime(0, ctx?.currentTime ?? 0); this.master.disconnect(); }
    this.master = null; this.noise = null;
    if (ctx && ctx.state !== 'closed') await ctx.close();
    if (this.enableCssVars && this.cssTarget) this.cssTarget.style.removeProperty('--sonic-energy');
    this.update({ enabled: false, energy: 0, activeVoices: 0 });
    this.listeners.clear();
  }
}
