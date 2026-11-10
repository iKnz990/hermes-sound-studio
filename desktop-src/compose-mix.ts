/** One output topology for live playback and offline composition export. */
export const COMPOSE_OUTPUT=Object.freeze({gain:.22,threshold:-5,knee:0,ratio:20,attack:.003,release:.1});
/** Reserve 20ms after the last PCM sample for the output compressor's lookahead.
 * This is padding, not a measured audible tail or a cross-browser latency promise. */
export const COMPOSE_OUTPUT_PADDING_SECONDS=.02;

export function createComposeOutput(ctx:Pick<BaseAudioContext,'createGain'|'createDynamicsCompressor'|'destination'>):GainNode {
 const bus=ctx.createGain();bus.gain.value=COMPOSE_OUTPUT.gain;
 const limiter=ctx.createDynamicsCompressor();
 limiter.threshold.value=COMPOSE_OUTPUT.threshold;limiter.knee.value=COMPOSE_OUTPUT.knee;limiter.ratio.value=COMPOSE_OUTPUT.ratio;
 limiter.attack.value=COMPOSE_OUTPUT.attack;limiter.release.value=COMPOSE_OUTPUT.release;
 bus.connect(limiter);limiter.connect(ctx.destination);return bus;
}
