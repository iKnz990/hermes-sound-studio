/** Lifecycle-owned: concatenate once in plugin-style, never inject from a component. */
export const STUDIO_VISUAL_CONTROLS_CSS = `
:is([data-sound-studio],.ss-focused-overlay) .ss-envelope-fill { fill:var(--ss-accent); fill-opacity:.15; stroke:none; pointer-events:none; }
:is([data-sound-studio],.ss-focused-overlay) .ss-plane-target { fill:var(--ss-panel); stroke:var(--ss-accent); stroke-width:3; cursor:crosshair; touch-action:none; vector-effect:non-scaling-stroke; }
:is([data-sound-studio],.ss-focused-overlay) .ss-plane-target:focus-visible { outline:none; stroke:var(--ss-ink); stroke-width:4; }
:is([data-sound-studio],.ss-focused-overlay) .ss-xy-pad { container-type:inline-size; display:grid; gap:10px; min-width:0; padding:12px; border:1px solid var(--ss-stroke); border-radius:8px; background:var(--ss-panel); }
:is([data-sound-studio],.ss-focused-overlay) .ss-xy-heading { display:flex; flex-wrap:wrap; gap:8px 16px; align-items:center; justify-content:space-between; }
:is([data-sound-studio],.ss-focused-overlay) .ss-xy-heading label { display:flex; align-items:center; gap:8px; }
:is([data-sound-studio],.ss-focused-overlay) .ss-xy-plane { display:block; width:100%; height:auto; min-height:145px; max-width:none; background:var(--ss-well); border:1px solid var(--ss-stroke); border-radius:7px; }
:is([data-sound-studio],.ss-focused-overlay) .ss-xy-plane text { fill:var(--ss-sub); font:12px var(--ss-font); pointer-events:none; }
:is([data-sound-studio],.ss-focused-overlay) .ss-xy-crosshair { stroke:var(--ss-accent); stroke-width:1; stroke-dasharray:3 4; opacity:.55; pointer-events:none; }
:is([data-sound-studio],.ss-focused-overlay) .ss-xy-scalars { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr)); gap:10px; }
:is([data-sound-studio],.ss-focused-overlay) .ss-interval-editor { display:grid; min-width:0; gap:12px; }
:is([data-sound-studio],.ss-focused-overlay) .ss-interval-chips { display:flex; flex-wrap:wrap; gap:6px; }
:is([data-sound-studio],.ss-focused-overlay) .ss-interval-chip { display:grid; gap:3px; text-align:left; min-height:40px; }
:is([data-sound-studio],.ss-focused-overlay) .ss-interval-chip small { color:var(--ss-sub); font-size:11px; }
:is([data-sound-studio],.ss-focused-overlay) .ss-interval-shortcuts { display:flex; flex-wrap:wrap; gap:4px; padding:8px; border:1px solid var(--ss-stroke); border-radius:7px; background:var(--ss-well); }
:is([data-sound-studio],.ss-focused-overlay) .ss-interval-shortcut { min-width:32px; min-height:32px; font-variant-numeric:tabular-nums; }
:is([data-sound-studio],.ss-focused-overlay) .ss-interval-shortcut[data-marked=true] { border-bottom:3px solid var(--ss-accent); }
:is([data-sound-studio],.ss-focused-overlay) :is(.ss-interval-chip,.ss-interval-shortcut)[aria-pressed=true] { border-color:var(--ss-accent); background:var(--ss-accent); color:var(--ss-on-accent,var(--ss-well)); }
:is([data-sound-studio],.ss-focused-overlay) .ss-interval-chip[aria-pressed=true] small { color:inherit; }
:is([data-sound-studio],.ss-focused-overlay) .ss-interval-actions { display:flex; flex-wrap:wrap; gap:8px; }
:is([data-sound-studio],.ss-focused-overlay) .ss-interval-error { border-left:3px solid var(--ss-accent); padding:8px; color:var(--ss-ink); }
:is([data-sound-studio],.ss-focused-overlay) .ss-fx-parameter-preview { display:grid; gap:8px; margin:10px 0; min-width:0; }
:is([data-sound-studio],.ss-focused-overlay) .ss-fx-parameter-preview .ss-parameter-response { display:block; width:100%; height:auto; min-height:100px; max-width:none; padding:0; background:var(--ss-well); border:1px solid var(--ss-stroke); border-radius:6px; }
:is([data-sound-studio],.ss-focused-overlay) .ss-fx-parameter-preview figcaption { display:grid; gap:4px; color:var(--ss-sub); font-size:12px; line-height:1.45; overflow-wrap:anywhere; }
:is([data-sound-studio],.ss-focused-overlay) .ss-fx-parameter-preview figcaption strong { color:var(--ss-ink); }
:is([data-sound-studio],.ss-focused-overlay) .ss-fx-parameter-preview .ss-env-guide { stroke:var(--ss-stroke); stroke-width:1; fill:none; }
`;
