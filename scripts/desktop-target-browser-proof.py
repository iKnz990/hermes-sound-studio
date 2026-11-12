"""Production bundle with SDK/Dialog fixtures; real WebAudio, physically muted Chromium."""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
import json,threading,sys,traceback,hashlib,os
from browser_support import browser_options
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'evidence/desktop-target'
OUT.mkdir(parents=True,exist_ok=True)
BUILD=json.loads((ROOT/'evidence/browser/build.json').read_text())
REPORT={'bundleSha256':BUILD['pluginSha256'],'boundary':BUILD['boundary'],'checks':[],'pageErrors':[]}
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
def starts(page):return page.evaluate('desktopTrace.starts.length')
def expect_pcm(page,event,action):
 before=starts(page);action()
 try:page.wait_for_function('([before,event])=>desktopTrace.starts.slice(before).some(row=>desktopSame(row,desktopExpected[event]))',arg=[before,event])
 except Exception:
  REPORT['pcmMismatch']=page.evaluate('''([before,event])=>desktopTrace.starts.slice(before).map(row=>{const expected=desktopExpected[event];let max=0,sum=0,n=0;if(row.channels.length!==expected.channels.length||row.channels.some((ch,c)=>ch.length!==expected.channels[c].length))return {sameShape:false};row.channels.forEach((ch,c)=>ch.forEach((v,i)=>{const d=Math.abs(v-expected.channels[c][i]);max=Math.max(max,d);sum+=d*d;n++;}));return {sameShape:true,maxAbs:max,rms:Math.sqrt(sum/n)};})''', [before,event])
  print('PCM DEBUG',event,page.evaluate('({expected:Object.fromEntries(Object.entries(desktopExpected).map(([e,r])=>[e,r.hash])),starts:desktopTrace.starts.map(r=>r.hash),contexts:desktopTrace.contexts.map(c=>c.state),target:document.querySelector(".ss-desktop-target").innerText})'))
  raise
 check('Actual assigned PCM: '+event,True)
