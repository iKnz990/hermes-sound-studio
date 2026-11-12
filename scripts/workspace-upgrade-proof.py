"""Exact bundle, simulated SDK/Dialog, private storage, real WebAudio, muted Chromium."""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
import json,threading,sys,traceback,hashlib,os
from browser_support import browser_options
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'evidence/workspace-upgrade'
OUT.mkdir(parents=True,exist_ok=True)
BUILD=json.loads((ROOT/'evidence/browser/build.json').read_text())
REPORT={'boundary':BUILD['boundary'],'pluginSha256':BUILD['pluginSha256'],'checks':[],'pageErrors':[]}
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
 def do_GET(self):
  if self.path=='/installed-host.css' and BUILD.get('hostCss'):
   data=Path(BUILD['hostCss']).read_bytes();self.send_response(200);self.send_header('Content-Type','text/css');self.end_headers();self.wfile.write(data);return
  if self.path=='/favicon.ico':self.send_response(204);self.end_headers();return
  super().do_GET()
def check(name,passed,detail=None):
 REPORT['checks'].append({'name':name,'pass':bool(passed),'detail':detail})
 if not passed:raise AssertionError(name+': '+str(detail))
def composition(page):
 return page.evaluate("JSON.parse(localStorage.getItem('hermes.plugin.hermes-sonic-ui.local:default:compose-workspace-v1')).composition")
