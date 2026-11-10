"""Capture shareable plugin-only images and audio from isolated example documents."""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
from browser_support import browser_options
import json,threading,sys,hashlib
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'evidence/submission-assets'
IMAGES=ROOT/'docs/images';IMAGES.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
composition=json.loads((ROOT/'examples/signal-garden.composition.json').read_text())
theme=json.loads((ROOT/'examples/signal-garden.theme.json').read_text())
stamp=1794225600000
sound={'version':1,'revision':1,'theme':theme,'selected':'onCommit','mode':'beginner','projects':[{'id':'demo-ui-project','name':theme['name'],'theme':theme,'updatedAt':stamp}],'presets':[],'activeProject':'demo-ui-project','dirty':False}
compose={'version':1,'revision':1,'composition':composition,'compositions':[{'id':'demo-composition','name':composition['name'],'composition':composition,'updatedAt':stamp}],'activeId':'demo-composition','dirty':False}
seed={'sound-studio-v1':sound,'sound-studio-v1-initialized':True,'compose-workspace-v1':compose,'compose-workspace-v1-initialized':True}
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
report={'source':'Exact release bundle in an isolated SDK host with supplied example documents; real WebAudio, muted output','images':[]}
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(**browser_options());page=browser.new_page(viewport={'width':1600,'height':1100});page.set_default_timeout(15000)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script('for(const [k,v] of Object.entries('+json.dumps(seed)+'))localStorage.setItem("hermes.plugin.hermes-sonic-ui.local:default:"+k,JSON.stringify(v));')
  page.goto(f'http://127.0.0.1:{server.server_port}/proof/workspace-browser.html');page.locator('.ss-quick-editor').wait_for()
  page.get_by_role('button',name='Enable desktop sounds',exact=True).click();page.get_by_text('Assignments active',exact=True).wait_for()
  page.wait_for_function('!document.querySelector(".ss-analysis").innerText.includes("Rendering local audio")')
  page.get_by_role('button',name='Audition',exact=True).click();page.wait_for_function('Array.from(document.querySelectorAll(".ss-stereo-leds i")).some(e=>parseFloat(e.style.getPropertyValue("--level"))>0)')
  page.screenshot(path=str(IMAGES/'sound-design.png'));report['images'].append('docs/images/sound-design.png')
  page.get_by_role('button',name='Compose',exact=True).click();page.locator('.cp-grid').wait_for()
  page.get_by_role('button',name='Enable audio',exact=True).click();page.get_by_role('button',name='Play loop',exact=True).click()
  page.wait_for_function('Array.from(document.querySelectorAll(".cp-track-meter")).some(e=>parseFloat(e.style.getPropertyValue("--level"))>0)')
  page.locator('.cp-arrangement').evaluate('(e)=>e.scrollTop=0')
  page.wait_for_timeout(350);page.screenshot(path=str(IMAGES/'compose.png'));report['images'].append('docs/images/compose.png')
  page.get_by_role('button',name='Stop',exact=True).click()
  page.get_by_role('button',name='Sound Design',exact=True).click();page.set_viewport_size({'width':1600,'height':800})
  page.get_by_role('button',name='Audition',exact=True).click();page.wait_for_function('Array.from(document.querySelectorAll(".ss-stereo-leds i")).some(e=>parseFloat(e.style.getPropertyValue("--level"))>0)')
  page.screenshot(path=str(IMAGES/'banner.png'));report['images'].append('docs/images/banner.png')
  page.add_script_tag(url=f'http://127.0.0.1:{server.server_port}/evidence/workspace-upgrade/oracle.js')
  wav=page.evaluate('async(c)=>Array.from((await studioOracle.renderCompositionWav(c)).wav)',composition)
  (OUT/'signal-garden.wav').write_bytes(bytes(wav))
  report['audio']={'file':'signal-garden.wav','bytes':len(wav),'sha256':hashlib.sha256(bytes(wav)).hexdigest(),'format':'48 kHz stereo 32-bit float WAV, active loop plus tails'}
  assert not errors,errors
  browser.close()
finally:server.shutdown()
(OUT/'assets.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report,indent=2))
