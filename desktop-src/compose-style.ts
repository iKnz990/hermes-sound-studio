/** Composition working surfaces; shell navigation lives in plugin-style. */
export const COMPOSE_CSS = `

/* Compose shares chrome and tokens; only its task body owns page scrolling. */
[data-compose] { height:auto; min-height:100%; max-height:none; overflow:visible; display:flex; flex-direction:column; }
[data-compose] > .ss-shell { flex:1; min-width:0; min-height:0; display:flex; flex-direction:column; gap:12px; padding:12px; }
[data-compose] .cp-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
[data-compose] .cp-library { display:flex; gap:8px; align-items:end; flex-wrap:wrap; }
[data-compose] .cp-library label { display:grid; gap:4px; flex:1; min-width:160px; }
[data-compose] .cp-session-context { position:sticky; top:0; z-index:6; display:grid; gap:6px; padding:8px 10px; border:1px solid var(--ss-stroke); border-radius:9px; background:var(--ss-base); box-shadow:0 4px 12px var(--ss-shadow-soft); min-width:0; }
[data-compose] .cp-transport { display:flex; align-items:center; justify-content:space-between; gap:6px; flex-wrap:wrap; }
[data-compose] .cp-transport .cp-actions { gap:6px; }
[data-compose] .cp-transport button { min-height:30px; padding:4px 8px; }
[data-compose] .cp-transport strong { font-size:12px; }
[data-compose] .cp-transport [role=status] { font-size:12px; }
[data-compose] .cp-selected-context { display:flex; gap:8px; align-items:center; min-width:0; flex-wrap:wrap; border-top:1px solid var(--ss-stroke); padding-top:6px; font-size:12px; }
[data-compose] .cp-selected-context strong { overflow-wrap:anywhere; }
[data-compose] .cp-selected-context>span { color:var(--ss-sub); overflow-wrap:anywhere; min-width:0; flex:1; }
[data-compose] .cp-selected-context button { min-height:28px; padding:3px 8px; }
[data-compose] .cp-controls { display:grid; grid-template-columns:repeat(4,minmax(110px,1fr)); gap:8px; }
[data-compose] .cp-arrangement { max-height:360px; overflow:auto; overscroll-behavior:contain; border:2px solid var(--ss-sub); border-radius:10px; background:var(--ss-well); scrollbar-gutter:stable; scrollbar-color:var(--ss-sub) var(--ss-well); scrollbar-width:auto; }
[data-compose] .cp-ruler { display:grid; grid-template-columns:220px minmax(0,1fr); border-bottom:1px solid var(--ss-stroke); position:sticky; top:0; z-index:4; font:11px var(--ss-mono); color:var(--ss-sub); background:var(--ss-base); }
[data-compose] .cp-lane { display:grid; grid-template-columns:220px minmax(0,1fr); border-bottom:1px solid var(--ss-stroke); }
[data-compose] .cp-ruler>span { display:flex; align-items:center; padding:10px; position:sticky; left:0; background:var(--ss-base); z-index:2; }
[data-compose] .cp-arrangement-scale { display:grid; position:relative; }
[data-compose] .cp-arrangement-scale>span { padding:5px 6px; border-left:1px solid var(--ss-stroke); }
[data-compose] .cp-arrangement-scale .cp-arrangement-bar { border-left:2px solid var(--ss-sub); color:var(--ss-ink); font-weight:bold; display:flex; align-items:center; justify-content:space-between; gap:4px; min-width:0; }
[data-compose] .cp-loop-label { font:10px var(--ss-mono); white-space:nowrap; color:var(--ss-accent); }
[data-compose] .cp-arrangement-beat[data-bar=true] { border-left:2px solid var(--ss-sub); }
[data-compose] .cp-track { position:sticky; left:0; z-index:2; padding:10px; display:grid; gap:6px; border-right:1px solid var(--ss-stroke); background:var(--ss-base); min-width:0; }
[data-compose] .cp-track[data-selected=true] { border-left:3px solid var(--ss-accent); }
[data-compose] .cp-track-select { text-align:left; display:grid; gap:3px; min-width:0; overflow-wrap:anywhere; }
[data-compose] .cp-track-select small { color:var(--ss-sub); font-size:11px; }
[data-compose] .cp-track-controls { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
[data-compose] .cp-track-controls label { flex:1; min-width:0; }
[data-compose] .cp-track-controls output { font:11px var(--ss-mono); }
[data-compose] .cp-clips { position:relative; min-height:132px; overflow:hidden; background:repeating-linear-gradient(90deg,transparent 0,transparent calc(var(--cp-bar-width) - 2px),var(--ss-sub) calc(var(--cp-bar-width) - 2px),var(--ss-sub) var(--cp-bar-width)),repeating-linear-gradient(90deg,transparent 0,transparent calc(var(--cp-beat-width) - 1px),var(--ss-stroke) calc(var(--cp-beat-width) - 1px),var(--ss-stroke) var(--cp-beat-width)); }
[data-compose] .cp-clips>small { position:absolute; bottom:4px; left:8px; color:var(--ss-sub); font-size:10px; }
[data-compose] .cp-loop-boundary { position:absolute; right:0; top:0; bottom:0; border-right:2px solid var(--ss-accent); pointer-events:none; }
[data-compose] .cp-note { position:absolute; height:24px; padding:0; border:0; min-height:0; background:transparent; border-radius:3px; display:flex; overflow:visible; text-align:left; font:10px var(--ss-mono); }
[data-compose] .cp-note [data-compose-body] { display:block; flex:none; height:100%; background:color-mix(in srgb,var(--cp-layer-color,var(--ss-accent)) 35%,var(--ss-well)); border:1px solid var(--ss-ink); border-radius:3px; color:var(--ss-ink); overflow:hidden; padding:3px; }
[data-compose] .cp-note [data-compose-tail] { height:100%; display:block; border:1px dashed var(--ss-accent); background:color-mix(in srgb,var(--ss-accent) 15%,transparent); }
[data-compose] .cp-note [data-compose-tail][hidden] { display:none; }
[data-compose] .cp-note[aria-pressed=true] { outline:2px solid var(--ss-ink); outline-offset:2px; }
[data-compose] .cp-playhead { position:absolute; top:0; bottom:0; width:2px; background:var(--ss-ink); pointer-events:none; z-index:1; }
[data-compose] .cp-tail-toggle { display:flex; align-items:center; gap:6px; margin-left:auto; }
[data-compose] .cp-tail-toggle input { width:auto; accent-color:var(--ss-accent); }
[data-compose] .cp-entry { display:grid; grid-template-columns:minmax(0,1fr); gap:12px; align-items:start; margin-top:10px; }
[data-compose] .cp-grid-area { min-width:0; display:grid; gap:8px; }
[data-compose] .cp-grid-area .cp-actions label { display:grid; gap:3px; min-width:100px; }
[data-compose] .cp-grid-scroll { overflow:auto; overscroll-behavior:contain; max-height:420px; border:2px solid var(--ss-sub); border-radius:8px; max-width:100%; scrollbar-gutter:stable; scrollbar-color:var(--ss-sub) var(--ss-well); scrollbar-width:auto; }
[data-compose] .cp-grid { display:grid; width:100%; gap:0; background:var(--ss-stroke); }
[data-compose] .cp-arrangement::-webkit-scrollbar { width:12px; height:12px; }
[data-compose] .cp-grid-scroll::-webkit-scrollbar { width:12px; height:12px; }
[data-compose] .cp-arrangement::-webkit-scrollbar-track { background:var(--ss-well); }
[data-compose] .cp-grid-scroll::-webkit-scrollbar-track { background:var(--ss-well); }
[data-compose] .cp-arrangement::-webkit-scrollbar-thumb { background:var(--ss-sub); border:3px solid var(--ss-well); border-radius:8px; }
[data-compose] .cp-grid-scroll::-webkit-scrollbar-thumb { background:var(--ss-sub); border:3px solid var(--ss-well); border-radius:8px; }
[data-compose] .cp-arrangement:focus-visible { outline:2px solid var(--ss-accent); outline-offset:3px; }
[data-compose] .cp-grid-scroll:focus-visible { outline:2px solid var(--ss-accent); outline-offset:3px; }
[data-compose] .cp-grid-panel:focus-visible { outline:2px solid var(--ss-accent); outline-offset:3px; }
[data-compose] .cp-scroll-help { font-size:12px; color:var(--ss-sub); margin:8px 0; }
[data-compose] .cp-scroll-help strong { color:var(--ss-ink); }
[data-compose] .cp-grid>span { display:grid; place-items:center; min-width:0; background:var(--ss-base); font:11px var(--ss-mono); border-right:1px solid var(--ss-stroke); border-bottom:1px solid var(--ss-stroke); }
[data-compose] .cp-grid .cp-grid-bar { position:sticky; top:0; z-index:3; height:26px; justify-items:start; padding-left:8px; border-left:2px solid var(--ss-sub); font-weight:bold; color:var(--ss-ink); }
[data-compose] .cp-grid .cp-grid-subdivision { position:sticky; top:26px; z-index:3; height:26px; color:var(--ss-sub); }
[data-compose] .cp-grid [data-bar=true] { border-left:2px solid var(--ss-sub); }
[data-compose] .cp-grid .cp-grid-corner { position:sticky; left:0; top:0; z-index:5; height:26px; font-size:10px; }
[data-compose] .cp-grid .cp-grid-beat-label { top:26px; }
[data-compose] .cp-grid .cp-grid-pitch { position:sticky; left:0; z-index:2; height:28px; font-weight:bold; }
[data-compose] .cp-grid button { position:relative; touch-action:none; width:100%; min-width:0; min-height:28px; height:28px; border:0; border-right:1px solid var(--ss-stroke); border-bottom:1px solid var(--ss-stroke); border-radius:0; padding:0; background:var(--ss-well); }
[data-compose] .cp-grid button[data-on=true] { color:var(--ss-ink); }
[data-compose] .cp-grid-body { position:absolute; pointer-events:none; top:3px; bottom:3px; display:grid; place-items:center; background:color-mix(in srgb,var(--cp-layer-color,var(--ss-accent)) 35%,var(--ss-well)); border-block:1px solid var(--ss-sub); overflow:hidden; box-sizing:border-box; }
[data-compose] .cp-grid-body[data-note-onset=true] { border-left:3px solid var(--ss-ink); border-radius:4px 0 0 4px; }
[data-compose] .cp-grid button[data-selected=true] { outline:2px solid var(--ss-ink); outline-offset:-3px; z-index:1; }
[data-compose] .cp-grid-preview { position:absolute; pointer-events:none; top:2px; bottom:2px; background:color-mix(in srgb,var(--ss-accent) 40%,transparent); border:2px dashed var(--ss-ink); box-sizing:border-box; }
[data-compose] .cp-overlap-count { position:absolute; right:2px; top:0; font:9px var(--ss-mono); pointer-events:none; background:var(--ss-base); }
[data-compose] .cp-lane { border-left:3px solid var(--cp-layer-color,var(--ss-accent)); }
[data-compose] .cp-lane[data-audible=false] .cp-clips { opacity:.6; }
[data-compose] .cp-editing-dock { display:grid; grid-template-columns:minmax(0,1fr); gap:12px; align-items:start; min-width:0; }
[data-compose] .cp-grid-panel { min-width:0; }
[data-compose] .cp-stored-length { min-width:0; color:var(--ss-sub); font-size:12px; }
@container sonic-shell (min-width:960px) {
 [data-compose] .cp-editing-dock[data-editor-open=true] { grid-template-columns:minmax(0,1.35fr) minmax(320px,1fr); }
 [data-compose] .cp-editing-dock[data-editor-open=true] .cp-note-editor { grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); }
}
[data-compose] .cp-note-editor { display:grid; grid-template-columns:repeat(3,minmax(130px,1fr)); gap:8px; align-items:start; border-top:1px solid var(--ss-stroke); padding-top:10px; min-width:0; }
[data-compose] .cp-note-editor>h3 { grid-column:1/-1; }
[data-compose] .cp-note-editor>p { grid-column:1/-1; }
[data-compose] .cp-note-editor>button { justify-self:start; }
[data-compose] .cp-note-summary { font:11px var(--ss-mono); color:var(--ss-sub); }
[data-compose] .cp-layer-name { display:flex; align-items:center; gap:8px; min-width:0; margin-left:auto; }
[data-compose] .cp-layer-name input { max-width:260px; }
[data-compose] .cp-layer-tools { display:flex; gap:12px; flex-wrap:wrap; }
[data-compose] .cp-tool-group { display:flex; align-items:center; gap:8px; flex-wrap:wrap; flex:1 1 280px; min-width:0; }
[data-compose] .cp-tool-group+ .cp-tool-group { border-left:1px solid var(--ss-stroke); padding-left:12px; }
[data-compose] .cp-tool-group>strong { flex-basis:100%; font-size:12px; }
[data-compose] .cp-tool-group label { display:grid; gap:4px; min-width:150px; flex:1; }
[data-compose] .cp-tool-group>span { overflow-wrap:anywhere; }
[data-compose] .cp-editor-anchor { min-width:0; scroll-margin-top:150px; }
[data-compose] .cp-drawer { border:1px solid var(--ss-accent); border-radius:12px; padding:16px; display:grid; gap:12px; min-width:0; background:var(--ss-panel); }
[data-compose] .cp-drawer-head { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; }
[data-compose] .cp-editor-tabs { display:flex; gap:5px; flex-wrap:wrap; }
[data-compose] .cp-saved-list { display:flex; gap:6px; flex-wrap:wrap; margin:8px 0; }
[data-compose] .cp-saved-list button { max-width:100%; overflow-wrap:anywhere; }
[data-compose] .cp-timing-help { margin-top:10px; }
[data-compose] .cp-timing-help>summary { cursor:pointer; color:var(--ss-sub); font-size:12px; }
[data-compose] .cp-timing-help p { margin-top:6px; }
@container sonic-shell (max-width:720px) {
 [data-compose] .cp-session-context { position:static; }
 [data-compose] .cp-controls { grid-template-columns:repeat(2,minmax(100px,1fr)); }
 [data-compose] .cp-note-editor { grid-template-columns:minmax(0,1fr); }
 [data-compose] .cp-tool-group + .cp-tool-group { border-left:0; border-top:1px solid var(--ss-stroke); padding-left:0; padding-top:10px; }
}
@container sonic-shell (max-width:420px) {
 [data-compose] .cp-controls { grid-template-columns:minmax(0,1fr); }
 [data-compose] .cp-library label { min-width:0; flex-basis:100%; }
}
@media(max-height:600px) { [data-compose] .cp-session-context { position:static; } }
`;

