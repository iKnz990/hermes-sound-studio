/** Routing components: single-pass geometry and readable labels for inline and portaled tools. */
export const ROUTING_CSS = `
:is([data-sound-studio],.ss-focused-overlay) .ss-route-svg { width:auto; min-width:0; height:auto; background:transparent; color:var(--ss-accent); border:0; border-radius:6px; max-width:none; margin:0; }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-audio { stroke:var(--ss-sub); stroke-width:1.4; }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-mod { stroke:var(--ss-accent); stroke-width:1.5; stroke-dasharray:4 3; }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-node rect { fill:var(--ss-panel); stroke:var(--ss-stroke); }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-node text { fill:var(--ss-ink); font:12px var(--ss-font); }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-modulation rect { stroke:var(--ss-accent); }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-legend { display:flex; gap:6px 18px; color:var(--ss-sub); font-size:12px; flex-wrap:wrap; margin:2px 0; }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-edges { max-height:none; overflow:auto; font-size:11px; min-height:0; margin:0; padding:0 8px 8px; list-style:none; }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-edges span { text-transform:uppercase; font-size:9px; color:var(--ss-accent); }
:is([data-sound-studio],.ss-focused-overlay) .ss-canvas-viewport:focus-visible { outline:2px solid var(--ss-accent); outline-offset:2px; }
:is([data-sound-studio],.ss-focused-overlay) .ss-canvas-controls { display:flex; flex-wrap:wrap; gap:5px; align-items:center; padding:8px 0; }
:is([data-sound-studio],.ss-focused-overlay) .ss-canvas-viewport { width:100%; min-width:0; height:clamp(285px,44vh,500px); overflow:auto; scrollbar-color:var(--ss-stroke) transparent; flex:0 0 auto; background:var(--ss-well); border:1px solid var(--ss-stroke); border-radius:8px; }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-port { fill:var(--ss-accent); }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-selection { height:44px; min-height:44px; flex-shrink:0; overflow:auto; font-size:13px; color:var(--ss-ink); padding:5px 8px; margin:0; border-left:3px solid var(--ss-accent); background:var(--ss-well); overflow-wrap:anywhere; }
:is([data-sound-studio],.ss-focused-overlay) .ss-routing { display:flex; flex-direction:column; min-width:0; gap:7px; }
:is([data-sound-studio],.ss-focused-overlay) .ss-routing > .ss-muted { margin:0; }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-node[data-selected=true] rect { stroke:var(--ss-accent); stroke-width:3; filter:drop-shadow(0 0 4px var(--ss-accent)); }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-node .ss-route-caption { fill:var(--ss-ink); font-family:var(--ss-font); font-weight:600; }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-node .ss-route-index { fill:var(--ss-sub); font-family:var(--ss-font); font-weight:400; }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-edge-audio[data-selected=true] .ss-route-audio { stroke:var(--ss-ink)!important; stroke-width:3.5!important; filter:drop-shadow(0 0 3px var(--ss-ink)); }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-edge-modulation[data-selected=true] .ss-route-mod { stroke:var(--ss-accent)!important; stroke-width:3.5!important; filter:drop-shadow(0 0 3px var(--ss-accent)); }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-marker-audio path { fill:var(--ss-sub); }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-marker-modulation path { fill:var(--ss-accent); }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-details { min-width:0; max-height:205px; display:flex; flex-direction:column; overflow:hidden; border:1px solid var(--ss-stroke); border-radius:8px; background:var(--ss-panel); }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-details-head { display:flex; gap:10px; justify-content:space-between; padding:8px 10px 4px; font-size:12px; }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-details-head span { color:var(--ss-sub); font-size:11px; }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-detail-current { margin:0; padding:3px 10px 7px; overflow-wrap:anywhere; color:var(--ss-ink); font-size:11px; }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-edges li { margin:0; }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-edges button { width:100%; text-align:left; overflow-wrap:anywhere; }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-edges li button[data-related=true] { border-left:3px solid var(--ss-accent); color:var(--ss-ink); }
:is([data-sound-studio],.ss-focused-overlay) .ss-fx-conversion { border:1px solid var(--ss-stroke); border-radius:7px; padding:9px; background:var(--ss-well); }
:is([data-sound-studio],.ss-focused-overlay) .ss-fx-receipt { border:1px solid var(--ss-stroke); border-radius:7px; padding:9px; background:var(--ss-well); }
:is([data-sound-studio],.ss-focused-overlay) .ss-fx-conversion [role=group] { margin-top:8px; }
:is([data-sound-studio],.ss-focused-overlay) .ss-fx-conversion [role=group] p { margin:0 0 8px; line-height:1.45; }
:is([data-sound-studio],.ss-focused-overlay) .ss-fx-conversion [role=group] button { margin-right:8px; }
:is([data-sound-studio],.ss-focused-overlay) .ss-routing[data-selection=true] .ss-route-pick:not([data-selected=true]) > path:first-child { opacity:.25; }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-open { display:flex; flex-wrap:nowrap; align-items:center; gap:8px; height:40px; min-height:40px; flex-shrink:0; overflow:auto; white-space:nowrap; font-size:12px; color:var(--ss-sub); }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-open > * { flex-shrink:0; }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-node:focus-visible rect { stroke:var(--ss-ink); stroke-width:3; }
:is([data-sound-studio],.ss-focused-overlay) .ss-route-band { fill:var(--ss-sub); font:12px system-ui,sans-serif; }
`;