def references(page):
 return page.evaluate('''async()=>{const theme=proof.getDoc().theme;window.desktopExpected={};for(const [event,patch] of Object.entries(theme.events)){const b=await studioOracle.renderSoundPatch(patch,{sampleRate:theme.sampleRate,masterGain:theme.masterGain});desktopExpected[event]={hash:pcmHash(b),channels:Array.from({length:b.numberOfChannels},(_,c)=>b.getChannelData(c))};}return Object.fromEntries(Object.entries(desktopExpected).map(([e,r])=>[e,r.hash]));}''')
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(**browser_options())
  page=browser.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(10000)
  page.on('pageerror',lambda e:REPORT['pageErrors'].append(str(e)))
  page.add_init_script('''window.desktopTrace={contexts:[],starts:[]};window.pcmHash=b=>{let hash=2166136261;for(let c=0;c<b.numberOfChannels;c++){const data=b.getChannelData(c),bits=new Uint32Array(data.buffer,data.byteOffset,data.length);for(let i=0;i<bits.length;i+=17){hash^=bits[i];hash=Math.imul(hash,16777619);}}return b.length+':'+(hash>>>0);};window.desktopSame=(a,b)=>{if(a.channels.length!==b.channels.length||a.channels.some((ch,c)=>ch.length!==b.channels[c].length))return false;let max=0,squared=0,count=0;for(let c=0;c<a.channels.length;c++)for(let i=0;i<a.channels[c].length;i++){const d=Math.abs(a.channels[c][i]-b.channels[c][i]);if(!Number.isFinite(d))return false;max=Math.max(max,d);squared+=d*d;count++;}return max<=1e-4&&Math.sqrt(squared/count)<=1e-5;};const C=AudioContext;window.AudioContext=class extends C{constructor(...a){super(...a);desktopTrace.contexts.push(this);}createBufferSource(){const s=super.createBufferSource(),start=s.start.bind(s);s.start=(...args)=>{desktopTrace.starts.push({hash:pcmHash(s.buffer),channels:Array.from({length:s.buffer.numberOfChannels},(_,c)=>s.buffer.getChannelData(c)),time:this.currentTime});return start(...args)};return s;}};''')
  try:
   check('Exact verified production bundle',hashlib.sha256(Path(BUILD['pluginFile']).read_bytes()).hexdigest()==BUILD['pluginSha256'])
   page.goto(f'http://127.0.0.1:{server.server_port}/proof/workspace-browser.html');page.locator('.ss-desktop-target').wait_for()
   page.evaluate('''()=>{const nav=document.createElement('nav');nav.id='host-proof-controls';nav.innerHTML='<button type="button" id="host-action">Host action</button><input id="host-field" aria-label="Host text field"><label><input type="checkbox" id="host-checkbox">Host toggle</label><form id="host-form"><input id="host-required" required aria-label="Required host field"><button id="host-submit">Submit host form</button></form>';nav.style.cssText='display:flex;gap:12px;padding:8px;align-items:center';document.body.prepend(nav);document.body.style.gridTemplateRows='auto minmax(0,1fr) auto';}''')
   page.locator('#host-action').click();check('Host events are silent before enable',starts(page)==0 and page.evaluate('desktopTrace.contexts.length')==0)
   page.locator('.ss-event-select').first.click();page.add_script_tag(url=f'http://127.0.0.1:{server.server_port}/evidence/workspace-upgrade/oracle.js')
   references(page)
   # Independent canonical renders can drift by ~3e-5 peak in Chromium.
   # Bound peak AND RMS error; all six assignment references must still differ.
   check('PCM tolerance distinguishes all six event assignments',page.evaluate('()=>{const entries=Object.values(desktopExpected);return entries.every((a,i)=>entries.every((b,j)=>i===j||!desktopSame(a,b)));}'))
   page.get_by_role('button',name='Enable desktop sounds',exact=True).click()
   page.get_by_text('Assignments active',exact=True).wait_for()
   check('Explicit enable changes target, without auditioning',page.locator('.ss-desktop-target strong').inner_text()=='Hermes Desktop' and starts(page)==0)
   expect_pcm(page,'onHover',lambda:page.locator('#host-action').hover())
   expect_pcm(page,'onFocus',lambda:page.locator('#host-field').focus())
   expect_pcm(page,'onCommit',lambda:page.locator('#host-action').click())
   expect_pcm(page,'onToggle',lambda:page.locator('#host-checkbox').check())
   expect_pcm(page,'onError',lambda:page.locator('#host-submit').click())
   expect_pcm(page,'onBackgroundTaskComplete',lambda:page.evaluate("proof.emit({type:'message.complete',session_id:'proof-session',profile:'default',connectionId:'local',payload:{status:'complete',message_id:'test-complete-1'}})"))
   before=starts(page);page.evaluate("proof.emit({type:'message.complete',session_id:'other-session',profile:'default',connectionId:'local',payload:{status:'complete',message_id:'foreign'}})")
   page.wait_for_timeout(150);check('Foreign session completion stays silent',starts(page)==before)
   # Editing the selected event remains silent, and changes the PCM that real host hover plays.
   before=starts(page);old=page.evaluate('desktopExpected.onHover.hash');knob=page.locator('[data-parameter-id="ss-intensity"]').first;knob.focus();knob.press('ArrowLeft')
   check('Assignment editing itself remains silent',starts(page)==before)
   references(page);check('Assigned render changed after edit',page.evaluate('desktopExpected.onHover.hash')!=old)
   expect_pcm(page,'onHover',lambda:page.locator('#host-action').hover())
   page.get_by_role('button',name='Compose',exact=True).click()
   expect_pcm(page,'onCommit',lambda:page.locator('#host-action').click())
   check('Desktop target survives switching studio task',page.get_by_text('Desktop sounds: On',exact=True).is_visible())
   page.get_by_role('button',name='Mute desktop sounds',exact=True).click();before=starts(page);page.locator('#host-action').click();page.wait_for_timeout(150)
   check('Status-bar mute silences desktop UI',starts(page)==before)
   page.get_by_role('button',name='Unmute desktop sounds',exact=True).click()
   expect_pcm(page,'onCommit',lambda:page.locator('#host-action').click())
   page.get_by_role('button',name='Disable desktop sounds',exact=True).click();before=starts(page);page.locator('#host-checkbox').uncheck();page.locator('#host-action').click();page.wait_for_timeout(150)
   check('Disable detaches desktop playback',starts(page)==before)
   page.get_by_role('button',name='Sound Design',exact=True).click()
   page.get_by_role('button',name='Enable desktop sounds',exact=True).click();page.get_by_text('Assignments active',exact=True).wait_for()
   page.evaluate('desktopTrace.contexts[0].suspend()');page.get_by_role('button',name='Enable desktop sounds',exact=True).wait_for();before=starts(page);page.locator('#host-action').click();page.wait_for_timeout(150)
   check('Suspension never resumes from passive UI events',starts(page)==before)
   page.get_by_role('button',name='Enable desktop sounds',exact=True).click();page.get_by_text('Assignments active',exact=True).wait_for()
   page.screenshot(path=str(OUT/'desktop-target.png'))
   page.reload();page.locator('.ss-desktop-target').wait_for();check('Reload preserves assignments, revokes target consent',page.locator('.ss-desktop-target strong').inner_text()=='Local preview' and page.evaluate('desktopTrace.contexts.length')==0)
   check('No runtime errors',not REPORT['pageErrors'],REPORT['pageErrors'])
  finally:browser.close()
except Exception:
 REPORT['failure']=traceback.format_exc();print(REPORT['failure'])
finally:
 server.shutdown();(OUT/'verification.json').write_text(json.dumps(REPORT,indent=2),encoding='utf-8')
print(json.dumps({'passed':sum(row['pass'] for row in REPORT['checks']),'total':len(REPORT['checks']),'failure':REPORT.get('failure'),'report':str(OUT/'verification.json')},indent=2))
sys.exit(1 if 'failure' in REPORT else 0)

