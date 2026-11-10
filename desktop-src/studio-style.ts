import { ROUTING_CSS } from './studio-routing-style';
import { ANALYSIS_CSS } from './studio-analysis-style';

/** Scoped instrument base, components and explicit responsive states. */
export const STUDIO_CSS = `

/* Base allocation: one shell, independently reachable library/inspector and a useful editor floor. */
[data-sound-studio] { height:100%; min-height:100%; display:flex; flex-direction:column; overflow:visible; }
[data-sound-studio] .ss-shell { display:flex; flex-direction:column; flex:1 1 0; min-height:0; min-width:0; gap:8px; padding:12px; }
[data-sound-studio] .ss-workspace { position:relative; display:grid; grid-template-columns:224px minmax(0,1fr); gap:8px; flex:1 1 0; min-width:0; min-height:480px; }
[data-sound-studio] .ss-workspace[data-inspector-open=true] { grid-template-columns:224px minmax(0,1fr) 236px; }
[data-sound-studio] .ss-workspace[data-library-open=false] { grid-template-columns:minmax(0,1fr); }
[data-sound-studio] .ss-workspace[data-library-open=false][data-inspector-open=true] { grid-template-columns:minmax(0,1fr) 236px; }
[data-sound-studio] .ss-workspace[data-library-open=false] .ss-library { display:none; }
[data-sound-studio] .ss-library { min-width:0; min-height:0; border:1px solid var(--ss-stroke); border-radius:8px; background:var(--ss-panel); padding:10px; overflow:auto; scrollbar-color:var(--ss-stroke) transparent; }
[data-sound-studio] .ss-inspector { display:none; flex-direction:column; gap:10px; min-width:0; min-height:0; border:1px solid var(--ss-stroke); border-radius:8px; background:var(--ss-panel); padding:10px; overflow:auto; scrollbar-color:var(--ss-stroke) transparent; }
[data-sound-studio] .ss-workspace[data-inspector-open=true] .ss-inspector { display:flex; }
[data-sound-studio] .ss-instrument { display:flex; flex-direction:column; container:studio-editor / inline-size; min-width:0; min-height:0; border:1px solid var(--ss-stroke); border-radius:8px; background:var(--ss-panel); padding:9px 11px 0; overflow:auto; scrollbar-color:var(--ss-stroke) transparent; }
[data-sound-studio] .ss-instrument-head { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; flex:0 0 auto; padding-bottom:6px; }
[data-sound-studio] .ss-analysis { flex:0 0 auto; min-width:0; min-height:0; border-block:1px solid var(--ss-stroke); max-height:min(228px,32dvh); overflow:auto; }
[data-sound-studio] .ss-analysis-summary { display:flex; align-items:center; flex-wrap:wrap; padding:3px 0; gap:3px 10px; }
[data-sound-studio] .ss-analysis-readings { display:flex; flex:1 1 280px; min-width:0; flex-wrap:wrap; gap:2px 10px; font-size:11px; color:var(--ss-sub); }
[data-sound-studio] .ss-analysis #ss-inline-analysis { max-height:min(168px,24dvh); overflow:auto; }
[data-sound-studio] .ss-analysis #ss-inline-analysis .ss-scope { display:flex; flex-direction:column; height:148px; min-height:0; resize:none; overflow:auto; padding-bottom:4px; }
[data-sound-studio] .ss-analysis #ss-inline-analysis .ss-scope .ss-analysis-figure { flex:0 0 auto; min-height:0; }
[data-sound-studio] .ss-analysis #ss-inline-analysis .ss-plot-frame { flex:none; min-height:0; }
[data-sound-studio] .ss-analysis #ss-inline-analysis .ss-plot-frame .ss-plot { height:64px; min-height:0; }
[data-sound-studio] .ss-analysis #ss-inline-analysis .ss-plot-caption { display:block; }
[data-sound-studio] .ss-editor-area { display:flex; flex-direction:column; flex:1 0 220px; min-height:calc(180px + 40px); min-width:0; }
[data-sound-studio] .ss-editor-navigation { flex:0 0 auto; min-width:0; }
[data-sound-studio] .ss-editor-tabs { display:flex; flex-direction:row; gap:2px; overflow-x:auto; max-width:100%; border-bottom:1px solid var(--ss-stroke); scrollbar-width:thin; }
[data-sound-studio] .ss-editor-tabs button { flex:0 0 auto; min-height:36px; border:0; border-bottom:2px solid transparent; border-radius:0; background:transparent; padding:8px 10px; white-space:nowrap; font-size:12px; font-weight:630; }
[data-sound-studio] .ss-editor-tabs button[aria-selected=true] { color:var(--ss-ink); border-bottom-color:var(--ss-primary); box-shadow:none; }
[data-sound-studio] .ss-editor-content { display:flex; flex-direction:column; flex:1; min-height:180px; min-width:0; }
[data-sound-studio] .ss-editor { min-width:0; min-height:0; flex:1; overflow:auto; padding:12px 2px 28px; scrollbar-color:var(--ss-stroke) transparent; }
[data-sound-studio] .ss-preview { min-height:0; position:relative; }
[data-sound-studio] .ss-feedback { flex:0 0 auto; max-height:96px; overflow:auto; }
[data-sound-studio] .ss-footer { flex:0 0 auto; padding:0; color:var(--ss-sub); font-size:11px; }

/* Components: consolidated current controls, synthesis, effects and document disclosures. */
[data-sound-studio] h1 { margin:0; letter-spacing:-.035em; line-height:1.15; font-weight:680; font-size:19px; }
[data-sound-studio] h2 { margin:0; font-size:15px; line-height:1.25; font-weight:650; }
[data-sound-studio] h3 { margin:0; font-size:13px; font-weight:650; }
[data-sound-studio] p { margin:0; }
[data-sound-studio] button { font:inherit; color:inherit; cursor:pointer; border:1px solid var(--ss-stroke); background:var(--ss-raised); border-radius:8px; min-height:32px; padding:6px 10px; }
[data-sound-studio] input { font:inherit; color:inherit; }
[data-sound-studio] select { font:inherit; color:inherit; width:100%; min-width:0; background:var(--ss-well); border:1px solid var(--ss-stroke); border-radius:7px; padding:7px 9px; }
[data-sound-studio] textarea { font:inherit; color:inherit; width:100%; min-width:0; background:var(--ss-well); border:1px solid var(--ss-stroke); border-radius:7px; padding:7px 9px; min-height:64px; resize:vertical; }
[data-sound-studio] button:hover:not(:disabled) { border-color:var(--ss-accent); }
[data-sound-studio] button:disabled { cursor:not-allowed; opacity:.48; }
[data-sound-studio] :is(button,input,select,textarea):focus-visible { outline:2px solid var(--ss-accent); outline-offset:2px; }
[data-sound-studio] button[aria-pressed=true] { border-color:var(--ss-accent); box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ss-accent) 34%,transparent); }
[data-sound-studio] .ss-event[data-selected=true] { border-color:var(--ss-accent); box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ss-accent) 34%,transparent); }
[data-sound-studio] input[type=range] { accent-color:var(--ss-accent); width:100%; min-height:24px; cursor:pointer; }
[data-sound-studio] input[type=text] { width:100%; min-width:0; background:var(--ss-well); border:1px solid var(--ss-stroke); border-radius:7px; padding:7px 9px; }
[data-sound-studio] input[type=file] { width:100%; min-width:0; background:var(--ss-well); border:1px solid var(--ss-stroke); border-radius:7px; padding:7px 9px; }
[data-sound-studio] label { font-size:12px; }
[data-sound-studio] .ss-eyebrow { display:block; color:var(--ss-accent); font:bold 10px/1.4 var(--ss-mono); letter-spacing:.18em; margin-bottom:1px; }
[data-sound-studio] .ss-section-head { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px; }
[data-sound-studio] .ss-json-import { display:grid; gap:4px; width:min(330px,100%); min-width:0; }
[data-sound-studio] .ss-json-import > button { justify-self:start; }
[data-sound-studio] .ss-json-import-help { font-size:12px; line-height:1.4; color:var(--ss-sub); white-space:normal; overflow-wrap:anywhere; }
[data-sound-studio] .ss-primary { background:var(--ss-primary); border-color:var(--ss-primary); color:var(--ss-ink); font-weight:650; }
[data-sound-studio] .ss-play { background:var(--ss-primary); border-color:var(--ss-primary); color:var(--ss-ink); font-weight:650; }
[data-sound-studio] .ss-segment { display:inline-flex; border:1px solid var(--ss-stroke); border-radius:8px; padding:3px; gap:2px; background:var(--ss-well); max-width:100%; }
[data-sound-studio] .ss-segment button { background:transparent; border-color:transparent; padding:4px 9px; min-height:28px; text-transform:capitalize; }
[data-sound-studio] .ss-segment button[aria-pressed=true] { background:var(--ss-raised); border-color:var(--ss-accent); }
[data-sound-studio] .ss-red-dot { height:7px; width:7px; border-radius:50%; background:var(--ss-sub); box-shadow:none; }
[data-sound-studio] .ss-dim { color:var(--ss-sub); font-size:12px; }
[data-sound-studio] .ss-muted { color:var(--ss-sub); font-size:12px; }
[data-sound-studio] .ss-plot-meta { color:var(--ss-sub); font-size:12px; }
[data-sound-studio] .ss-dirty { font-weight:400; color:var(--ss-sub); font-size:12px; }
[data-sound-studio] .ss-current { color:var(--ss-accent); font:11px var(--ss-mono); letter-spacing:.03em; margin-left:auto; }
[data-sound-studio] .ss-alert { padding:8px 12px; border-radius:7px; border:1px solid var(--ss-accent); font-size:12px; background:var(--ss-raised); }
[data-sound-studio] .ss-notice { border-radius:7px; display:inline-block; max-width:100%; padding:2px 7px; font-size:11px; border:0; background:var(--ss-raised); }
[data-sound-studio] .ss-panel { min-width:0; border:1px solid var(--ss-stroke); border-radius:12px; padding:16px; background:var(--ss-panel); box-shadow:none; }
[data-sound-studio] .ss-panel > :is(h2,p) + * { margin-top:9px; }
[data-sound-studio] .ss-icon { width:26px; height:26px; display:inline-grid; place-items:center; border:1px solid var(--ss-stroke); border-radius:6px; color:var(--ss-accent); background:var(--ss-raised); font-size:16px; }
[data-sound-studio] .ss-style-row { display:flex; flex-wrap:wrap; gap:5px; margin:4px 0; }
[data-sound-studio] .ss-style-row button { text-transform:capitalize; font-weight:600; background:var(--ss-raised); font-size:11px; }
[data-sound-studio] .ss-visual-card { background:var(--ss-well); border:1px solid var(--ss-stroke); border-radius:10px; padding:12px; margin:0 0 14px; }
[data-sound-studio] .ss-visual-top { display:flex; justify-content:space-between; align-items:center; gap:8px; }
[data-sound-studio] .ss-visual-top small { display:block; color:var(--ss-sub); font:10px var(--ss-mono); letter-spacing:.06em; }
[data-sound-studio] .ss-visual-top strong { display:block; font-size:16px; margin-top:3px; }
[data-sound-studio] .ss-plot { display:block; background:var(--ss-well); border:1px solid var(--ss-stroke); border-radius:7px; width:100%; height:116px; margin:9px 0 5px; }
[data-sound-studio] .ss-empty { color:var(--ss-sub); display:grid; place-items:center; text-align:center; font-size:12px; padding:9px; }
[data-sound-studio] .ss-axis { stroke:var(--ss-stroke); stroke-width:1; }
[data-sound-studio] .ss-signal { fill:none; stroke:var(--ss-accent); stroke-width:2; vector-effect:non-scaling-stroke; }
[data-sound-studio] .ss-wavefill { fill:color-mix(in srgb,var(--ss-accent) 28%,transparent); stroke:var(--ss-accent); stroke-width:1.5; vector-effect:non-scaling-stroke; }

[data-sound-studio] .ss-macros { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:9px; max-width:920px; }
[data-sound-studio] .ss-control { min-width:0; background:transparent; border:0; border-radius:0; padding:4px 0; }
[data-sound-studio] .ss-control-head { display:flex; align-items:center; flex-wrap:wrap; gap:5px; min-height:25px; }
[data-sound-studio] .ss-control-head label { font-weight:620; }
[data-sound-studio] .ss-control-head output { margin-left:auto; font:13px var(--ss-mono); color:var(--ss-ink); }
[data-sound-studio] .ss-control select { margin-top:5px; }
[data-sound-studio] .ss-control input { margin-top:5px; }
[data-sound-studio] .ss-event-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin-top:12px; }
[data-sound-studio] .ss-event-list { display:grid; gap:4px; min-width:0; margin-top:2px; }
[data-sound-studio] .ss-palette-list { display:grid; gap:4px; min-width:0; margin-top:2px; }
[data-sound-studio] .ss-saved-list { display:grid; gap:4px; min-width:0; margin-top:2px; max-height:none; overflow:visible; }
[data-sound-studio] .ss-event { min-width:0; border:1px solid var(--ss-stroke); background:var(--ss-panel); display:flex; align-items:center; gap:4px; padding:3px; border-radius:6px; }
[data-sound-studio] .ss-event-select { min-width:0; flex:1; text-align:left; background:transparent; border:0; display:grid; grid-template-columns:auto 1fr; column-gap:6px; padding:2px 3px; }
[data-sound-studio] .ss-event-select strong { font-size:12px; }
[data-sound-studio] .ss-event-select small { grid-column:2; color:var(--ss-sub); white-space:nowrap; font-size:11px; min-width:0; overflow:hidden; text-overflow:ellipsis; }
[data-sound-studio] .ss-event-number { font:11px var(--ss-mono); color:var(--ss-sub); }
[data-sound-studio] .ss-index { font:11px var(--ss-mono); color:var(--ss-sub); }
[data-sound-studio] .ss-event-key { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
[data-sound-studio] .ss-event-play { flex:0 0 auto; width:28px; padding:0; color:var(--ss-accent); }
[data-sound-studio] .ss-palette { display:flex; align-items:center; text-align:left; gap:10px; background:var(--ss-panel); width:100%; padding:4px; min-width:0; max-width:100%; }
[data-sound-studio] .ss-palette-art { flex:0 0 auto; display:grid; place-items:center; border-radius:6px; border:1px solid var(--ss-stroke); width:28px; height:27px; font-size:14px; background:var(--ss-raised); color:var(--ss-accent); }
[data-sound-studio] .ss-palette span:nth-child(2) { min-width:0; flex:1; }
[data-sound-studio] .ss-palette strong { overflow:hidden; text-overflow:ellipsis; display:block; white-space:normal; overflow-wrap:anywhere; }
[data-sound-studio] .ss-palette small { display:block; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:var(--ss-sub); font-size:11px; }
[data-sound-studio] .ss-devices { display:grid; grid-template-columns:minmax(0,1.6fr) minmax(85px,1fr); gap:10px; align-items:center; background:var(--ss-well); border:1px solid var(--ss-stroke); border-radius:9px; padding:12px; margin:5px 0; }
[data-sound-studio] .ss-desktop-frame { min-width:0; border:2px solid var(--ss-stroke); background:var(--ss-panel); padding:8px; display:grid; gap:8px; box-shadow:0 7px 16px rgba(0,0,0,.35); border-radius:7px; }
[data-sound-studio] .ss-phone-frame { min-width:0; border:2px solid var(--ss-stroke); background:var(--ss-panel); padding:8px; display:grid; gap:8px; box-shadow:0 7px 16px rgba(0,0,0,.35); border-radius:16px; max-width:148px; margin:auto; width:100%; }
[data-sound-studio] .ss-device-top { display:flex; gap:4px; align-items:center; color:var(--ss-sub); font:9px var(--ss-mono); }
[data-sound-studio] .ss-device-top i { width:5px; height:5px; background:var(--ss-accent); border-radius:50%; }
[data-sound-studio] .ss-device-top span { margin-left:auto; }
[data-sound-studio] .ss-phone-notch { width:28px; height:4px; border-radius:6px; background:var(--ss-accent); margin:0 auto; }
[data-sound-studio] .ss-phone-frame small { color:var(--ss-sub); font:9px var(--ss-mono); }
[data-sound-studio] .ss-device-actions { display:flex; gap:5px; }
[data-sound-studio] .ss-devices button { min-height:30px; padding:4px; font-size:11px; }
[data-sound-studio] .ss-device-actions button { flex:1; }
[data-sound-studio] .ss-module-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,270px),1fr)); gap:10px; align-items:start; }
[data-sound-studio] .ss-module-stack { display:grid; align-content:start; gap:12px; min-width:0; }
[data-sound-studio] .ss-module { display:grid; gap:7px; }
[data-sound-studio] .ss-voice { display:flex; align-items:center; gap:8px; padding:7px 0; border:0; border-top:1px solid var(--ss-stroke); background:transparent; border-radius:0; }
[data-sound-studio] .ss-voice .ss-section-head { margin:0; flex:none; width:100%; }
[data-sound-studio] .ss-voice .ss-section-head h3 { margin-right:auto; }
[data-sound-studio] .ss-two { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; }
[data-sound-studio] .ss-toggle { display:flex; align-items:center; gap:6px; border:1px solid var(--ss-stroke); background:var(--ss-raised); border-radius:7px; min-height:30px; padding:3px 7px; cursor:pointer; white-space:nowrap; }
[data-sound-studio] .ss-toggle input { accent-color:var(--ss-accent); margin:0; }
[data-sound-studio] .ss-toggle-state { margin-left:auto; font-size:11px; color:var(--ss-ink); }
[data-sound-studio] .ss-disabled { border:1px dashed var(--ss-stroke); padding:8px; border-radius:6px; color:var(--ss-sub); font-size:12px; }
[data-sound-studio] .ss-matrix { grid-column:span 2; }
[data-sound-studio] .ss-effects { grid-column:span 2; }
[data-sound-studio] .ss-matrix-row { display:grid; gap:5px; align-items:end; padding:6px; background:transparent; border-top:1px solid var(--ss-stroke); border-radius:0; grid-template-columns:minmax(125px,1fr) minmax(170px,1.2fr) minmax(140px,1fr) auto; }
[data-sound-studio] .ss-fx-row { display:flex; flex-wrap:wrap; gap:7px; }
[data-sound-studio] .ss-project-basic { display:grid; gap:8px; }
[data-sound-studio] .ss-chord-row { gap:6px; display:flex; align-items:center; min-width:0; border-left:1px solid var(--ss-stroke); padding-left:7px; }
[data-sound-studio] .ss-secondary > summary { cursor:pointer; font-weight:650; }
[data-sound-studio] .ss-secondary > summary:focus-visible { outline:2px solid var(--ss-accent); outline-offset:4px; }
[data-sound-studio] .ss-secondary-body { display:grid; gap:8px; padding-top:12px; }
[data-sound-studio] .ss-saved-list button { text-align:left; }
[data-sound-studio] .ss-saved-list small { color:var(--ss-sub); }
[data-sound-studio] .ss-export-buttons { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; }
[data-sound-studio] .ss-export-buttons button { font-size:11px; padding:6px; }
[data-sound-studio] .ss-import { display:grid; gap:5px; margin-top:8px; }
[data-sound-studio] .ss-draft { display:grid; gap:8px; }
[data-sound-studio] .ss-draft-review { background:var(--ss-panel); border:1px solid var(--ss-stroke); padding:8px; border-radius:8px; max-height:170px; overflow:auto; }
[data-sound-studio] .ss-library-head { color:var(--ss-sub); font:700 10px var(--ss-mono); letter-spacing:.14em; padding-bottom:8px; border-bottom:1px solid var(--ss-stroke); display:flex; justify-content:space-between; align-items:center; }
[data-sound-studio] .ss-inspector-head { color:var(--ss-sub); font:700 10px var(--ss-mono); letter-spacing:.14em; padding-bottom:8px; border-bottom:1px solid var(--ss-stroke); display:flex; justify-content:space-between; align-items:center; }
[data-sound-studio] .ss-library-close { display:block; }
[data-sound-studio] .ss-library-open { display:block; font-size:12px; }
[data-sound-studio] .ss-inspector-open { display:block; }
[data-sound-studio] .ss-library-section { display:grid; padding:10px 0; border-bottom:1px solid var(--ss-stroke); gap:10px; }
[data-sound-studio] .ss-library-section h2 { margin-bottom:2px; }
[data-sound-studio] .ss-library-section > button { width:100%; }
[data-sound-studio] .ss-library .ss-panel { padding:7px; }
[data-sound-studio] .ss-instrument-head div { margin-right:auto; }
[data-sound-studio] .ss-instrument-head h2 { letter-spacing:-.025em; font-size:15px; }
[data-sound-studio] .ss-scope { display:flex; flex-direction:column; height:var(--ss-analysis-height,280px); min-height:220px; resize:vertical; overflow:auto; padding:4px 0 12px; position:relative; }
[data-sound-studio] .ss-scope::after { content:""; pointer-events:none; position:absolute; inset:0; border-radius:8px; box-shadow:inset 0 0 24px var(--ss-accent); opacity:var(--sonic-energy,0); transition:opacity 90ms linear; }
[data-sound-studio] .ss-export-warnings { max-height:130px; overflow:auto; padding-left:18px; margin:3px 0; font-size:11px; color:var(--ss-sub); }
[data-sound-studio] .ss-export-controls { display:grid; gap:7px; }
[data-sound-studio] .ss-scope-head { display:flex; justify-content:space-between; align-items:center; flex:0 0 auto; flex-wrap:wrap; gap:6px; }
[data-sound-studio] .ss-scope .ss-plot { margin:6px 0 3px; height:88px; }
[data-sound-studio] .ss-editor-stack { display:flex; flex-direction:column; gap:14px; min-width:0; }
[data-sound-studio] .ss-editor .ss-module { display:flex; flex-direction:column; gap:6px; min-width:0; padding:0 0 13px; border:0; border-bottom:1px solid var(--ss-stroke); border-radius:0; background:transparent; box-shadow:none; }
[data-sound-studio] .ss-editor .ss-module > h2 { font-size:14px; margin-bottom:2px; }
[data-sound-studio] .ss-plot-time { display:flex; justify-content:space-between; color:var(--ss-sub); font-size:11px; margin:0 2px 2px; }
[data-sound-studio] .ss-inspector .ss-panel { border:0; box-shadow:none; background:transparent; padding:0; }
[data-sound-studio] .ss-inspector .ss-disabled { border:0; padding:0; }
[data-sound-studio] .ss-voice > .ss-control { flex:1 1 115px; }
[data-sound-studio] .ss-voice .ss-two { display:flex; flex:2 1 220px; gap:8px; min-width:0; }
[data-sound-studio] .ss-voice .ss-two .ss-control { flex:1; }
[data-sound-studio] .ss-adsr-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:3px 12px; }
[data-sound-studio] .ss-envelope-curve { display:block; width:100%; height:120px; background:var(--ss-well); border:1px solid var(--ss-stroke); border-radius:5px; }
[data-sound-studio] .ss-env-guide { fill:none; stroke:var(--ss-stroke); }
[data-sound-studio] .ss-env-line { fill:none; stroke:var(--ss-accent); stroke-width:2; vector-effect:non-scaling-stroke; }
[data-sound-studio] .ss-envelope-curve text { fill:var(--ss-sub); font:10px var(--ss-mono); }
[data-sound-studio] .ss-pitch-strip { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr)); gap:12px; }
[data-sound-studio] .ss-chord-row > button { padding:2px; min-width:24px; }
[data-sound-studio] .ss-chord-row .ss-control { flex:1; }
[data-sound-studio] .ss-effects-rack ol { list-style:none; margin:9px 0; padding:0; display:grid; gap:5px; }
[data-sound-studio] .ss-effects-rack li { display:flex; align-items:center; gap:9px; border:1px solid var(--ss-stroke); background:var(--ss-well); border-radius:6px; padding:5px 8px; min-height:44px; }
[data-sound-studio] .ss-effects-rack li .ss-toggle { flex:1; }
[data-sound-studio] .ss-fx-handle { color:var(--ss-sub); cursor:grab; }
[data-sound-studio] .ss-fx-moves { display:flex; gap:4px; margin-left:auto; }
[data-sound-studio] .ss-fx-moves button { width:30px; padding:0; }
[data-sound-studio] .ss-preview > summary { cursor:pointer; font-weight:630; padding:3px; font-size:11px; }
[data-sound-studio] .ss-preview-body { position:static; min-width:0; overflow:auto; display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:9px; padding:10px; background:var(--ss-panel); border:1px solid var(--ss-stroke); border-radius:8px; max-height:none; box-shadow:none; }
[data-sound-studio] .ss-shell > .ss-draft-review { max-height:140px; }
[data-sound-studio] .ss-curve-handle:focus-visible { outline:2px solid var(--ss-accent); outline-offset:2px; }
[data-sound-studio] .ss-knob:focus-visible { outline:2px solid var(--ss-accent); outline-offset:2px; }

[data-sound-studio] .ss-transport { display:flex; align-items:center; flex-wrap:wrap; font-size:11px; padding:2px 0; gap:4px 8px; color:var(--ss-ink); }
[data-sound-studio] .ss-transport span { margin-left:auto; color:var(--ss-sub); }
[data-sound-studio] .ss-parameter-flex { display:flex; flex-wrap:wrap; gap:8px; align-items:start; }
[data-sound-studio] .ss-parameter-flex > * { flex:1 1 170px; min-width:0; }
[data-sound-studio] .ss-module-card { min-width:0; display:grid; align-content:start; gap:7px; padding:10px; border:1px solid var(--ss-stroke); border-radius:8px; background:var(--ss-panel); }
[data-sound-studio] .ss-module-card-head { display:flex; justify-content:space-between; align-items:center; gap:5px; }
[data-sound-studio] .ss-module-card-head small { color:var(--ss-sub); font-size:10px; }
[data-sound-studio] .ss-module-masonry { columns:2 235px; column-gap:10px; }
[data-sound-studio] .ss-module-masonry > .ss-module-card { break-inside:avoid; margin:0 0 10px; }
[data-sound-studio] .ss-fx-line { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
[data-sound-studio] .ss-knob-control { min-width:0; padding:4px 0; }
[data-sound-studio] .ss-knob-head { display:flex; align-items:center; gap:8px; font-size:12px; font-weight:600; }
[data-sound-studio] .ss-knob-row { display:flex; align-items:center; gap:8px; }
[data-sound-studio] .ss-knob { flex:0 0 44px; width:44px; height:44px; border-radius:50%; display:grid; place-items:center; touch-action:none; cursor:ns-resize; }
[data-sound-studio] .ss-knob svg { width:44px; height:44px; overflow:visible; }
[data-sound-studio] .ss-knob-track,[data-sound-studio] .ss-knob-active { fill:none; stroke-width:3; stroke-linecap:round; }
[data-sound-studio] .ss-knob-track { stroke:var(--ss-stroke); }
[data-sound-studio] .ss-knob-active { stroke:var(--ss-accent); }
[data-sound-studio] .ss-knob-face { fill:var(--ss-raised); stroke:var(--ss-stroke); }
[data-sound-studio] .ss-knob-needle { stroke:var(--ss-accent); stroke-width:2; stroke-linecap:round; }
[data-sound-studio] .ss-knob[aria-disabled=true] { opacity:.5; cursor:default; }
[data-sound-studio] .ss-parameter-readout { width:100%; min-width:0; min-height:29px; padding:2px 5px; text-align:right; color:var(--ss-ink); font:13px var(--ss-mono); font-variant-numeric:tabular-nums; background:var(--ss-well); border:1px solid var(--ss-stroke); border-radius:5px; cursor:text; }
[data-sound-studio] .ss-parameter-readout:focus-visible { outline:2px solid var(--ss-accent); outline-offset:2px; }
[data-sound-studio] .ss-numeric-amount .ss-parameter-value { display:block; }
[data-sound-studio] .ss-numeric-amount .ss-parameter-value > span:nth-of-type(2) { display:flex; }
[data-sound-studio] .ss-numeric-amount .ss-parameter-value .ss-input-error { max-width:200px; }
[data-sound-studio] .ss-audition-consent { position:absolute; width:1px; height:1px; padding:0; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
[data-sound-studio] .ss-transport:focus-within .ss-audition-consent { position:static; width:auto; height:auto; clip-path:none; white-space:normal; flex-basis:100%; }

[data-sound-studio] .ss-parameter-value { flex:1; min-width:0; display:grid; gap:1px; color:var(--ss-sub); font-size:12px; }
[data-sound-studio] .ss-parameter-value > span:nth-of-type(2) { display:flex; align-items:center; gap:3px; }
[data-sound-studio] .ss-parameter-value input { width:100%; min-width:0; background:var(--ss-well); border:1px solid var(--ss-stroke); border-radius:5px; padding:2px 4px; max-width:none; min-height:29px; font:13px var(--ss-mono); }
[data-sound-studio] .ss-curve { width:100%; min-width:0; height:120px; background:var(--ss-well); border:1px solid var(--ss-stroke); border-radius:5px; }
[data-sound-studio] .ss-filter-response text { fill:var(--ss-sub); font:9px var(--ss-mono); }
[data-sound-studio] .ss-filter-axis-caption { color:var(--ss-sub); font:11px/1.4 var(--ss-mono); }
[data-sound-studio] .ss-fx-path { margin:8px 0; padding:7px 9px; background:var(--ss-well); border:1px solid var(--ss-stroke); border-radius:6px; color:var(--ss-ink); font:11px/1.6 var(--ss-mono); overflow-wrap:anywhere; }
[data-sound-studio] .ss-curve-handle { fill:var(--ss-panel); stroke:var(--ss-accent); stroke-width:3; cursor:grab; touch-action:none; }
[data-sound-studio] .ss-shape-preview { width:100%; height:44px; background:var(--ss-well); border:1px solid var(--ss-stroke); border-radius:5px; }
[data-sound-studio] .ss-effect-preview { width:100%; height:44px; background:var(--ss-well); border:1px solid var(--ss-stroke); border-radius:5px; }
[data-sound-studio] .ss-shape-preview polyline { fill:none; stroke:var(--ss-accent); stroke-width:2; }
[data-sound-studio] .ss-effect-preview path { fill:none; stroke:var(--ss-accent); stroke-width:2; }
[data-sound-studio] .ss-overlay-body { min-width:0; overflow:auto; }
[data-sound-studio] .ss-modulation-matrix { display:grid; gap:6px; }
[data-sound-studio] .ss-feedback:empty { display:none; }
[data-sound-studio] .ss-inspector-head button { min-height:27px; padding:1px 9px; }
[data-sound-studio] .ss-analysis > summary { cursor:pointer; min-height:31px; display:flex; align-items:center; flex-wrap:wrap; gap:8px; font-weight:620; }
[data-sound-studio] .ss-analysis > summary:focus-visible { outline:2px solid var(--ss-accent); outline-offset:-2px; }
[data-sound-studio] .ss-transport small { color:var(--ss-sub); font-size:11px; }
[data-sound-studio] .ss-quick-editor { padding:12px 10px 28px; }
[data-sound-studio] .ss-beginner-controls { display:grid; align-content:start; gap:10px; max-width:940px; }
[data-sound-studio] .ss-beginner-controls h2 { font-size:18px; }
[data-sound-studio] .ss-beginner-controls .ss-parameter-flex > * { flex:1 1 190px; }
[data-sound-studio] .ss-more { margin-top:20px; }
[data-sound-studio] .ss-back-quick { justify-self:start; margin:4px 0; }
[data-sound-studio] .ss-library-admin > summary { cursor:pointer; font-weight:620; }
[data-sound-studio] .ss-preview-open { min-height:28px; padding:2px 8px; background:var(--ss-panel); font-size:11px; }
[data-sound-studio] .ss-preview-body > :is(.ss-draft-review,.ss-alert) { grid-column:1 / -1; max-height:none; overflow:visible; }
[data-sound-studio] .ss-parameter-value > span:first-child { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
:is([data-sound-studio],.ss-focused-overlay[data-kind=routing]) .ss-fx-slot { height:12px; position:relative; }
:is([data-sound-studio],.ss-focused-overlay[data-kind=routing]) .ss-fx-slot[data-active=true] { height:20px; }
:is([data-sound-studio],.ss-focused-overlay[data-kind=routing]) .ss-fx-slot[data-active=true] span { display:block; position:absolute; top:9px; left:5px; right:5px; height:3px; border-radius:3px; background:var(--ss-accent); box-shadow:0 0 6px var(--ss-accent); }
[data-sound-studio] .ss-parameter-value .ss-input-error { display:block; color:var(--ss-ink); border-left:2px solid var(--ss-accent); padding-left:4px; font-size:11px; line-height:1.25; white-space:normal; }
[data-sound-studio] .ss-parameter-value .ss-input-hint { color:var(--ss-sub); font-size:10px; line-height:1.25; display:none; white-space:normal; }
[data-sound-studio] .ss-parameter-value input[aria-invalid="true"] { border-color:var(--ss-accent); outline-color:var(--ss-accent); }
[data-sound-studio] .ss-transport [role="status"] { font-variant-numeric:tabular-nums; }
[data-sound-studio] .ss-module-card[data-enabled="false"] { border-style:dashed; background:var(--ss-well); }
[data-sound-studio] .ss-module-card[data-enabled="false"] .ss-module-preview { opacity:.45; filter:grayscale(1); }
[data-sound-studio] .ss-module-card[data-enabled="false"] .ss-module-card-head small { color:var(--ss-ink); border:1px dashed var(--ss-stroke); border-radius:3px; padding:2px 4px; }
[data-sound-studio] .ss-module-preview { min-width:0; }
[data-sound-studio] .ss-library-destinations { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:5px; padding:10px 0 0; }
[data-sound-studio] .ss-library-destinations button { font-size:12px; }
[data-sound-studio] .ss-library-destinations [aria-selected=true] { border-color:var(--ss-accent); background:var(--ss-well); font-weight:700; }
[data-sound-studio] .ss-library-section input[type=text] { font-size:14px; min-height:36px; }
[data-sound-studio] .ss-instrument-head .ss-eyebrow { letter-spacing:.08em; font-size:10px; }
[data-sound-studio] .ss-analysis-toggle { font-weight:650; font-size:12px; background:var(--ss-well); }
[data-sound-studio] .ss-analysis-readings strong { color:var(--ss-ink); font-variant-numeric:tabular-nums; font-weight:600; }
[data-sound-studio] .ss-scope-head button { font-size:12px; }
[data-sound-studio] .ss-compact-plot-key { font-size:12px; line-height:1.25; color:var(--ss-sub); margin:3px 0; }
[data-sound-studio] .ss-instrument > .ss-transport > small { display:block; }
[data-sound-studio] .ss-transport .ss-primary { white-space:normal; max-width:100%; }
[data-sound-studio] .ss-synthesis-layout { display:grid; grid-template-columns:minmax(0,1fr); gap:14px; }
[data-sound-studio] .ss-oscillator-bank { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr)); gap:12px; }
[data-sound-studio] .ss-oscillator-bank .ss-voice { display:grid; grid-template-columns:minmax(0,1fr); gap:8px; border:1px solid var(--ss-stroke); padding:10px; border-radius:7px; background:var(--ss-well); }
[data-sound-studio] .ss-voice .ss-shape-preview { height:45px; }
[data-sound-studio] .ss-voice .ss-control { width:100%; }
[data-sound-studio] .ss-voice select { min-width:145px; width:100%; min-height:34px; padding-right:24px; text-overflow:clip; }
[data-sound-studio] .ss-voice .ss-parameter-flex { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); align-items:start; gap:12px; }
[data-sound-studio] .ss-parameter-value > span > small { white-space:nowrap; color:var(--ss-ink); }
[data-sound-studio] .ss-parameter-value:focus-within .ss-input-hint { display:block; }
[data-sound-studio] .ss-duration-control { display:grid; gap:0; }
[data-sound-studio] .ss-duration-hint { color:var(--ss-sub); font-size:12px; }
[data-sound-studio] .ss-timing-feedback { color:var(--ss-ink); border-left:3px solid var(--ss-accent); padding:5px 8px; font-size:12px; }
[data-sound-studio] .ss-inspector .ss-module { border-top:1px solid var(--ss-stroke); padding-top:14px; }
[data-sound-studio] .ss-palette > span:last-child { min-width:0; overflow:hidden; }
[data-sound-studio] .ss-voice[data-enabled=false] { border-style:dashed; background:var(--ss-panel); }
[data-sound-studio] .ss-voice[data-enabled=false] .ss-shape-preview { opacity:.3; filter:grayscale(1); }
[data-sound-studio] .ss-voice-state { color:var(--ss-sub); font-size:12px; }
[data-sound-studio] .ss-note-chips { display:flex; flex-wrap:wrap; gap:6px; margin:8px 0; }
[data-sound-studio] .ss-note-chips > span { border:1px solid var(--ss-stroke); border-radius:6px; padding:4px 9px; font-weight:650; }
[data-sound-studio] .ss-note-chips small { display:block; color:var(--ss-sub); font-size:11px; }
[data-sound-studio] .ss-musical-pitch { display:grid; gap:6px; }
[data-sound-studio] .ss-note-readout { font-variant-numeric:tabular-nums; }
[data-sound-studio] .ss-gain-hierarchy { font-size:12px; padding:8px 0; color:var(--ss-sub); }
[data-sound-studio] .ss-effects-rack { container:effects-rack / inline-size; }
[data-sound-studio] .ss-fx-card[data-enabled=false] { border-style:dashed; }
[data-sound-studio] .ss-fx-header { display:grid; grid-template-columns:12px 22px minmax(0,1fr) 72px 82px 142px auto; grid-template-areas:"handle number name state toggle edit moves"; align-items:center; gap:8px; min-width:0; }
[data-sound-studio] .ss-fx-header h3 { grid-area:name; margin:0; min-width:0; font-size:13px; line-height:1.3; overflow-wrap:anywhere; }
[data-sound-studio] .ss-fx-header .ss-fx-handle { grid-area:handle; }
[data-sound-studio] .ss-fx-header .ss-fx-number { grid-area:number; color:var(--ss-sub); font-size:12px; font-variant-numeric:tabular-nums; }
[data-sound-studio] .ss-fx-state { grid-area:state; color:var(--ss-sub); font-size:12px; }
[data-sound-studio] .ss-fx-card[data-enabled=true] .ss-fx-state { color:var(--ss-ink); font-weight:600; }
[data-sound-studio] .ss-fx-header .ss-fx-toggle { grid-area:toggle; margin:0; min-width:0; font-size:12px; }
[data-sound-studio] .ss-fx-header .ss-fx-moves { grid-area:moves; margin:0; }
[data-sound-studio] .ss-fx-edit { grid-area:edit; margin:0; font-size:12px; min-height:32px; white-space:nowrap; }
[data-sound-studio] .ss-fx-edit[aria-expanded=true] { border-color:var(--ss-accent); background:var(--ss-well); }
[data-sound-studio] .ss-fx-drawer { border-top:1px solid var(--ss-stroke); margin-top:7px; padding-top:10px; display:grid; grid-template-columns:minmax(0,1fr) minmax(100px,150px); gap:10px 18px; align-items:start; }
[data-sound-studio] .ss-fx-drawer > .ss-muted { grid-column:1/-1; margin:0; font-size:12px; }
[data-sound-studio] .ss-fx-drawer .ss-parameter-flex { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,120px),1fr)); gap:10px 16px; min-width:0; }
[data-sound-studio] .ss-fx-schematic { margin:0; min-width:0; }
[data-sound-studio] .ss-fx-schematic figcaption { color:var(--ss-sub); font-size:11px; }
[data-sound-studio] .ss-fx-card[data-enabled=false] .ss-effect-preview { opacity:.5; }
[data-sound-studio] .ss-fx-close { grid-column:1/-1; justify-self:start; font-size:12px; }
[data-sound-studio] .ss-fx-preview-note { color:var(--ss-sub); font-size:12px; line-height:1.4; margin:8px 0 0; }
[data-sound-studio] .ss-curve text { fill:var(--ss-sub); font:10px system-ui,sans-serif; }
[data-sound-studio] .ss-frequency-controls { display:flex; flex-wrap:wrap; gap:5px; align-items:center; }
[data-sound-studio] .ss-frequency-controls small { flex-basis:100%; color:var(--ss-sub); }
[data-sound-studio] .ss-alert::before { content:"⚠ "; }
[data-sound-studio] .ss-envelope-legend { display:flex; flex-wrap:wrap; gap:6px 16px; font-size:12px; font-variant-numeric:tabular-nums; }
[data-sound-studio] .ss-envelope-legend span { white-space:nowrap; }
[data-sound-studio] .ss-instrument[data-quick=true] .ss-transport > small { display:none; }
[data-sound-studio] :is(.ss-project-details,.ss-save-help,.ss-audio-settings) { position:relative; font-size:12px; }
[data-sound-studio] :is(.ss-project-details,.ss-save-help,.ss-audio-settings,.ss-measurement-details,.ss-plot-details) > summary { cursor:pointer; min-height:28px; padding:5px 2px; color:var(--ss-sub); }
[data-sound-studio] summary:focus-visible { outline:2px solid var(--ss-accent); outline-offset:2px; }
[data-sound-studio] :is(.ss-project-details > div,.ss-save-help > p,.ss-audio-settings-body) { position:absolute; top:100%; right:0; width:min(300px,70vw); max-height:min(300px,45dvh); overflow:auto; z-index:9; display:grid; gap:8px; padding:10px; border:1px solid var(--ss-stroke); border-radius:7px; background:var(--ss-panel); box-shadow:0 10px 24px var(--ss-shadow-soft); font-size:12px; font-weight:400; }
[data-sound-studio] .ss-project-details > div { right:auto; left:0; }
[data-sound-studio] .ss-instrument-head > div { display:flex; flex-wrap:wrap; align-items:baseline; gap:3px 10px; }
[data-sound-studio] .ss-analysis-plain { color:var(--ss-sub); font-size:12px; }
[data-sound-studio] .ss-measurement-details { font-size:12px; color:var(--ss-sub); }
[data-sound-studio] .ss-output-details > summary { cursor:pointer; padding:6px 0; font-size:12px; color:var(--ss-sub); }
[data-sound-studio] .ss-output-details > section + section { margin-top:12px; }
[data-sound-studio] .ss-output-details > .ss-panel { padding:10px; }
[data-sound-studio] .ss-measurement-values { display:flex; flex-wrap:wrap; gap:4px 12px; padding:5px 0; }
[data-sound-studio] .ss-analysis-summary > .ss-measurement-details[open] { flex-basis:100%; }
[data-sound-studio] .ss-instrument > .ss-transport { display:grid; grid-template-columns:minmax(0,1fr); gap:2px; padding:4px 0; }
[data-sound-studio] .ss-transport-actions { display:flex; align-items:center; flex-wrap:wrap; gap:4px 8px; min-width:0; }
[data-sound-studio] .ss-transport .ss-transport-state { margin-left:0; font-size:11px; }
[data-sound-studio] .ss-audition-readiness { font-size:12px; color:var(--ss-sub); }
[data-sound-studio] .ss-audio-settings-body { right:auto; left:0; }
[data-sound-studio] .ss-transport .ss-audio-settings-body small { display:block; font-size:12px; }
[data-sound-studio] .ss-fx-list { display:flex; flex-direction:column; gap:5px; min-width:0; }
[data-sound-studio] .ss-fx-list > .ss-fx-card { display:block; padding:7px 10px; min-width:0; }
${ROUTING_CSS}
${ANALYSIS_CSS}

/* Focused tools retain full work surfaces and a bounded, scrollable body. */
.ss-focused-overlay { width:min(850px,96vw)!important; max-width:96vw!important; max-height:85dvh!important; display:flex!important; flex-direction:column; overflow:hidden; background:var(--ss-base)!important; color:var(--ss-ink); }
.ss-focused-overlay h2 { color:var(--ss-ink); }
.ss-focused-overlay > button[aria-label] { color:var(--ss-sub); }
.ss-focused-overlay > button[aria-label]:hover { color:var(--ss-ink); background:var(--ss-raised); }
.ss-focused-overlay [data-sound-studio].ss-overlay-body { flex:1; height:auto; min-height:0; max-height:70dvh; overflow:auto; background:var(--ss-base); padding:8px; }
.ss-focused-overlay .ss-canvas-viewport { height:50dvh; max-height:none; }
.ss-focused-overlay[data-kind=routing] { width:calc(100vw - 40px)!important; max-width:1800px!important; height:calc(100dvh - 40px); max-height:96dvh!important; }
.ss-focused-overlay[data-kind=routing] [data-sound-studio].ss-overlay-body { max-height:none; height:100%; overflow:hidden; }
.ss-focused-overlay[data-kind=routing] .ss-routing { display:grid; grid-template-columns:minmax(0,1fr) minmax(250px,28%); grid-template-rows:auto auto auto auto minmax(0,1fr) auto; height:100%; }
.ss-focused-overlay[data-kind=routing] .ss-routing > :is(.ss-muted,.ss-canvas-controls,.ss-route-selection,.ss-route-open) { grid-column:1 / -1; }
.ss-focused-overlay[data-kind=routing] .ss-canvas-viewport { grid-column:1; grid-row:5; height:100%; min-height:280px; }
.ss-focused-overlay[data-kind=routing] .ss-route-legend { grid-column:1; grid-row:6; }
.ss-focused-overlay[data-kind=routing] .ss-route-details { grid-column:2; grid-row:5 / span 2; max-height:none; }
.ss-focused-overlay[data-kind=analysis] { width:min(1100px,96vw)!important; }
.ss-focused-overlay[data-kind=analysis] .ss-plot { height:clamp(160px,35dvh,350px); }
.ss-focused-overlay .ss-analysis-explanation { margin-top:15px; color:var(--ss-sub); font-size:13px; }

/* Responsive state changes only: no alternate navigation or layout history. */
@container sonic-shell (max-width:1100px) {
 [data-sound-studio] .ss-workspace { grid-template-columns:minmax(0,1fr); }
 [data-sound-studio] .ss-workspace[data-inspector-open=true] { grid-template-columns:minmax(0,1fr) 236px; }
 [data-sound-studio] .ss-library { display:none; position:absolute; inset:0 auto 0 0; z-index:6; width:min(300px,90%); box-shadow:12px 0 30px var(--ss-shadow); }
 [data-sound-studio] .ss-workspace[data-library-open=true] .ss-library { display:block; }
}
@container sonic-shell (max-width:700px) {
 [data-sound-studio] .ss-shell { padding:8px; }
 [data-sound-studio] .ss-workspace[data-inspector-open=true], [data-sound-studio] .ss-workspace[data-library-open=false][data-inspector-open=true] { grid-template-columns:minmax(0,1fr) 236px; }
 [data-sound-studio] .ss-instrument { padding:7px 8px 0; }
 [data-sound-studio] .ss-preview-body { grid-template-columns:minmax(0,1fr); }
 [data-sound-studio] .ss-chord-row input, [data-sound-studio] .ss-chord-row > button { min-height:44px; }
}
@container sonic-shell (max-width:540px) {
 [data-sound-studio] .ss-workspace[data-inspector-open=true], [data-sound-studio] .ss-workspace[data-library-open=false][data-inspector-open=true] { grid-template-columns:minmax(0,1fr); grid-template-rows:minmax(480px,1fr) auto; }
 [data-sound-studio] .ss-inspector { overflow:visible; }
}
@container studio-editor (max-width:560px) {
 [data-sound-studio] .ss-analysis { max-height:min(194px,28dvh); }
 [data-sound-studio] .ss-analysis #ss-inline-analysis .ss-scope { height:126px; }
 [data-sound-studio] .ss-transport-actions .ss-primary { flex:1 1 220px; }
 [data-sound-studio] .ss-oscillator-bank, [data-sound-studio] .ss-module-grid { grid-template-columns:minmax(0,1fr); }
 [data-sound-studio] .ss-parameter-flex > * { flex-basis:145px; }
 [data-sound-studio] .ss-module-masonry { columns:1; }
 [data-sound-studio] .ss-matrix-row { grid-template-columns:minmax(0,1fr); }
}
@container effects-rack (max-width:600px) {
 [data-sound-studio] .ss-fx-header { grid-template-columns:12px 22px minmax(74px,1fr) minmax(120px,1fr) auto; grid-template-areas:"handle number name name state" ". . toggle edit moves"; gap:6px; }
 [data-sound-studio] .ss-fx-header .ss-fx-toggle { justify-self:start; }
 [data-sound-studio] .ss-fx-drawer { grid-template-columns:minmax(0,1fr); }
 [data-sound-studio] .ss-fx-drawer .ss-fx-schematic { width:min(180px,100%); }
}
@container effects-rack (max-width:360px) {
 [data-sound-studio] .ss-fx-header { grid-template-columns:12px minmax(0,1fr) auto; grid-template-areas:"handle name state" "number toggle moves" ". edit edit"; }
 [data-sound-studio] .ss-fx-edit { justify-self:start; }
}
@media(max-width:700px) {
 .ss-focused-overlay[data-kind=routing] [data-sound-studio].ss-overlay-body { overflow:auto; }
 .ss-focused-overlay[data-kind=routing] .ss-routing { display:flex; height:auto; }
 .ss-focused-overlay[data-kind=routing] .ss-canvas-viewport { height:52dvh; }
 .ss-focused-overlay[data-kind=routing] .ss-route-details { max-height:180px; }
 .ss-focused-overlay [data-sound-studio] .ss-preview-body { grid-template-columns:minmax(0,1fr); }
}
`;


