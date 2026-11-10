/** Analysis, numeric controls and validation; inline compact allocation lives in the shell. */
export const ANALYSIS_CSS = `
[data-sound-studio] .ss-analysis-figure { margin:4px 0 0; min-width:0; }
[data-sound-studio] .ss-plot-frame { display:grid; grid-template-columns:minmax(74px,auto) minmax(0,1fr); gap:8px; align-items:stretch; }
[data-sound-studio] .ss-plot-frame .ss-plot { width:100%; min-width:0; margin:0; }
[data-sound-studio] .ss-plot-y { min-width:0; display:flex; flex-direction:column; justify-content:space-between; align-items:flex-end; text-align:right; font-variant-numeric:tabular-nums; font-size:10px; line-height:1.2; color:var(--ss-sub); padding:3px 0; }
[data-sound-studio] .ss-plot-y span:nth-child(2) { max-width:74px; overflow-wrap:anywhere; color:var(--ss-ink); font-weight:600; }
[data-sound-studio] .ss-plot-x { display:flex; justify-content:space-between; align-items:baseline; gap:4px; margin:4px 0 2px 82px; color:var(--ss-sub); font-size:10px; line-height:1.25; font-variant-numeric:tabular-nums; }
[data-sound-studio] .ss-plot-x span:nth-child(2) { color:var(--ss-ink); text-align:center; }
[data-sound-studio] .ss-plot-x span:last-child { text-align:right; }
[data-sound-studio] .ss-plot-caption { margin:5px 0 2px; color:var(--ss-sub); font-size:11px; line-height:1.45; }
[data-sound-studio] .ss-analysis-levels { display:flex; gap:5px 14px; flex-wrap:wrap; margin:5px 0 0; color:var(--ss-ink); font-variant-numeric:tabular-nums; }
[data-sound-studio] .ss-analysis-levels strong { font-weight:650; }

[data-sound-studio] .ss-scope .ss-analysis-figure { display:flex; flex-direction:column; flex:1 0 auto; min-height:150px; }
[data-sound-studio] .ss-scope .ss-plot-frame { flex:1 0 80px; min-height:80px; }
[data-sound-studio] .ss-scope .ss-plot-frame .ss-plot { height:100%; min-height:80px; }
[data-sound-studio] .ss-numeric-control { display:grid; grid-template-columns:minmax(0,1fr); gap:2px; align-items:center; }
[data-sound-studio] .ss-numeric-control .ss-control-head { grid-column:1; min-width:0; }
[data-sound-studio] .ss-numeric-amount { grid-column:1; grid-row:2; min-width:0; max-width:100%; text-align:right; align-self:center; color:var(--ss-ink); font:13px var(--ss-mono); font-variant-numeric:tabular-nums; }
[data-sound-studio] .ss-numeric-amount .ss-parameter-readout { white-space:normal; overflow-wrap:anywhere; }
[data-sound-studio] .ss-range-track { grid-column:1 / -1; position:relative; min-width:0; }
[data-sound-studio] .ss-numeric-control .ss-range-track input { display:block; margin:0; }
[data-sound-studio] .ss-numeric-control[data-bipolar="true"] .ss-range-track input { appearance:none; -webkit-appearance:none; border:0; border-radius:0; padding:0; background:transparent; height:26px; position:relative; }
[data-sound-studio] .ss-numeric-control[data-bipolar="true"] .ss-range-track::before { content:""; position:absolute; left:8px; right:8px; top:10px; height:6px; border-radius:3px; background:linear-gradient(to right,var(--ss-stroke) var(--ss-fill-start),var(--ss-accent) var(--ss-fill-start),var(--ss-accent) var(--ss-fill-end),var(--ss-stroke) var(--ss-fill-end)); pointer-events:none; }
[data-sound-studio] .ss-numeric-control[data-bipolar="true"] input::-webkit-slider-runnable-track { height:6px; border-radius:3px; background:transparent; }
[data-sound-studio] .ss-numeric-control[data-bipolar="true"] input::-moz-range-track { height:6px; border-radius:3px; background:transparent; }
[data-sound-studio] .ss-numeric-control[data-bipolar="true"] input::-webkit-slider-thumb { appearance:none; -webkit-appearance:none; height:16px; width:16px; border-radius:50%; margin-top:-5px; background:var(--ss-ink); border:2px solid var(--ss-well); box-shadow:0 0 0 1px var(--ss-stroke); }
[data-sound-studio] .ss-numeric-control[data-bipolar="true"] input::-moz-range-thumb { height:12px; width:12px; border-radius:50%; background:var(--ss-ink); border:2px solid var(--ss-well); }
[data-sound-studio] .ss-numeric-control input:focus-visible { outline:2px solid var(--ss-ink); outline-offset:2px; }
[data-sound-studio] .ss-numeric-control input:disabled { cursor:not-allowed; }
[data-sound-studio] .ss-zero-marker { position:absolute; left:calc(var(--ss-zero) + var(--ss-zero-inset)); top:6px; height:14px; border-left:2px solid var(--ss-ink); transform:translateX(-1px); pointer-events:none; }
[data-sound-studio] .ss-range-labels { grid-column:1 / -1; display:flex; justify-content:space-between; align-items:flex-start; position:relative; min-height:2.4em; color:var(--ss-sub); font:11px var(--ss-mono); }
[data-sound-studio] .ss-range-zero { position:absolute; top:1.2em; left:clamp(.5ch,var(--ss-zero),calc(100% - .5ch)); transform:translateX(-50%); }
@container studio-editor (max-width:500px) {
 [data-sound-studio] .ss-plot-frame { grid-template-columns:minmax(56px,auto) minmax(0,1fr); gap:4px; }
 [data-sound-studio] .ss-plot-y span:nth-child(2) { max-width:56px; }
 [data-sound-studio] .ss-plot-x { margin-left:60px; font-size:10px; }
 [data-sound-studio] .ss-transport [role="status"] { flex-basis:100%; margin-left:0; }
}
`;

/** Canvas and ephemeral audition clock; append to the lifecycle-owned sheet once. */
export const STUDIO_ANALYSIS_CSS=String.raw`
[data-sound-studio] .ss-canvas-spectrogram .ss-spectrogram-canvas{display:block;width:100%;height:112px;min-width:0;background:var(--ss-well);color:var(--ss-accent);image-rendering:pixelated}
[data-sound-studio] .ss-canvas-spectrogram .ss-spectrogram-canvas[hidden]{display:none}
[data-sound-studio] .ss-canvas-spectrogram .ss-plot-caption p{margin:4px 0}
[data-sound-studio] .ss-canvas-intensity-key{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
[data-sound-studio] .ss-canvas-intensity-key i{display:inline-block;width:42px;height:8px;background:linear-gradient(to right,var(--ss-well),var(--ss-accent));border:1px solid var(--ss-stroke)}
[data-sound-studio] .ss-playback-position{display:flex;flex-wrap:wrap;align-items:center;gap:5px 12px;font-size:11px;color:var(--ss-sub);padding:6px 0}
[data-sound-studio] .ss-playback-position output{font-variant-numeric:tabular-nums;color:var(--ss-ink)}
[data-sound-studio] .ss-playback-track{position:relative;flex-basis:100%;height:3px;background:var(--ss-well);overflow:hidden}
[data-sound-studio] .ss-playback-track span{position:absolute;top:0;bottom:0;left:0;width:2px;background:var(--ss-accent)}
[data-sound-studio] .ss-playback-position small{font-size:inherit}
`;

