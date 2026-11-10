"""Audio ownership across actual production route/task mounts; no model request."""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
from browser_support import browser_options
import json,threading,traceback,sys,hashlib
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'evidence/browser/audio-session'
OUT.mkdir(parents=True,exist_ok=True)
BUILD=json.loads((ROOT/'evidence/browser/build.json').read_text())
REPORT={'bundleSha256':BUILD['pluginSha256'],'boundary':'Production plugin; isolated SDK navigation/composer, real muted Chrome Web Audio; no model request','checks':[],'pageErrors':[]}
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
def check(name,ok):
 REPORT['checks'].append({'name':name,'pass':bool(ok)})
 if not ok:raise AssertionError(name)
def studio(page):
 page.evaluate("proof.showRoute('/sonic-ui')");page.locator('.ss-transport-state').wait_for()
def leave(page):
 page.evaluate('proof.leaveStudio()');page.get_by_role('region',name='Outside Studio',exact=True).wait_for()
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(**browser_options());page=browser.new_page(viewport={'width':1500,'height':1000});page.set_default_timeout(10000)
  page.on('pageerror',lambda e:REPORT['pageErrors'].append(str(e)))
  page.add_init_script('''window.sessionAudio={contexts:[],sources:[]};const C=AudioContext;window.AudioContext=class extends C{constructor(...a){super(...a);sessionAudio.contexts.push(this);}createBufferSource(){const s=super.createBufferSource(),row={started:false,stopped:false},start=s.start.bind(s),stop=s.stop.bind(s);sessionAudio.sources.push(row);s.start=(...a)=>{row.started=true;return start(...a)};s.stop=(...a)=>{row.stopped=true;return stop(...a)};return s;}};''')
  try:
   check('Exact built plugin',hashlib.sha256(Path(BUILD['pluginFile']).read_bytes()).hexdigest()==BUILD['pluginSha256'])
   page.goto(f'http://127.0.0.1:{server.server_port}/proof/workspace-browser.html');page.locator('.ss-transport-state').wait_for()
   check('First visit opens no device and starts audio off',page.locator('.ss-transport-state').inner_text()=='Audio off' and page.evaluate('sessionAudio.contexts.length')==0)
   page.get_by_role('button',name='Audition',exact=True).click();page.wait_for_function('sessionAudio.sources.some(s=>s.started)')
   leave(page)
   check('Leaving stops the audition without closing the device',page.evaluate('sessionAudio.sources.every(s=>!s.started||s.stopped)&&sessionAudio.contexts[0].state==="running"'))
   before=page.evaluate('sessionAudio.sources.filter(s=>s.started).length');studio(page)
   check('Reentering preserves readiness with no autoplay or extra context',page.locator('.ss-transport-state').inner_text()=='Ready' and page.evaluate('sessionAudio.contexts.length')==1 and page.evaluate('sessionAudio.sources.filter(s=>s.started).length')==before)
   page.locator('.ss-audio-settings summary').click();page.get_by_role('button',name='Mute audio',exact=True).click();leave(page);studio(page)
   check('Explicit mute survives leaving and reentering',page.locator('.ss-transport-state').inner_text()=='Muted')
   page.evaluate("proof.setScope('default','another-session')");page.wait_for_timeout(100)
   check('Host session changes preserve mute and stay silent',page.locator('.ss-transport-state').inner_text()=='Muted' and page.evaluate('sessionAudio.sources.filter(s=>s.started).length')==before)
   page.get_by_role('button',name='Audition',exact=True).click();page.wait_for_function('(before)=>sessionAudio.sources.filter(s=>s.started).length>before',arg=before)
   page.get_by_role('button',name='Stop preview',exact=True).click()
   page.get_by_role('button',name='Sound Draft',exact=True).click();page.get_by_role('textbox',name='Describe the sound',exact=True).fill('A short confirmation chime')
   page.get_by_role('button',name='Generate sound',exact=True).click();page.get_by_role('heading',name='Fine tune',exact=True).wait_for();page.get_by_role('button',name='Close dialog',exact=True).click()
   before=page.evaluate('sessionAudio.sources.filter(s=>s.started).length');studio(page)
   check('Opening and returning from a real Sound Draft launch retains enabled audio',page.locator('.ss-transport-state').inner_text()=='Ready' and page.evaluate('sessionAudio.contexts.length')==1 and page.evaluate('sessionAudio.sources.filter(s=>s.started).length')==before)
   page.reload();page.locator('.ss-transport-state').wait_for()
   check('App reload resets consent without opening a device',page.locator('.ss-transport-state').inner_text()=='Audio off' and page.evaluate('sessionAudio.contexts.length')==0)
   patch=json.loads((ROOT/'assets/studio-palettes.json').read_text())[0]['events']['onCommit']
   page.get_by_role('button',name='Sound Draft',exact=True).click();page.locator('.ss-draft-manual summary').click();page.get_by_role('textbox',name='Returned SoundPatch/v1 JSON',exact=True).fill(json.dumps(patch));page.get_by_role('button',name='Review sound JSON',exact=True).click()
   page.get_by_role('button',name='▶ Audition draft',exact=True).click();page.wait_for_function("document.body.innerText.includes('Draft auditioned locally')")
   page.get_by_role('button',name='Close dialog',exact=True).click()
   check('Draft audition enables the main preview state too',page.locator('.ss-transport-state').inner_text()=='Ready')
   leave(page);studio(page)
   check('Draft preview is disposed while main readiness survives navigation',page.locator('.ss-transport-state').inner_text()=='Ready' and page.evaluate('sessionAudio.contexts.filter(c=>c.state!=="closed").length')==1)
   page.get_by_role('button',name='Compose',exact=True).click();page.get_by_role('button',name='Enable audio',exact=True).click();page.get_by_role('button',name='Play loop',exact=True).wait_for(state='visible')
   page.wait_for_function('!document.querySelector(".cp-play").disabled');page.get_by_role('button',name='Play loop',exact=True).click();page.wait_for_function('document.querySelector(".cp-play").getAttribute("aria-pressed")==="true"')
   count=page.evaluate('sessionAudio.contexts.length');page.get_by_role('button',name='Sound Design',exact=True).click();page.get_by_role('button',name='Compose',exact=True).click()
   check('Task switching keeps Compose enabled and stops its loop',page.get_by_role('button',name='Play loop',exact=True).is_enabled() and page.get_by_role('button',name='Play loop',exact=True).get_attribute('aria-pressed')=='false' and page.evaluate('sessionAudio.contexts.length')==count)
   leave(page);studio(page);page.get_by_role('button',name='Compose',exact=True).click()
   check('Route reentry preserves Compose audio readiness',page.get_by_role('button',name='Play loop',exact=True).is_enabled() and page.evaluate('sessionAudio.contexts.length')==count)
   page.get_by_role('button',name='Mute audio',exact=True).click();leave(page);studio(page);page.get_by_role('button',name='Compose',exact=True).click()
   check('Compose mute survives navigation',page.get_by_role('button',name='Play loop',exact=True).is_disabled() and page.get_by_role('button',name='Enable audio',exact=True).is_visible())
   await_result=page.evaluate('proof.dispose()')
   check('Plugin unload closes all retained audio contexts',page.evaluate('sessionAudio.contexts.every(c=>c.state==="closed")'))
   check('No browser errors',not REPORT['pageErrors'])
  finally:browser.close()
except Exception:REPORT['failure']=traceback.format_exc();print(REPORT['failure'])
finally:
 server.shutdown();(OUT/'verification.json').write_text(json.dumps(REPORT,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'passed':sum(c['pass'] for c in REPORT['checks']),'total':len(REPORT['checks']),'failure':REPORT.get('failure')},indent=2))
sys.exit(1 if 'failure' in REPORT else 0)
