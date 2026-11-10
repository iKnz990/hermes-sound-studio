/** Fixed instrument workspace and shared precision controls. Scoped to this plugin. */
export const STUDIO_WORKSPACE_CSS = `
:is(.sound-workspace,[data-sound-studio],.ss-focused-overlay) {
 --ss-base:#0b0c0e; --ss-well:#0e1014; --ss-panel:#131519; --ss-raised:#1c1f26;
 --ss-primary:#55d9de; --ss-accent-hi:#55d9de; --ss-accent:var(--ss-accent-hi);
 --ss-sub:#9ba4b3; --ss-stroke:#ffffff12; --ss-ink:#e9edf3;
 --ss-mono:'JetBrains Mono','Geist Mono','Cascadia Code',Consolas,monospace;
 font-variant-numeric:tabular-nums;
}
[data-sound-studio] .ss-draft-level strong { font-family:var(--ss-mono); font-variant-numeric:tabular-nums; }
[data-sound-studio] .ss-instrument>.ss-transport { grid-template-columns:max-content 84px minmax(0,1fr); align-items:center; gap:8px; min-height:44px; }
[data-sound-studio] .ss-transport:focus-within .ss-audition-consent { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
[data-sound-studio] .ss-transport .ss-playback-position { display:grid; grid-template-rows:17px 3px; gap:4px; height:26px; min-width:0; padding:0; font-family:var(--ss-mono); }
[data-sound-studio] .ss-playback-position output { white-space:nowrap; text-align:right; font-size:10px; font-variant-numeric:tabular-nums; }
[data-sound-studio] .ss-playback-position .ss-playback-track { width:100%; height:3px; }
[data-sound-studio] .ss-playback-position[data-active=false] .ss-playback-track span { opacity:0; }
[data-sound-studio] .ss-draft-session { display:grid; gap:10px; }
[data-sound-studio] .ss-draft-review { padding:12px; max-height:none; overflow:visible; background:var(--ss-panel); border:0; border-radius:8px; box-shadow:0 8px 24px #0003; }
[data-sound-studio] .ss-draft-review>.ss-header-actions { position:sticky; bottom:-8px; z-index:3; background:var(--ss-panel); padding:10px 0 4px; border-top:1px solid #ffffff0a; }
[data-sound-studio] .ss-draft-session[data-ready=true]>textarea { min-height:54px; max-height:80px; }
[data-sound-studio] .ss-sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
[data-sound-studio] .ss-draft-name { display:flex; flex-wrap:wrap; justify-content:space-between; gap:8px; margin:0; }
[data-sound-studio] .ss-draft-name>span { color:var(--ss-sub); font-size:11px; }
[data-sound-studio] .ss-draft-features { display:flex; flex-wrap:wrap; gap:5px; margin:10px 0; }
[data-sound-studio] .ss-draft-features span { background:var(--ss-raised); padding:3px 7px; border-radius:12px; font-size:10px; color:var(--ss-primary); }
[data-sound-studio] .ss-draft-tabs { display:flex; flex-wrap:wrap; gap:4px; margin:8px 0; }
[data-sound-studio] .ss-draft-tabs button { border:0; background:transparent; font-size:11px; }
[data-sound-studio] .ss-draft-tabs button[aria-pressed=true] { background:var(--ss-raised); color:var(--ss-primary); }
[data-sound-studio] .ss-draft-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px 16px; margin:0; border:0; padding:8px 0 14px; }
[data-sound-studio] .ss-draft-fields:disabled { opacity:.55; }
[data-sound-studio] .ss-draft-voice { display:grid; gap:8px; padding:10px; background:var(--ss-well); border-radius:6px; }
[data-sound-studio] .ss-draft-detail { grid-column:1/-1; color:var(--ss-sub); font:11px var(--ss-mono); }
[data-sound-studio] .ss-draft-progress { color:var(--ss-primary); padding:8px 12px; border-left:2px solid var(--ss-primary); background:#55d9de08; }
[data-sound-studio] .ss-draft-manual { color:var(--ss-sub); font-size:11px; padding-top:8px; }
[data-sound-studio] .ss-draft-manual summary { cursor:pointer; padding:7px 0; }
@media(max-width:650px) {
 [data-sound-studio] .ss-instrument>.ss-transport { grid-template-columns:minmax(0,1fr) 84px; }
 [data-sound-studio] .ss-transport .ss-playback-position { grid-column:1/-1; }
 [data-sound-studio] .ss-draft-fields { grid-template-columns:minmax(0,1fr); }
}
.sound-workspace { max-height:100dvh; overflow:hidden; }
.sound-workspace>.cp-task-body { overflow:hidden; scrollbar-gutter:auto; }
[data-sound-studio] { height:100%; min-height:0; max-height:100dvh; overflow:hidden; }
[data-sound-studio]>.ss-shell { min-height:0; overflow:hidden; gap:8px; padding:10px; }
[data-sound-studio] .ss-workspace { flex:1; min-height:0; overflow:hidden; }
[data-sound-studio] .ss-instrument { overflow:hidden; }
[data-sound-studio] :is(.ss-editor-area,.ss-editor-content) { min-height:0; flex:1 1 0; }
[data-sound-studio] .ss-editor { min-height:0; }
[data-sound-studio] :is(.ss-instrument,.ss-library,.ss-inspector,.ss-panel,.ss-module-card,.ss-xy-pad,.ss-voice,.ss-module) {
 border:0; border-top:1px solid #ffffff14; background:var(--ss-panel); box-shadow:0 3px 9px #0003; border-radius:7px;
}
[data-sound-studio] .ss-module-card { padding:12px; }
[data-sound-studio] .ss-voice { background:var(--ss-well); }
[data-sound-studio] button { border-color:transparent; background:var(--ss-raised); }
[data-sound-studio] :is(button,summary):hover { background:#252a33; }
[data-sound-studio] :is(button[aria-pressed=true],button[aria-selected=true]) { color:var(--ss-accent); }
[data-sound-studio] :is(.ss-primary,.ss-topbar .ss-primary) { background:#55d9de17; border-color:#55d9de55; color:#81e8ec; }
[data-sound-studio] .ss-task-switcher button[aria-pressed=true] { border-bottom-color:var(--ss-accent); }
[data-sound-studio] :is(output,.ss-parameter-value,.ss-drag-value,.ss-analysis-readings,.ss-envelope-legend,.ss-voice-state,.ss-current,.ss-note-summary) { font-family:var(--ss-mono); font-variant-numeric:tabular-nums; }
[data-sound-studio] :is(.ss-duration-hint,.ss-gain-hierarchy,.ss-audition-consent) { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
[data-sound-studio] .ss-xy-pad>.ss-muted { display:none; }
[data-sound-studio] .ss-knob-control { min-width:78px; padding:6px; border:0; background:transparent; }
[data-sound-studio] .ss-knob-head { justify-content:center; font-size:11px; }
[data-sound-studio] .ss-knob-row { display:flex; flex-direction:column; gap:0; align-items:center; }
[data-sound-studio] .ss-knob { width:48px; height:48px; flex:none; }
[data-sound-studio] .ss-knob .ss-knob-active { stroke:var(--ss-accent); }
[data-sound-studio] .ss-parameter-value { display:block; min-width:0; width:auto; }
[data-sound-studio] .ss-parameter-value>span:first-child { display:none; }
[data-sound-studio] .ss-parameter-value>span { display:inline-flex; align-items:center; gap:3px; min-width:0; }
[data-sound-studio] .ss-parameter-readout { width:auto; min-width:52px; min-height:24px; padding:2px 5px; border:0; background:transparent; font:12px var(--ss-mono); }
[data-sound-studio] .ss-parameter-value input { max-width:105px; margin:0; padding:2px 5px; min-height:24px; font:12px var(--ss-mono); }
[data-sound-studio] .ss-input-hint { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); }
[data-sound-studio] .ss-input-error { display:block; max-width:180px; color:#ffb16c; font:11px var(--ss-font); }
[data-sound-studio] .ss-numeric-control { min-width:120px; padding:4px 0; }
[data-sound-studio] .ss-numeric-control .ss-control-head { flex-wrap:nowrap; min-height:26px; }
[data-sound-studio] .ss-numeric-amount { margin-left:auto; min-width:0; }
[data-sound-studio] .ss-range-track { position:relative; height:16px; margin-top:3px; border:1px solid #ffffff10; border-radius:4px; overflow:hidden; background:var(--ss-raised); }
[data-sound-studio] .ss-range-track::before { content:''; position:absolute; inset:0; left:var(--ss-fill-start); right:calc(100% - var(--ss-fill-end)); background:color-mix(in srgb,var(--ss-accent) 32%,transparent); border-right:2px solid var(--ss-accent); }
[data-sound-studio] .ss-range-track input[type=range] { appearance:none; position:relative; display:block; width:100%; height:14px; min-height:14px; margin:0; background:transparent; cursor:ew-resize; }
[data-sound-studio] .ss-range-track input::-webkit-slider-runnable-track { height:14px; background:transparent; border:0; }
[data-sound-studio] .ss-range-track input::-webkit-slider-thumb { appearance:none; width:3px; height:14px; margin:0; border:0; border-radius:0; background:var(--ss-accent); box-shadow:none; }
[data-sound-studio] .ss-numeric-control[data-bipolar=true] .ss-range-track input { height:14px; }
[data-sound-studio] .ss-numeric-control[data-bipolar=true] .ss-range-track::before { left:var(--ss-fill-start); right:calc(100% - var(--ss-fill-end)); top:0; height:100%; border-radius:0; background:color-mix(in srgb,var(--ss-accent) 32%,transparent); }
[data-sound-studio] .ss-numeric-control[data-bipolar=true] input::-webkit-slider-runnable-track { height:14px; }
[data-sound-studio] .ss-numeric-control[data-bipolar=true] input::-webkit-slider-thumb { width:3px; height:14px; margin:0; border:0; border-radius:0; background:var(--ss-accent); box-shadow:none; }
[data-sound-studio] .ss-range-labels { display:none; }
[data-sound-studio] .ss-zero-marker { top:0; height:100%; background:#ffffff45; }
[data-sound-studio] .ss-drag-value { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:3px 7px; min-width:64px; border-radius:5px; background:var(--ss-well); border-top:1px solid #ffffff10; position:relative; }
[data-sound-studio] .ss-drag-value>small:first-child { font:9px var(--ss-font); text-transform:uppercase; letter-spacing:.08em; color:var(--ss-sub); }
[data-sound-studio] .ss-drag-value>button { cursor:ns-resize; touch-action:none; user-select:none; border:0; min-height:23px; padding:1px 3px; background:transparent; font:12px var(--ss-mono); white-space:nowrap; }
[data-sound-studio] .ss-drag-value input { width:76px; min-height:23px; padding:1px 3px; font:12px var(--ss-mono); }
[data-sound-studio] .ss-osc-fine { display:grid; gap:4px; margin-top:6px; }
[data-sound-studio] .ss-osc-fine .ss-numeric-control { min-width:0; }
[data-sound-studio] :is(.ss-envelope-legend,.ss-env-curve,.ss-lfo-preview,[aria-label='LFO 1 rate and depth'],[aria-label='LFO 2 rate and depth'],[aria-label='Envelope stages']) { --ss-accent:#e8b85d; }
[data-sound-studio] .ss-interval-editor { --ss-accent:#55d9de; }
[data-sound-studio] .ss-voice { --ss-accent:#ad91ef; }
[data-sound-studio] .ss-xy-plane { min-height:120px; max-height:220px; border:0; }
[data-sound-studio] .ss-plane-target { filter:drop-shadow(0 0 6px #55d9de99); }
[data-sound-studio] .ss-live-scope { display:grid; grid-template-columns:120px 28px; align-items:center; gap:2px 5px; margin:0 6px; }
[data-sound-studio] .ss-live-scope canvas { border-radius:4px; background:var(--ss-well); }
[data-sound-studio] .ss-live-scope small { grid-column:1/-1; font:8px var(--ss-mono); color:var(--ss-sub); letter-spacing:.1em; }
[data-sound-studio] .ss-stereo-leds { display:grid; gap:4px; }
[data-sound-studio] .ss-stereo-leds i { display:block; height:9px; background:#222831; overflow:hidden; border-radius:1px; }
[data-sound-studio] .ss-stereo-leds i::before { content:''; display:block; width:var(--level,0%); height:100%; background:repeating-linear-gradient(90deg,#55d9de 0 3px,transparent 3px 4px); }
[data-sound-studio] .ss-stereo-leds i[data-clip=true]::before { background:#e53935; }
[data-sound-studio] .ss-transport { padding:5px 0; }
[data-sound-studio] .ss-transport-actions>button { min-width:32px; }
[data-sound-studio] .ss-studio-help { position:relative; }
[data-sound-studio] .ss-studio-help>summary { list-style:none; padding:4px 10px; background:var(--ss-raised); border-radius:5px; }
[data-sound-studio] .ss-studio-help>div { position:absolute; right:0; top:30px; width:min(360px,85vw); max-height:70dvh; overflow:auto; display:grid; gap:12px; padding:14px; background:#20252d; border:1px solid #ffffff18; border-radius:7px; box-shadow:0 12px 40px #0009; z-index:30; }
[data-sound-studio] .ss-musical-pitch { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }
[data-sound-studio] .ss-note-readout { font:11px var(--ss-mono); }
[data-sound-studio] .ss-draft-session { display:grid; gap:10px; padding:4px; }
[data-sound-studio] .ss-draft-session textarea { min-height:100px; }
[data-sound-studio] .ss-draft-session>button { justify-self:start; }
[data-sound-studio] .ss-desktop-target { display:grid; gap:5px; margin:8px 0; padding:9px; border-top:1px solid #ffffff14; background:var(--ss-well); border-radius:5px; }
[data-sound-studio] .ss-desktop-target>.ss-target-caption { font:8px var(--ss-mono); color:var(--ss-sub); letter-spacing:.12em; }
[data-sound-studio] .ss-desktop-target>strong { font-size:12px; color:var(--ss-accent); }
[data-sound-studio] .ss-desktop-target small { color:var(--ss-sub); font-size:10px; }
[data-sound-studio] .ss-target-actions { display:flex; gap:4px; flex-wrap:wrap; }
[data-sound-studio] .ss-target-actions button { padding:4px 6px; min-height:26px; font-size:10px; }
[data-compose]>.ss-shell { position:relative; }
[data-compose] .cp-session-context { display:flex; align-items:center; justify-content:space-between; flex:none; position:static; gap:10px; padding:6px 8px; border:0; border-top:1px solid #ffffff14; background:var(--ss-panel); }
[data-compose] .cp-transport { flex:none; flex-wrap:nowrap; }
[data-compose] .cp-actions { gap:5px; }
[data-compose] .cp-transport .cp-actions { flex-wrap:nowrap; }
[data-compose] .cp-transport button { min-width:28px; }
[data-compose] .cp-play { color:#55d9de; }
[data-compose] .cp-play[aria-pressed=true] { background:#55d9de22; }
[data-compose] .cp-ready-dot { width:5px; height:5px; background:#515b6b; border-radius:50%; }
[data-compose] .cp-ready-dot[data-playing=true] { background:#55d9de; box-shadow:0 0 6px #55d9de66; }
[data-compose] .cp-lcds { display:flex; align-items:stretch; gap:5px; }
[data-compose] .cp-export-actions { display:flex; align-items:center; gap:5px; }
[data-compose] .cp-arrangement-panel { flex:1 1 0; min-height:100px; display:flex; flex-direction:column; padding:8px; overflow:hidden; }
[data-compose] .cp-arrangement-panel>.ss-section-head { flex:none; margin-bottom:6px; }
[data-compose] .cp-arrangement { flex:1; max-height:none; min-height:0; border:0; border-radius:4px; scrollbar-width:thin; scrollbar-gutter:auto; }
[data-compose] .cp-ruler { grid-template-columns:220px minmax(0,1fr); }
[data-compose] .cp-arrangement-scale { padding-top:18px; }
[data-compose] .cp-arrangement-scale>span { padding:1px 6px; }
[data-compose] .cp-arrangement-scale .cp-arrangement-bar { border-left:1px solid #ffffff20; }
[data-compose] .cp-arrangement-beat[data-bar=true] { border-left:1px solid #ffffff20; }
[data-compose] .cp-ruler>span { color:var(--ss-sub); font-size:9px; letter-spacing:.12em; }
[data-compose] .cp-lane { border-left-width:2px; border-bottom:1px solid #ffffff09; }
[data-compose] .cp-track { position:sticky; padding:5px 10px 5px 7px; gap:3px; border-right:0; background:var(--ss-panel); }
[data-compose] .cp-track[data-selected=true] { border-left:0; background:#1a2028; }
[data-compose] .cp-track-top { display:flex; align-items:center; gap:3px; }
[data-compose] .cp-track-select { flex:1; background:transparent; border:0; padding:1px 3px; min-height:28px; gap:0; }
[data-compose] .cp-track-select strong { font-size:11px; }
[data-compose] .cp-track-select small { font-size:9px; white-space:nowrap; text-overflow:ellipsis; overflow:hidden; }
[data-compose] .cp-track-controls { flex-wrap:nowrap; gap:3px; }
[data-compose] .cp-track-controls>button { min-height:22px; padding:2px 5px; font:10px var(--ss-mono); }
[data-compose] .cp-track-controls .ss-drag-value { min-width:60px; padding:0 3px; }
[data-compose] .cp-track-controls .ss-knob-control { min-width:46px; padding:0; display:grid; grid-template-columns:20px 1fr; align-items:center; gap:2px; }
[data-compose] .cp-track-controls .ss-knob-head { font-size:8px; }
[data-compose] .cp-track-controls .sonic-help-trigger { display:none; }
[data-compose] .cp-track-controls .ss-knob { width:24px; height:24px; }
[data-compose] .cp-track-controls .ss-knob svg { width:24px; height:24px; }
[data-compose] .cp-track-controls .ss-parameter-readout { font-size:8px; padding:0; min-width:24px; min-height:10px; }
[data-compose] .cp-track-controls .ss-knob-row { gap:0; }
[data-compose] .cp-clips { min-height:112px; background:repeating-linear-gradient(90deg,transparent 0,transparent calc(var(--cp-bar-width) - 1px),#ffffff15 calc(var(--cp-bar-width) - 1px),#ffffff15 var(--cp-bar-width)),repeating-linear-gradient(90deg,transparent 0,transparent calc(var(--cp-beat-width) - 1px),#ffffff05 calc(var(--cp-beat-width) - 1px),#ffffff05 var(--cp-beat-width)); }
[data-compose] .cp-note [data-compose-body] { background:color-mix(in srgb,var(--cp-layer-color) 25%,#14181e); border:0; border-top:1px solid color-mix(in srgb,var(--cp-layer-color) 70%,transparent); color:var(--cp-layer-color); }
[data-compose] .cp-playhead { width:1px; background:#9cfcff; box-shadow:0 0 6px #55d9de99; z-index:3; }
[data-compose] .cp-track-meter { position:absolute; right:2px; top:6px; bottom:6px; width:4px; background:#232830; border-radius:1px; overflow:hidden; }
[data-compose] .cp-track-meter i { position:absolute; bottom:0; width:100%; height:var(--level,0%); background:linear-gradient(0deg,#55d9de 0 75%,#e8b85d 90%); }
[data-compose] .cp-track-meter[data-clip=true] i { background:#e53935; }
[data-compose] .cp-track-menu { position:relative; }
[data-compose] .cp-track-menu summary { list-style:none; cursor:pointer; padding:0 4px; opacity:.4; }
[data-compose] .cp-track:is(:hover,:focus-within) .cp-track-menu summary { opacity:1; }
[data-compose] .cp-track-menu>div { position:absolute; z-index:20; top:0; left:18px; width:178px; display:grid; gap:4px; padding:6px; background:#20252d; border:1px solid #ffffff18; box-shadow:0 8px 22px #0009; border-radius:5px; }
[data-compose] .ss-danger { color:#ff7c76; }
[data-compose] .cp-add-row { display:grid; grid-template-columns:220px 1fr; min-height:34px; background:#12161b; }
[data-compose] .cp-add-row>small { padding:8px 12px; font-size:10px; color:var(--ss-sub); }
[data-compose] .cp-add-menu { position:sticky; left:0; background:var(--ss-panel); z-index:5; }
[data-compose] .cp-add-menu>summary { cursor:pointer; padding:8px 12px; list-style:none; color:var(--ss-accent); font-size:11px; }
[data-compose] .cp-add-menu>div { position:absolute; left:4px; bottom:100%; padding:8px; width:210px; display:grid; gap:6px; border:1px solid #ffffff18; background:#20252d; box-shadow:0 8px 22px #0009; border-radius:5px; }
[data-compose] .cp-editing-dock { flex:0 0 46%; min-height:0; display:flex; align-items:stretch; position:relative; overflow:visible; }
[data-compose] .cp-editing-dock[data-grid-open=false] { flex:0 0 38px; }
[data-compose] .cp-grid-panel { flex:1; display:flex; flex-direction:column; min-height:0; overflow:hidden; padding:7px 8px; }
[data-compose] .cp-grid-panel>.ss-section-head { flex:none; margin:0 0 5px; }
[data-compose] .cp-drawer-toggle { font-size:12px; background:transparent; min-height:23px; padding:0 4px; color:var(--cp-layer-color); }
[data-compose] .cp-layer-name { font-size:10px; }
[data-compose] .cp-layer-name input { width:130px; min-height:23px; padding:1px 5px; font-size:11px; }
[data-compose] .cp-grid-content { min-height:0; flex:1; display:flex; flex-direction:column; }
[data-compose] .cp-entry { flex:1; min-height:0; display:grid; grid-template-columns:minmax(0,1fr) 190px; grid-template-rows:minmax(0,1fr); align-items:stretch; gap:8px; margin:0; overflow:hidden; }
[data-compose] .cp-grid-area { display:flex; flex-direction:column; min-height:0; height:100%; gap:4px; overflow:hidden; }
[data-compose] .cp-grid-toolbar { flex:none; flex-wrap:nowrap; min-height:32px; }
[data-compose] .cp-grid-toolbar .ss-drag-value { flex-direction:row; gap:6px; min-width:0; }
[data-compose] .cp-grid-toolbar select { width:100px; min-height:27px; font-size:11px; padding:2px 5px; }
[data-compose] .cp-grid-toolbar button { font-size:10px; min-height:27px; padding:2px 5px; }
[data-compose] .cp-grid-toolbar>small { margin-left:auto; font:10px var(--ss-mono); color:var(--ss-sub); }
[data-compose] .cp-grid-scroll { flex:1; min-height:0; max-height:none; border:0; border-radius:3px; scrollbar-width:thin; scrollbar-gutter:auto; }
[data-compose] .cp-grid { position:relative; background:transparent; }
[data-compose] .cp-grid>span { border-bottom:1px solid #ffffff07; border-right:0; }
[data-compose] .cp-grid .cp-grid-bar { height:20px; border-left:1px solid #ffffff20; }
[data-compose] .cp-grid .cp-grid-subdivision { height:18px; top:20px; font-size:9px; }
[data-compose] .cp-grid .cp-grid-corner { height:20px; }
[data-compose] .cp-grid .cp-grid-beat-label { top:20px; height:18px; font-size:8px; }
[data-compose] .cp-grid .cp-grid-pitch { height:22px; font-size:9px; background:#252b34; color:#ccd3de; border-right:5px solid #35404c; }
[data-compose] .cp-grid .cp-grid-pitch[data-black=true] { background:#0a0c10; color:#7c899c; border-right:10px solid #0a0c10; }
[data-compose] .cp-grid button { height:22px; min-height:22px; border-right:1px solid #ffffff04; border-bottom:1px solid #ffffff05; background:#171c23; }
[data-compose] .cp-grid button[data-black=true] { background:#11151b; }
[data-compose] .cp-grid [data-outscale=true] { opacity:.5; }
[data-compose] .cp-grid [data-bar=true] { border-left:1px solid #ffffff20; }
[data-compose] .cp-grid-body { background:color-mix(in srgb,var(--cp-layer-color) 45%,#20232d); border:0; border-radius:2px; top:3px; bottom:3px; }
[data-compose] .cp-grid-body[data-note-onset=true] { border-left:2px solid var(--cp-layer-color); }
[data-compose] .cp-grid-playhead { position:absolute; top:38px; bottom:0; width:1px; pointer-events:none; z-index:4; background:#9cfcff; box-shadow:0 0 6px #55d9de66; }
[data-compose] .cp-note-editor { display:flex; flex-direction:column; min-height:0; overflow:auto; border:0; padding:6px; gap:5px; background:#101318; scrollbar-width:thin; }
[data-compose] .cp-note-editor h3 { font:10px var(--ss-mono); color:var(--cp-layer-color); }
[data-compose] .cp-note-editor .ss-numeric-control { width:100%; min-width:0; }
[data-compose] .cp-note-editor .ss-control-head label { font-size:10px; }
[data-compose] .cp-note-editor .cp-note-summary { font-size:9px; }
[data-compose] .cp-note-editor .ss-muted { font-size:11px; }
[data-compose] .cp-velocity-lane { flex:none; height:40px; display:grid; grid-template-columns:52px 1fr; border-top:1px solid #ffffff12; background:#101419; overflow:hidden; }
[data-compose] .cp-velocity-scroll { flex:none; height:40px; overflow:hidden; }
[data-compose] .cp-velocity-lane>span { align-self:center; padding-left:9px; font:9px var(--ss-mono); color:#e8b85d; }
[data-compose] .cp-velocity-lane>div { position:relative; }
[data-compose] .cp-velocity-lane input[type=range] { appearance:none; writing-mode:vertical-lr; direction:rtl; position:absolute; bottom:3px; width:7px; height:34px; min-height:0; margin:0; background:linear-gradient(0deg,#e8b85d var(--velocity),#282c33 var(--velocity)); border:0; border-radius:1px; cursor:ns-resize; }
[data-compose] .cp-velocity-lane input::-webkit-slider-thumb { appearance:none; width:9px; height:3px; background:#ffe2a1; border-radius:0; }
[data-compose] .cp-editor-anchor { position:absolute; right:0; bottom:0; width:min(480px,90%); height:min(620px,75dvh); z-index:12; overflow:auto; box-shadow:-12px -12px 40px #0008; border-radius:8px; background:var(--ss-panel); }
[data-compose] .cp-editor-anchor .cp-drawer { border:0; padding:12px; }
[data-compose] .cp-statusbar { flex:none; display:flex; gap:12px; justify-content:space-between; min-width:0; padding:0 4px; font:10px var(--ss-mono); color:var(--ss-sub); height:16px; }
[data-compose] .cp-statusbar>span { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
[data-compose] .cp-statusbar>span:last-child { flex:none; }
[data-compose] .cp-help-pop { position:absolute; top:70px; right:12px; z-index:25; width:min(380px,90%); max-height:70%; overflow:auto; padding:14px; display:grid; gap:12px; background:#20252d; border:1px solid #ffffff20; border-radius:8px; box-shadow:0 12px 40px #0009; font-size:12px; }
[data-compose] .cp-loop-brace { position:absolute; top:0; left:0; right:0; height:18px; cursor:ew-resize; }
[data-compose] .cp-seek-target { position:absolute; inset:0; width:100%; min-height:0; height:18px; border:0; padding:0; background:transparent; cursor:ew-resize; touch-action:none; z-index:1; }
[data-compose] .cp-seek-target:hover { background:#55d9de09; }
[data-compose] .cp-loop-region { position:absolute; top:2px; height:12px; border-top:2px solid #55d9de; background:#55d9de12; pointer-events:none; }
[data-compose] .cp-loop-handle { position:absolute; top:0; bottom:0; min-height:0; padding:0; width:14px; border:0; background:#55d9de; color:#0b0c0e; border-radius:2px; font-size:12px; touch-action:none; cursor:ew-resize; z-index:3; }
[data-compose] .cp-loop-end { transform:translateX(-100%); }
[data-compose] .cp-ruler-position { position:absolute; top:14px; width:1px; height:34px; background:#9cfcff; pointer-events:none; z-index:2; }
@container sonic-shell (max-width:850px) {
 [data-compose] .cp-session-context { gap:5px; overflow-x:auto; }
 [data-compose] .cp-lcds { gap:3px; }
 [data-compose] .cp-lcds .ss-drag-value { min-width:55px; padding-inline:4px; }
 [data-compose] .cp-export-actions { flex:none; }
 [data-compose] .cp-entry { grid-template-columns:minmax(0,1fr) 150px; }
 [data-compose] .cp-grid-toolbar>small { display:none; }
 [data-sound-studio] .ss-live-scope { grid-template-columns:120px 20px; }
}
@container sonic-shell (max-width:600px) {
 [data-compose] .cp-entry { grid-template-columns:minmax(0,1fr); }
 [data-compose] .cp-note-editor { display:none; }
 [data-compose] .cp-layer-name { display:none; }
 [data-compose] .cp-grid-toolbar { overflow-x:auto; }
 [data-compose] .cp-grid-toolbar>* { flex:none; }
 [data-compose] .cp-statusbar>span:last-child { display:none; }
 [data-sound-studio] .ss-save-status { display:none; }
}
@media(max-height:650px) {
 [data-sound-studio]>.ss-shell { padding:6px; gap:5px; }
 [data-compose] .cp-editing-dock { flex-basis:44%; }
 [data-compose] .cp-arrangement-panel>.ss-section-head { margin-bottom:3px; }
 [data-compose] .cp-grid-toolbar .ss-drag-value>small:first-child { display:none; }
}
`;