def pill(page,name,value):
 page.get_by_role('spinbutton',name=name,exact=True).dblclick()
 e=page.get_by_role('textbox',name=name+' value',exact=True);e.fill(str(value));e.press('Enter')
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(**browser_options())
  page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
  page.set_default_timeout(10000);page.on('pageerror',lambda e:REPORT['pageErrors'].append(str(e)))
  page.add_init_script('''window.audioTrace={created:0,starts:0};const C=AudioContext;window.AudioContext=class extends C{constructor(...args){super(...args);audioTrace.created++;}createBufferSource(){const s=super.createBufferSource(),start=s.start.bind(s);s.start=(...args)=>{audioTrace.starts++;return start(...args)};return s;}}''')
  try:
   check('Exact compiled bundle',hashlib.sha256(Path(BUILD['pluginFile']).read_bytes()).hexdigest()==BUILD['pluginSha256'])
   page.goto(f'http://127.0.0.1:{server.server_port}/proof/workspace-browser.html')
   page.locator('.ss-quick-editor').wait_for();page.screenshot(path=str(OUT/'sound-design.png'))
   check('Live waveform permanently in header',page.locator('.ss-topbar .ss-live-scope canvas').is_visible())
   check('No device opened by rendering or navigation',page.evaluate('audioTrace.created')==0)
   page.get_by_role('button',name='Advanced',exact=True).click()
   page.locator('[data-parameter-id="ss-osc1-detune"]').wait_for()
   for key in ['detune','pan','spread']:
    slider=page.locator(f'input[data-parameter-id="ss-osc1-{key}"]');slider.focus();slider.press('ArrowRight')
   doc=page.evaluate('proof.getDoc()');osc=doc['theme']['events'][doc['selected']]['osc1']
   check('Oscillator fine controls edit durable patch',osc.get('detune')==1 and osc.get('pan')==.01 and osc.get('spread')==1,osc)
   page.screenshot(path=str(OUT/'synthesis.png'))
   page.get_by_role('button',name='Compose',exact=True).click();page.locator('.cp-grid').wait_for()
   for w,h in [(1440,900),(1100,720),(900,650),(600,650)]:
    page.set_viewport_size({'width':w,'height':h})
    geometry=page.evaluate('''()=>{const root=document.querySelector('[data-compose]'),shell=root.querySelector('.ss-shell'),lane=root.querySelector('.cp-velocity-lane'),a=root.getBoundingClientRect(),b=lane.getBoundingClientRect();return {pageScroll:document.documentElement.scrollHeight>innerHeight+1,shellScroll:shell.scrollHeight-shell.clientHeight,velocityBottom:b.bottom,rootBottom:a.bottom,arrangementHeight:root.querySelector('.cp-arrangement').clientHeight,gridHeight:root.querySelector('.cp-grid-scroll').clientHeight}}''')
    check(f'Fixed panes and visible velocity at {w}×{h}',not geometry['pageScroll'] and geometry['shellScroll']<=1 and geometry['velocityBottom']<=geometry['rootBottom'] and geometry['gridHeight']>=60,geometry)
   page.set_viewport_size({'width':1440,'height':900})
   original_notes=page.locator('.cp-note').count()
   tempo=page.get_by_role('spinbutton',name='Tempo',exact=True);box=tempo.bounding_box()
   page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();page.mouse.move(box['x']+box['width']/2,box['y']-36,steps=7);page.mouse.up()
   check('Tempo vertical scrubbing',composition(page)['tempo']>120)
   pill(page,'Tempo',120)
   page.get_by_role('spinbutton',name='Tempo',exact=True).dblclick();draft=page.get_by_role('textbox',name='Tempo value',exact=True);draft.fill('900');draft.press('Enter')
   check('Invalid typed tempo remains visible and cannot mutate',draft.get_attribute('aria-invalid')=='true' and composition(page)['tempo']==120)
   draft.press('Escape')
   pill(page,'Root','C4');check('Root pill accepts note names',composition(page)['root']==60);pill(page,'Root','A3')
   rows=page.locator('.cp-grid-pitch').count();page.get_by_role('button',name='Fold to Scale',exact=True).click()
   check('Scale folding removes empty out-of-scale rows',page.locator('.cp-grid-pitch').count()<rows)
   page.get_by_role('button',name='Fold to Scale',exact=True).click()
   vel=page.locator('.cp-velocity-lane input').first;vel.focus();vel.press('Home')
   check('Velocity stalk updates the actual note',composition(page)['layers'][0]['notes'][0]['velocity']==.1)
   pan=page.locator('[data-parameter-id^="cp-pan-"]').first;pan.focus();pan.press('ArrowRight')
   check('Layer pan persists',composition(page)['layers'][0].get('pan')==.01)
   page.get_by_role('slider',name='Loop start',exact=True).focus();page.keyboard.press('ArrowRight')
   page.get_by_role('slider',name='Loop end',exact=True).focus();page.keyboard.press('ArrowLeft')
   c=composition(page);check('Loop brace persists without trimming notes',c['loopStart']==.5 and c['loopEnd']==7.5 and sum(len(l['notes']) for l in c['layers'])==original_notes)
   ruler=page.get_by_role('slider',name='Playhead position',exact=True);box=ruler.bounding_box();before=composition(page)
   page.mouse.move(box['x']+box['width']*.2,box['y']+8);page.mouse.down();page.mouse.move(box['x']+box['width']*.4,box['y']+8,steps=5);page.mouse.up()
   check('Ruler scrubbing moves playhead without changing music or enabling audio',float(ruler.get_attribute('aria-valuenow'))>3 and composition(page)==before and page.evaluate('audioTrace.created')==0)
   page.get_by_role('button',name='Step Grid · Bass',exact=False).click()
   check('Step drawer collapses without page scroll',not page.locator('.cp-grid-scroll').count() and page.locator('.cp-editing-dock').bounding_box()['height']<50)
   page.get_by_role('button',name='Step Grid · Bass',exact=False).click()
   page.locator('.cp-add-menu summary').click();page.get_by_role('button',name='Add blank layer',exact=True).click()
   c=composition(page);check('Inline Add Layer creates and selects a layer',len(c['layers'])==3 and c['selectedLayer']==c['layers'][-1]['id'])
   page.locator('.cp-track-menu summary').last.click();page.get_by_role('button',name='Duplicate sound + pattern',exact=True).last.click()
   check('Track menu duplicates with a fresh identity',len(composition(page)['layers'])==4)
   page.locator('.cp-track-menu summary').last.click();page.get_by_role('button',name='Delete layer',exact=True).last.click()
   check('Track menu deletes only the chosen layer',len(composition(page)['layers'])==3)
   page.get_by_role('textbox',name='Composition name',exact=True).fill('Workspace verification');page.get_by_role('button',name='Save composition',exact=True).click()
   check('Save includes loop bounds and pan',composition(page)['name']=='Workspace verification')
   check('All passive edits remained silent',page.evaluate('audioTrace.created')==0)
   page.get_by_role('button',name='Enable audio',exact=True).click();page.wait_for_function('audioTrace.created===1')
   check('Enable remains a silent explicit action',page.evaluate('audioTrace.starts')==0)
   page.get_by_role('button',name='Play loop',exact=True).click()
   page.wait_for_function('audioTrace.starts>0')
   old=page.locator('.cp-grid-playhead').get_attribute('style')
   page.wait_for_function('(old)=>document.querySelector(".cp-grid-playhead").getAttribute("style")!==old',arg=old)
   page.wait_for_function('Array.from(document.querySelectorAll(".cp-track-meter")).some(e=>parseFloat(e.style.getPropertyValue("--level"))>0)',timeout=10000)
   check('Both playheads and measured track meters run during playback',True)
   page.screenshot(path=str(OUT/'compose.png'))
   page.get_by_role('button',name='Stop',exact=True).click()
   page.wait_for_function('Array.from(document.querySelectorAll(".cp-track-meter")).every(e=>parseFloat(e.style.getPropertyValue("--level"))===0)')
   check('Stop clears live track meters',True)
   # Offline DSP oracle uses the same source as the exact bundle and portable TS export.
   page.add_script_tag(url=f'http://127.0.0.1:{server.server_port}/evidence/workspace-upgrade/oracle.js')
   metrics=page.evaluate('''async()=>{
    const a=studioOracle,p=a.createSoundPatch({baseFreq:440,chords:[0],noise:0,osc1:{enabled:true,type:'sine',vol:.8,tune:0},osc2:{enabled:false,type:'sine',vol:0,tune:0},osc3:{enabled:false,type:'sine',vol:0,tune:0},lfo1:{enabled:false,type:'sine',rate:1,depth:0},lfo2:{enabled:false,type:'sine',rate:1,depth:0},modMatrix:[],fx:{eq:false,saturation:false,compressor:false,chorus:false,delay:false,reverb:false},filter:{type:'lowpass',cutoff:12000,res:.1,drive:0}});
    const render=x=>a.renderSoundPatch(x,{sampleRate:48000,masterGain:1}),base=await render(p),zero=await render({...p,osc1:{...p.osc1,pan:0,detune:0,spread:0}}),left=await render({...p,osc1:{...p.osc1,pan:-1}}),tuned=await render({...p,osc1:{...p.osc1,detune:100}}),wide=await render({...p,osc1:{...p.osc1,spread:20}});
    const energy=(b,ch)=>b.getChannelData(ch).reduce((s,v)=>s+v*v,0),delta=(b,d)=>b.getChannelData(0).reduce((m,v,i)=>Math.max(m,Math.abs(v-d.getChannelData(0)[i])),0);
    const c=a.createComposition();c.tempo=120;c.loopStart=2;c.loopEnd=3;c.layers=c.layers.slice(0,1);c.layers[0].patch=p;c.layers[0].pan=-1;c.layers[0].gainDb=0;c.layers[0].notes=[0,2,3].map((beat,i)=>({id:'n'+i,beat,duration:.25,pitch:69,velocity:1}));
    const wav=await a.renderCompositionWav(c),v=new DataView(wav.wav.buffer),samples=(wav.wav.length-44)/8;let l=0,r=0;for(let i=0;i<samples;i++){l+=v.getFloat32(44+i*8,true)**2;r+=v.getFloat32(48+i*8,true)**2;}
    return {zeroDelta:delta(base,zero),leftEnergy:energy(left,0),rightEnergy:energy(left,1),detuneDelta:delta(base,tuned),spreadDelta:delta(base,wide),exportNotes:wav.noteCount,loopSeconds:wav.loopSeconds,wavLeft:l,wavRight:r};
   }''')
   check('Legacy zero-valued oscillator fields preserve PCM',metrics['zeroDelta']==0,metrics)
   check('Per-oscillator pan changes real stereo PCM',metrics['leftEnergy']>0 and metrics['rightEnergy']<metrics['leftEnergy']*1e-8)
   check('Detune and unison spread change actual PCM',metrics['detuneDelta']>.001 and metrics['spreadDelta']>.001)
   check('WAV obeys active loop and real layer pan',metrics['exportNotes']==1 and metrics['loopSeconds']==.5 and metrics['wavLeft']>0 and metrics['wavRight']<metrics['wavLeft']*1e-8)
   page.get_by_role('button',name='Sound Design',exact=True).click();page.locator('.ss-live-scope canvas').wait_for()
   idle=page.locator('.ss-live-scope canvas').evaluate('(e)=>e.toDataURL()')
   page.get_by_role('button',name='Audition',exact=True).click()
   page.wait_for_function('(idle)=>document.querySelector(".ss-live-scope canvas").toDataURL()!==idle',arg=idle)
   page.wait_for_function('Array.from(document.querySelectorAll(".ss-stereo-leds i")).some(e=>parseFloat(e.style.getPropertyValue("--level"))>0)')
   check('Header waveform and stereo peaks react to real audition',True)
   page.wait_for_function("document.querySelector('.ss-transport-state').textContent==='Ready'")
   for width,height in [(1440,900),(900,650),(600,650)]:
    page.set_viewport_size({'width':width,'height':height})
    page.wait_for_function("!document.querySelector('.ss-analysis').textContent.includes('Rendering local audio')")
    geometry="""()=>['.ss-instrument','.ss-analysis','.ss-transport'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [r.x,r.y,r.width,r.height]})"""
    idle_geometry=page.evaluate(geometry)
    check(f'Timeline is docked and reserved while idle at {width}px',page.locator('.ss-transport .ss-playback-position').is_visible())
    page.get_by_role('button',name='Audition',exact=True).click();page.wait_for_function("document.querySelector('.ss-playback-position').dataset.active==='true'")
    playing_geometry=page.evaluate(geometry)
    check(f'Playing does not move the controls at {width}px',all(abs(a-b)<1 for old,new in zip(idle_geometry,playing_geometry) for a,b in zip(old,new)),{'idle':idle_geometry,'playing':playing_geometry})
    page.get_by_role('button',name='Stop preview',exact=True).click();page.wait_for_function("document.querySelector('.ss-playback-position').dataset.active==='false'")
    stopped_geometry=page.evaluate(geometry)
    check(f'Stopping does not collapse the transport at {width}px',all(abs(a-b)<1 for old,new in zip(idle_geometry,stopped_geometry) for a,b in zip(old,new)))
   page.reload();page.locator('.ss-instrument').wait_for();page.get_by_role('button',name='Compose',exact=True).click()
   restored=composition(page);check('Reload restores composition, markers and pan but no audio consent',restored['loopStart']==.5 and restored['loopEnd']==7.5 and restored['layers'][0]['pan']==.01 and page.get_by_role('button',name='Play loop',exact=True).is_disabled())
   # Exercise the last bar through production UI and persisted storage, not an injected document.
   pill(page,'Loop length',32)
   check('Arrangement exposes all 32 bars',page.locator('.cp-arrangement-bar').count()==32)
   late=page.locator('[data-grid-beat="127.5"]').last
   # Pick a new onset on the final eighth-note step of the visible octave.
   late.scroll_into_view_if_needed();late.click()
   long=composition(page)
   check('Final bar accepts editable notes',any(n['beat']==127.5 for l in long['layers'] for n in l['notes']))
   page.reload();page.get_by_role('button',name='Compose',exact=True).click()
   check('Long arrangement survives reload',composition(page)==long)
   pill(page,'Loop length',4)
   check('Shortening retains late notes',composition(page)['layers']==long['layers'])
   pill(page,'Loop length',32)
   for width,height in [(1440,900),(600,650)]:
    page.set_viewport_size({'width':width,'height':height})
    check(f'32-bar workspace contains horizontal overflow at {width}px',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   page.add_script_tag(url=f'http://127.0.0.1:{server.server_port}/evidence/workspace-upgrade/oracle.js')
   long_audio=page.evaluate('''async()=>{
    const c=studioOracle.createComposition();c.bars=32;c.tempo=200;c.layers=c.layers.slice(0,1);
    c.layers[0].notes=[{...c.layers[0].notes[0],beat:127.5,duration:.25}];
    const result=await studioOracle.renderCompositionWav(c);const view=new DataView(result.wav.buffer);
    const at=Math.floor(127.5*60/200*48000);let before=0,late=0;
    for(let i=0;i<(result.wav.length-44)/8;i++){const sample=Math.abs(view.getFloat32(44+i*8,true));if(i<at)before=Math.max(before,sample);else late=Math.max(late,sample);}
    return {loopSeconds:result.loopSeconds,notes:result.noteCount,before,late};
   }''')
   check('Real Web Audio WAV contains the last-bar note at the correct time',abs(long_audio['loopSeconds']-38.4)<1e-6 and long_audio['notes']==1 and long_audio['before']==0 and long_audio['late']>0, long_audio)
   # Dense supported boundary: real editor, cached PCM and isolated clock subscribers.
   page.evaluate("""()=>{const key='hermes.plugin.hermes-sonic-ui.local:default:compose-workspace-v1',doc=JSON.parse(localStorage.getItem(key)),c=doc.composition;c.bars=32;c.meter=4;c.loopStart=124;c.loopEnd=128;c.layers=c.layers.slice(0,1);c.selectedLayer=c.layers[0].id;c.layers[0].gainDb=-20;c.layers[0].muted=false;c.layers[0].notes=Array.from({length:2048},(_,i)=>({id:'dense-'+i,beat:Math.floor(i/8)*.5,duration:.5,pitch:45,velocity:.3}));localStorage.setItem(key,JSON.stringify(doc));}""")
   page.set_viewport_size({'width':1440,'height':900});page.reload();page.get_by_role('button',name='Compose',exact=True).click()
   check('Dense 32-bar editor renders 2,048 velocity controls and overlapping cells',page.locator('.cp-velocity-lane input').count()==2048 and page.locator('[data-grid-pitch="45"] .cp-overlap-count').count()==256)
   page.get_by_role('button',name='Enable audio',exact=True).click();page.get_by_role('button',name='Play loop',exact=True).click()
   page.wait_for_function('document.querySelector(".cp-play").getAttribute("aria-pressed")==="true"')
   old=page.locator('.cp-grid-playhead').get_attribute('style')
   page.wait_for_function('(old)=>document.querySelector(".cp-grid-playhead").getAttribute("style")!==old',arg=old)
   page.locator('.cp-velocity-lane input').last.focus();page.keyboard.press('ArrowRight')
   check('Dense arrangement accepts an edit during playback',composition(page)['layers'][0]['notes'][-1]['velocity']>.3)
   page.get_by_role('button',name='Stop',exact=True).click()
   check('Dense playback stops without an editor error',page.get_by_role('button',name='Play loop',exact=True).get_attribute('aria-pressed')=='false' and not page.get_by_role('alert').count())
   check('No browser runtime errors',not REPORT['pageErrors'],REPORT['pageErrors'])
  finally:
   page.screenshot(path=str(OUT/'final-state.png'));browser.close()
except Exception:
 REPORT['failure']=traceback.format_exc();print(REPORT['failure'])
finally:
 server.shutdown();(OUT/'verification.json').write_text(json.dumps(REPORT,indent=2),encoding='utf-8')
print(json.dumps({'passed':sum(c['pass'] for c in REPORT['checks']),'total':len(REPORT['checks']),'failure':REPORT.get('failure'),'report':str(OUT/'verification.json')},indent=2))
sys.exit(1 if 'failure' in REPORT else 0)
