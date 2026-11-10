export const COMPOSE_SOUND_EDITOR_CSS=`
[data-compose] .cp-sound-editor{container:compose-sound-editor / inline-size;min-width:0;max-width:100%;max-height:min(80vh,760px);display:flex;flex-direction:column;gap:12px;scroll-margin-top:96px}
[data-compose] .cp-sound-editor .cp-drawer-head{align-items:start}
[data-compose] .cp-sound-editor .cp-editor-identity{flex:1;min-width:180px}
[data-compose] .cp-sound-editor .cp-editor-identity h2{margin:2px 0 4px}
[data-compose] .cp-sound-editor .cp-editor-identity p{margin:0;max-width:80ch}
[data-compose] .cp-sound-editor .cp-pattern-context{margin:0;padding:10px 12px;border-left:3px solid var(--ss-accent);border-radius:4px;background:var(--ss-well);color:var(--ss-ink);line-height:1.5;max-width:100%;overflow-wrap:anywhere}
[data-compose] .cp-sound-editor .cp-editor-controls{display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap}
[data-compose] .cp-sound-editor .cp-editor-name{display:grid;gap:4px;flex:1;min-width:160px;max-width:480px;color:var(--ss-sub)}
[data-compose] .cp-sound-editor .cp-editor-name input{min-width:0;width:100%;box-sizing:border-box;color:var(--ss-ink)}
[data-compose] .cp-sound-editor .cp-editor-tabs{gap:6px}
[data-compose] .cp-sound-editor .cp-editor-tabs button[aria-pressed=true]{border-color:var(--ss-accent);color:var(--ss-ink);background:color-mix(in srgb,var(--ss-accent) 16%,var(--ss-panel))}
[data-compose] .cp-sound-editor .cp-editor-content{flex:1;min-height:160px;min-width:0;max-height:min(52vh,560px);overflow:auto;overscroll-behavior:auto;scrollbar-gutter:stable;padding:2px 4px 8px 0}
[data-compose] .cp-sound-editor .cp-beginner-sound{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(220px,1fr);gap:18px;align-items:start}
[data-compose] .cp-sound-editor .cp-beginner-sound h3{margin:0 0 6px}
[data-compose] .cp-sound-editor .cp-beginner-sound p{margin:0 0 10px}
[data-compose] .cp-sound-editor .cp-beginner-intensity{min-width:0;padding:12px;border:1px solid var(--ss-stroke);border-radius:8px;background:var(--ss-well)}
[data-compose] .cp-sound-editor .cp-beginner-intensity p{margin:8px 0 0}
[data-compose] .cp-sound-editor .ss-style-row{display:flex;gap:6px;flex-wrap:wrap}
[data-compose] .cp-sound-editor .ss-synthesis-layout{grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))}
[data-compose] .cp-sound-editor .ss-module-grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))}
@container compose-sound-editor (max-width:700px){
 [data-compose] .cp-sound-editor .cp-beginner-sound{grid-template-columns:minmax(0,1fr);gap:12px}
 [data-compose] .cp-sound-editor .cp-editor-controls{align-items:start}
 [data-compose] .cp-sound-editor .cp-editor-content{max-height:min(48vh,440px)}
}
`;
