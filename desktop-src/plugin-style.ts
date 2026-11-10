import { HELP_CSS } from './help';
import { STUDIO_CSS } from './studio-style';
import { STUDIO_ANALYSIS_CSS } from './studio-analysis-style';
import { STUDIO_VISUAL_CONTROLS_CSS } from './studio-visual-controls-style';
import { STUDIO_CONFIRMATION_CSS } from './studio-confirmation-style';
import { COMPOSE_CSS } from './compose-style';
import { COMPOSE_SOUND_EDITOR_CSS } from './compose-sound-editor-style';
import { STUDIO_WORKSPACE_CSS } from './studio-workspace-style';

/** Head-mounted once by the plugin. Tokens also reach standalone roots and portals. */
export const SONIC_UI_CSS = `${HELP_CSS}
/* Shared Utility Dark tokens: explicit client palette, independent of host hue. */
:is(.sound-workspace,[data-sound-studio],[data-compose],[data-sonic-studio],.ss-focused-overlay,[data-sonic-chip]) {
 --ss-base:#050505; --ss-well:#050505; --ss-panel:#0F0F0F; --ss-raised:#191919;
 --ss-primary:#990001; --ss-sub:#B3B3B3; --ss-stroke:#24242E; --ss-ink:#F5F5F5;
 --ss-accent-hi:#FF8A8C; --ss-accent:var(--ss-accent-hi);
 --ss-shadow:#0009; --ss-shadow-soft:#0006;
 --sonic-stroke:var(--ss-stroke); --sonic-subtle:var(--ss-sub); --sonic-faint:var(--ss-sub); --sonic-accent:var(--ss-accent);
 --ss-font:var(--ui-font-sans,system-ui,sans-serif); --ss-mono:var(--ui-font-mono,ui-monospace,monospace);
 color:var(--ss-ink); background:var(--ss-base); font:13px/1.45 var(--ss-font); color-scheme:dark;
}
:is([data-sound-studio],[data-compose],[data-sonic-studio]) { container:sonic-shell / inline-size; min-width:0; }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) *,
:is([data-sound-studio],[data-compose],[data-sonic-studio]) *::before,
:is([data-sound-studio],[data-compose],[data-sonic-studio]) *::after { box-sizing:border-box; }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) [hidden] { display:none!important; }
/* One task/document/action bar; the task body, never a nested header, owns scroll. */
.sound-workspace { height:100%; min-height:0; min-width:0; display:flex; flex-direction:column; overflow:hidden; }
.sound-workspace > .cp-task-body { flex:1; min-height:0; min-width:0; overflow:auto; overscroll-behavior:contain; scrollbar-gutter:stable; }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) > .ss-topbar { min-height:44px; flex:0 0 auto; display:flex; align-items:center; flex-wrap:wrap; gap:4px 16px; padding:4px 12px; border-bottom:1px solid var(--ss-stroke); background:var(--ss-panel); position:relative; z-index:8; }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) .ss-topbar button { font:inherit; color:var(--ss-ink); cursor:pointer; min-height:30px; padding:4px 8px; border:1px solid var(--ss-stroke); border-radius:5px; background:var(--ss-raised); }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) .ss-topbar .ss-primary { background:var(--ss-primary); border-color:var(--ss-primary); color:var(--ss-ink); font-weight:650; }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) .ss-topbar .ss-segment { display:inline-flex; gap:2px; padding:2px; border:1px solid var(--ss-stroke); border-radius:5px; background:var(--ss-well); }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) .ss-topbar .ss-segment button { background:transparent; border-color:transparent; }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) .ss-topbar .ss-segment button[aria-pressed=true] { border-color:var(--ss-primary); background:var(--ss-raised); }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) .ss-task-switcher { display:flex; align-items:stretch; flex:0 1 auto; min-width:0; max-width:100%; overflow-x:auto; scrollbar-width:thin; gap:4px; }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) .ss-task-switcher button { flex:0 0 auto; min-height:34px; padding:5px 10px; border:0; border-bottom:2px solid transparent; border-radius:0; background:transparent; color:var(--ss-sub); white-space:nowrap; font-size:12px; }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) .ss-task-switcher button[aria-pressed=true] { color:var(--ss-ink); border-bottom-color:var(--ss-primary); box-shadow:none; }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) .ss-document { display:flex; flex:1 1 180px; min-width:0; align-items:center; flex-wrap:wrap; gap:4px 8px; }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) .ss-document-name { min-width:0; max-width:240px; overflow-wrap:anywhere; font-size:13px; font-weight:600; }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) input.ss-document-name { width:clamp(100px,16cqi,240px); min-height:30px; padding:3px 6px; }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) .ss-save-status { color:var(--ss-sub); font-size:11px; max-width:240px; overflow-wrap:anywhere; }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) .ss-save-status small { display:block; font-size:11px; font-weight:400; }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) .ss-save-status[data-unsaved=true] { border-left:3px solid var(--ss-primary); padding-left:6px; color:var(--ss-ink); }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) .ss-topbar-actions { display:flex; flex:0 1 auto; min-width:0; max-width:100%; align-items:center; flex-wrap:wrap; gap:4px; margin-left:auto; }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) .ss-topbar :is(button,summary) { font:inherit; cursor:pointer; }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) .ss-document-menu { position:relative; }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) .ss-document-menu > summary { list-style:none; padding:5px 9px; border:1px solid var(--ss-stroke); border-radius:5px; background:var(--ss-raised); color:var(--ss-ink); }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) .ss-document-menu > summary::-webkit-details-marker { display:none; }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) .ss-menu-pop { position:absolute; top:calc(100% + 6px); right:0; z-index:30; width:min(310px,calc(100vw - 24px)); max-height:min(420px,70dvh); overflow:auto; display:grid; gap:8px; padding:12px; border:1px solid var(--ss-stroke); border-radius:7px; background:var(--ss-panel); box-shadow:0 12px 30px var(--ss-shadow); }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) :is(button,input,select,textarea,summary,[tabindex]):focus-visible { outline:2px solid var(--ss-accent-hi); outline-offset:2px; }
/* Shared help adapts the unchanged helper's legacy colors to the same palette. */
:is([data-sound-studio],[data-compose],[data-sonic-studio]) .sonic-tooltip { border-color:var(--ss-stroke); background:var(--ss-panel); color:var(--ss-ink); }
:is([data-sound-studio],[data-compose],[data-sonic-studio]) .sonic-help-trigger:focus-visible { outline-color:var(--ss-accent-hi); }
[data-sonic-studio] details.sonic-panel > summary { color:var(--ss-ink); }
/* Compact audio status chip: activity is data-driven, not a decorative pulse loop. */
[data-sonic-chip] { display:inline-flex; align-items:center; gap:6px; background:transparent; font-size:11px; }
[data-sonic-chip] button { font:inherit; padding:1px 5px; border:1px solid var(--ss-stroke); border-radius:4px; color:var(--ss-ink); background:var(--ss-panel); cursor:pointer; }
[data-sonic-chip] button:focus-visible { outline:2px solid var(--ss-accent-hi); outline-offset:2px; }
[data-sonic-chip] .sonic-chip-led { width:6px; height:6px; border-radius:50%; flex:0 0 auto; background:var(--ss-stroke); transition:background 90ms linear,box-shadow 90ms linear; }
[data-sonic-chip][data-active=true] .sonic-chip-led, [data-sonic-chip] .sonic-chip-led[data-active=true] { background:var(--ss-accent-hi); box-shadow:0 0 calc(2px + 6px * var(--sonic-energy,0)) var(--ss-primary); }
[data-sonic-chip] .sonic-chip-count { color:var(--ss-sub); font:11px var(--ss-mono); font-variant-numeric:tabular-nums; }
[data-sonic-chip] .sonic-chip-mute { color:var(--ss-sub); }
${STUDIO_CSS}
${STUDIO_ANALYSIS_CSS}
${STUDIO_VISUAL_CONTROLS_CSS}
${STUDIO_CONFIRMATION_CSS}
${COMPOSE_CSS}
${COMPOSE_SOUND_EDITOR_CSS}
${STUDIO_WORKSPACE_CSS}
/* Container width is the contract: a narrow pane in a wide host reflows too. */
@container sonic-shell (max-width:1000px) {
 :is([data-sound-studio],[data-compose],[data-sonic-studio]) > .ss-topbar { gap:4px 10px; }
 :is([data-sound-studio],[data-compose],[data-sonic-studio]) .ss-task-switcher { flex:1 1 100%; }
 :is([data-sound-studio],[data-compose],[data-sonic-studio]) .ss-document { flex:1 1 200px; }
}
@container sonic-shell (max-width:480px) {
 :is([data-sound-studio],[data-compose],[data-sonic-studio]) > .ss-topbar { padding:4px 8px; }
 :is([data-sound-studio],[data-compose],[data-sonic-studio]) .ss-document { flex-basis:100%; }
 :is([data-sound-studio],[data-compose],[data-sonic-studio]) .ss-topbar-actions { margin-left:0; flex:1 1 100%; }
 :is([data-sound-studio],[data-compose],[data-sonic-studio]) .ss-menu-pop { left:0; right:auto; max-width:calc(100cqi - 16px); }
}
@media (prefers-reduced-motion:reduce) {
 :is([data-sound-studio],[data-compose],[data-sonic-studio],.ss-focused-overlay,[data-sonic-chip]) *,
 :is([data-sound-studio],[data-compose],[data-sonic-studio],.ss-focused-overlay,[data-sonic-chip]) *::before,
 :is([data-sound-studio],[data-compose],[data-sonic-studio],.ss-focused-overlay,[data-sonic-chip]) *::after { animation:none!important; transition:none!important; scroll-behavior:auto!important; }
 [data-sonic-chip][data-active=true] .sonic-chip-led, [data-sonic-chip] .sonic-chip-led[data-active=true] { box-shadow:none; }
}
`;
