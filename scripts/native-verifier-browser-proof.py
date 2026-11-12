"""Portable verifier regressions with SDK fixtures. NOT native/model acceptance."""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import json
import sys
import threading
import traceback
from playwright.sync_api import sync_playwright
from browser_support import browser_options

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('native_verifier', ROOT / 'scripts/native-desktop-proof.py')
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)
out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'evidence/browser/native-verifier'
out.mkdir(parents=True, exist_ok=True)
report = {'boundary': 'Verifier guards in portable SDK fixture; no native host or model', 'checks': []}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, *args):
        pass


def check(name, passed):
    report['checks'].append({'name': name, 'pass': bool(passed)})
    if not passed:
        raise AssertionError(name)


server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(**browser_options())
        try:
            page = browser.new_page()
            url = f'http://127.0.0.1:{server.server_port}/proof/workspace-browser.js'
            page.goto(url.replace('.js', '.html'))
            page.get_by_role('button', name='Sound Draft', exact=True).wait_for()
            before_storage = page.evaluate('localStorage.getItem("hermes.plugin.hermes-sonic-ui.local:default:sound-studio-v1")')
            before, source = native.snapshot_theme(page, {url: True})
            check('Empty storage still requires a complete live six-assignment baseline', before_storage is None and len(before['events']) == 6 and source == url)
            page.evaluate('window.failStorage=true')
            knob = page.locator('[data-parameter-id="ss-intensity"]').first
            knob.focus()
            knob.press('ArrowLeft')
            after, source = native.snapshot_theme(page, {url: True})
            check('Live export exposes unsaved in-memory changes despite unchanged storage', after != before and page.evaluate('localStorage.getItem("hermes.plugin.hermes-sonic-ui.local:default:sound-studio-v1")') == before_storage)
            rejected = False
            try:
                native.snapshot_theme(page, {'blob:stale-candidate': True, url: False})
            except AssertionError:
                rejected = True
            check('A stale matching module cannot validate a different executing export handler', rejected)
            # This is a guard test only: reject BEFORE forwarding any model call.
            page.evaluate('window.__HERMES_PLUGIN_SDK__={host:window.proofHost}')
            page.evaluate("window.__HERMES_REACT__={useRef:()=>null};window.__HERMES_REACT_JSX__={jsx:()=>null};window.__HERMES_REACT_JSX_DEV__={jsxDEV:()=>null}")
            expected_shims = page.evaluate(native.EXPECTED_SHIMS)
            linked = page.evaluate("""async expected=>{
             const scripts=[],urls={};for(const [name,source] of Object.entries(expected)){const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));scripts.push({url,source});urls[name]=url;}
             const candidate='import React from "react";\\nimport {host} from "@hermes/plugin-sdk";\\nexport const ready=!!host;';
             const good=candidate.replace('"react"',JSON.stringify(urls.react)).replace('"@hermes/plugin-sdk"',JSON.stringify(urls['@hermes/plugin-sdk']));
             const swapped=good.replace(JSON.stringify(urls.react),JSON.stringify(urls['react/jsx-runtime']));
             for(const source of [good,swapped]){const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));await import(url);URL.revokeObjectURL(url);}
             const result={candidate,scripts,modules:[{url:'good',source:good},{url:'swapped',source:swapped}]};Object.values(urls).forEach(url=>URL.revokeObjectURL(url));return result;
            }""", expected_shims)
            admitted_shims = native.verified_shims(linked['scripts'], expected_shims)
            check('Parsed module verification accepts actual host-shaped shims and rejects a loadable dependency swap', native.verify_sources(linked['candidate'], linked['modules'], admitted_shims) == {'good': True, 'swapped': False})
            page.evaluate(native.OBSERVE, {'marker': 'guard-test', 'sourceUrl': 'blob:stale-candidate'})
            result = page.evaluate("""async()=>{const before=proofBackgroundCalls.length;try{await proofHost.requestProfile({},'session.create',{title:'guard-test'});return false;}catch{return proofBackgroundCalls.length===before;}}""")
            page.evaluate('window.__studioNativeProbe.restore()')
            check('A foreign draft handler is rejected before session creation', result)
            page.evaluate(native.OBSERVE, {'marker': 'forward-test', 'sourceUrl': url})
            page.get_by_role('button', name='Sound Draft', exact=True).click()
            page.get_by_role('textbox', name='Describe the sound', exact=True).fill('forward-test soft chime')
            page.get_by_role('button', name='Generate sound', exact=True).click()
            page.get_by_role('heading', name='Fine tune', exact=True).wait_for()
            page.wait_for_function('window.__studioNativeProbe.receipt.cleaned')
            receipt = page.evaluate('window.__studioNativeProbe.receipt')
            check('Observer forwards candidate calls and observes the original fixture lifecycle', all(receipt[key] for key in ['activeSource', 'created', 'submitted', 'terminal', 'cleaned']) and receipt['methods'].count('prompt.submit') == 1)
            page.keyboard.press('Escape')
            page.get_by_role('dialog').wait_for(state='hidden')
            final, final_source = native.snapshot_theme(page, {url: True})
            check('Before/after live exports preserve all assignments through draft generation', final == after and final_source == source)
            page.evaluate('window.__studioNativeProbe.restore()')
        finally:
            browser.close()
except Exception:
    report['failure'] = traceback.format_exc()
finally:
    server.shutdown()
    (out / 'verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
sys.exit(1 if 'failure' in report else 0)
