import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

function hasInteractiveHelp(children:React.ReactNode):boolean {
  return React.Children.toArray(children).some(child=>{
    if(!React.isValidElement<{children?:React.ReactNode;tabIndex?:number;contentEditable?:unknown;role?:string}>(child))return false;
    return (typeof child.type==='string'&&['a','button','input','select','textarea','details','summary','iframe','audio','video'].includes(child.type)) || (typeof child.type!=='string'&&child.type!==React.Fragment) || (child.props.tabIndex!==undefined&&child.props.tabIndex>=0) || !!child.props.contentEditable || !!child.props.role || hasInteractiveHelp(child.props.children);
  });
}

/** Complete contextual help. Interactive supplied content uses a nonmodal dialog, never a tooltip. */
export function HelpTip({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  const domId=`${id}-${useId()}`;
  const interactive=hasInteractiveHelp(children);
  const root = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const open = !dismissed && (hovered || focused || pinned);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const node=bubble.current;
      if(!node)return;
      // Rects are viewport pixels; fixed offsets and size limits are CSS-zoom local.
      // Browser chrome zoom already changes CSS viewport units and is not CSS zoom.
      const scale=(node as HTMLElement & {currentCSSZoom?:number}).currentCSSZoom||1;
      node.style.maxWidth=`${Math.max(1,Math.min(220,(window.innerWidth-24)/scale))}px`;
      node.style.maxHeight=`${Math.max(1,(window.innerHeight-24)/scale)}px`;
      const anchor = button.current?.getBoundingClientRect();
      const tip = node.getBoundingClientRect();
      if (!anchor || !tip.width || !tip.height) return;
      const left = Math.max(12, Math.min(anchor.left, window.innerWidth - tip.width - 12));
      const preferredTop = anchor.bottom + tip.height <= window.innerHeight - 12 ? anchor.bottom : anchor.top - tip.height;
      const top = Math.max(12, Math.min(preferredTop, window.innerHeight - tip.height - 12));
      setPosition({ left:left/scale, top:top/scale });
    };
    place();
    // Hidden/open and font/layout changes can otherwise leave a zero-size placement.
    const observer=new ResizeObserver(place);
    if(bubble.current)observer.observe(bubble.current);
    if(button.current)observer.observe(button.current);
    window.addEventListener('resize', place);
    // Capture also observes the native host's scrolling pane, not only window scroll.
    document.addEventListener('scroll', place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', place, true);
    };
  }, [open, children]);

  useEffect(() => {
    if (!open) return;
    const dismiss = () => { setPinned(false); setDismissed(true); };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) dismiss();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); button.current?.focus(); dismiss(); }
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open]);

  // Never summarize caller-supplied help: range, consent and timing caveats remain intact.
  return <span className="sonic-help" ref={root}
    onPointerEnter={event => { if (event.pointerType !== 'touch') { setHovered(true); setDismissed(false); } }}
    onPointerLeave={event => { if (event.pointerType !== 'touch') setHovered(false); }}
    onFocus={() => { setFocused(true); setDismissed(false); }}
    onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setFocused(false); setPinned(false); setDismissed(false);
      }
    }}>
    <button ref={button} type="button" className="sonic-help-trigger" aria-label={`About ${label}`}
      aria-describedby={interactive?undefined:domId} aria-controls={domId} aria-expanded={open} aria-haspopup={interactive?'dialog':undefined}
      onClick={() => {
        if (pinned) { setPinned(false); setDismissed(true); }
        else { setPinned(true); setDismissed(false); }
      }}><span aria-hidden="true">?</span></button>
    <span id={domId} ref={bubble} role={interactive?'dialog':'tooltip'} aria-label={interactive?`${label} help`:undefined} tabIndex={open?0:-1} className="sonic-tooltip" hidden={!open} style={position}>
      {children}
    </span>
  </span>;
}

export function FieldHeading({ id, label, help, value }: { id: string; label: string; help: string; value?: React.ReactNode }) {
  return <div className="sonic-field-heading">
    <label htmlFor={id}>{label}</label>
    <HelpTip id={`${id}-help`} label={label}>{help}</HelpTip>
    {value !== undefined && <output htmlFor={id}>{value}</output>}
  </div>;
}

export const HELP_CSS = `
[data-sonic-studio] .sonic-help { display:inline-flex; flex-shrink:0; }
[data-sonic-studio] .sonic-help-trigger { width:24px; min-height:24px; height:24px; padding:0; border-radius:50%; color:var(--sonic-subtle); font-size:.75rem; line-height:1; }
[data-sonic-studio] .sonic-tooltip,[data-sound-studio] .sonic-tooltip { position:fixed; z-index:1000; display:block; width:max-content; max-width:min(220px,calc(100vw - 24px)); max-height:calc(100vh - 24px); box-sizing:border-box; overflow:auto; overscroll-behavior:contain; padding:8px 10px; border:1px solid #693342; border-radius:7px; background:#1a0d12; color:#f7e7eb; font-size:12px; font-weight:400; line-height:1.35; text-align:left; white-space:normal; overflow-wrap:anywhere; box-shadow:0 8px 24px rgba(0,0,0,.56); }
[data-sound-studio] .sonic-help { display:inline-flex; flex-shrink:0; }
[data-sound-studio] .sonic-help-trigger { width:24px; min-height:24px; height:24px; padding:0; border-radius:50%; border:1px solid var(--ss-stroke); background:var(--ss-raised); color:var(--ss-sub); font-size:12px; line-height:1; }
[data-sound-studio] .sonic-help-trigger:focus-visible { outline:2px solid var(--ui-accent,#ff6685); outline-offset:2px; }
[data-sound-studio] .sonic-tooltip[hidden] { display:none; }
[data-sonic-studio] .sonic-tooltip[hidden] { display:none; }
[data-sonic-studio] .sonic-field-heading { display:flex; align-items:center; gap:6px; min-height:28px; font-size:.8rem; }
[data-sonic-studio] .sonic-field-heading label { display:block; }
[data-sonic-studio] .sonic-field-heading output { margin-left:auto; color:var(--sonic-accent); font-variant-numeric:tabular-nums; white-space:nowrap; }
[data-sonic-studio] .sonic-field { min-width:0; display:grid; gap:5px; }
[data-sonic-studio] details.sonic-panel > summary { cursor:pointer; color:var(--ui-text-primary); }
[data-sonic-studio] details.sonic-panel > summary h2 { display:inline; margin:0; }
[data-sonic-studio] details.sonic-panel > summary .sonic-muted { display:block; margin:6px 0 0 18px; }
[data-sonic-studio] summary:focus-visible { outline:2px solid var(--sonic-accent); outline-offset:5px; border-radius:3px; }
[data-sonic-studio] .sonic-details-body { padding-top:16px; }
`;
