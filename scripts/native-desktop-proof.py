"""Opt-in integration against a running Hermes Electron app and configured model.

No SDK fixtures, provider responses, or audio devices are substituted. Run only
against a dedicated test Desktop; this creates one hidden model conversation.
The transcript remains in Hermes. Evidence excludes prompts, replies and paths.
"""
from pathlib import Path
import argparse
import hashlib
import json
import os
import platform
import re
import sys
import uuid
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
STORE_KEY = 'hermes.plugin.hermes-sonic-ui.local:default:sound-studio-v1'


def canonical_source(source):
    """Ignore only static import URLs rewritten by Hermes's runtime loader."""
    source = source.replace('\r\n', '\n')
    return re.sub(r'(?m)^(import[^\n]+ from )([\'"])[^\'"\n]+\2(;?)$',
                  r'\1"HOST_IMPORT"\3', source)


def local_endpoint(value):
    parsed = urlparse(value)
    if (parsed.scheme != 'http' or parsed.hostname not in {'127.0.0.1', 'localhost', '::1'}
            or parsed.username or parsed.password or parsed.query or parsed.fragment
            or parsed.path not in {'', '/'}):
        raise ValueError('Use a loopback HTTP CDP endpoint for a dedicated Hermes test instance.')
    if not parsed.port:
        raise ValueError('The CDP endpoint must include a port.')
    return value


# The observer forwards every call to the actual SDK unchanged. It records only
# this request's method names and cleanup acknowledgments, never model content.
OBSERVE = """marker => {
 const h=window.__HERMES_PLUGIN_SDK__.host, original=h.requestProfile;
 const receipt={methods:[],created:false,submitted:false,terminal:false,cleaned:false};
 let session='';
 const wrapped=async function(route,method,params,...rest){
  const creating=method==='session.create'&&String(params?.title).includes(marker);
  const own=creating||!!session&&params?.session_id===session;
  const result=await original.call(h,route,method,params,...rest);
  if(own){
   receipt.methods.push(method);
   if(creating){session=result?.session_id;receipt.created=!!session;}
   if(method==='prompt.submit')receipt.submitted=true;
   if(method==='session.events.since')receipt.terminal ||= result?.events?.some(e=>e.session_id===session&&e.type==='message.complete'&&(!e.payload?.status||e.payload.status==='complete'))??false;
   if(method==='session.detach'||method==='session.close')receipt.cleaned=true;
  }
  return result;
 };
 h.requestProfile=wrapped;
 if(h.requestProfile!==wrapped)throw Error('Native SDK cannot be observed');
 window.__studioNativeProbe={receipt,restore(){if(h.requestProfile===wrapped)h.requestProfile=original;delete window.__studioNativeProbe;}};
}"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cdp-url', default=os.environ.get('HERMES_STUDIO_CDP_URL', ''))
    parser.add_argument('--allow-model', action='store_true', help='Authorize one configured-model request (normal usage charges).')
    parser.add_argument('--out', default='evidence/native')
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    source = (ROOT / 'desktop/plugin.js').read_text(encoding='utf-8')
    report = {'kind': 'native-hermes-desktop/configured-model', 'platform': platform.system(),
              'pluginSha256': hashlib.sha256((ROOT / 'desktop/plugin.js').read_bytes()).hexdigest(),
              'checks': [], 'ok': False}

    def check(name, passed):
        report['checks'].append({'name': name, 'pass': bool(passed)})
        if not passed:
            raise AssertionError(name)

    page = None
    observed = False
    try:
        if not args.allow_model:
            raise ValueError('Native verification requires --allow-model; no fixture fallback is permitted.')
        endpoint = local_endpoint(args.cdp_url)
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            browser = pw.chromium.connect_over_cdp(endpoint, timeout=15000)
            try:
                pages = [p for context in browser.contexts for p in context.pages
                         if p.evaluate("!!window.hermesDesktop && !!window.__HERMES_PLUGIN_SDK__ && navigator.userAgent.includes('Electron/')")]
                check('Exactly one native Hermes renderer', len(pages) == 1)
                page = pages[0]
                page.set_default_timeout(15000)
                report['electron'] = page.evaluate("navigator.userAgent.match(/Electron\\/([\\d.]+)/)?.[1]")
                check('No browser proof fixture', page.evaluate('!window.proof && !window.proofHost'))
                session = page.context.new_cdp_session(page)
                scripts = []
                session.on('Debugger.scriptParsed', lambda event: scripts.append(event))
                session.send('Debugger.enable')
                matched = False
                for script in scripts:
                    if not script.get('url', '').startswith('blob:') or script.get('length', 0) < len(source) // 2:
                        continue
                    loaded = session.send('Debugger.getScriptSource', {'scriptId': script['scriptId']})['scriptSource']
                    if canonical_source(loaded) == canonical_source(source):
                        matched = True
                        break
                session.detach()
                check('Running plugin matches the candidate bundle', matched)
                page.evaluate("window.__HERMES_PLUGIN_SDK__.host.navigate('/sonic-ui')")
                page.get_by_role('button', name='Compose', exact=True).click()
                check('Native Compose exposes 32 bars', page.get_by_role('spinbutton', name='Loop length', exact=True).get_attribute('aria-valuemax') == '32')
                page.get_by_role('button', name='Sound Design', exact=True).click()
                page.get_by_role('button', name='Sound Draft', exact=True).click()
                check('No pre-existing draft is overwritten', page.get_by_role('button', name='Accept draft', exact=True).count() == 0
                      and page.get_by_role('button', name='Cancel draft', exact=True).count() == 0)
                before = page.evaluate('(key)=>localStorage.getItem(key)', STORE_KEY)
                marker = 'native-' + uuid.uuid4().hex[:12]
                page.evaluate(OBSERVE, marker)
                observed = True
                page.get_by_role('textbox', name='Describe the sound', exact=True).fill(marker + ' soft short glass confirmation, one sine voice, no noise. Return only the requested SoundPatch JSON.')
                page.get_by_role('button', name='Generate sound', exact=True).click()
                page.get_by_role('heading', name='Fine tune', exact=True).wait_for(timeout=240000)
                page.wait_for_function('window.__studioNativeProbe.receipt.cleaned', timeout=30000)
                receipt = page.evaluate('window.__studioNativeProbe.receipt')
                report['rpc'] = receipt
                check('Real SDK creates, submits, receives and releases its own session', all(receipt[k] for k in ['created', 'submitted', 'terminal', 'cleaned']))
                check('Only one model request was submitted', receipt['methods'].count('prompt.submit') == 1)
                check('Validated candidate offers explicit acceptance', page.get_by_role('button', name='Accept draft', exact=True).is_enabled())
                check('Draft leaves current assignments unchanged', page.evaluate('(key)=>localStorage.getItem(key)', STORE_KEY) == before)
                page.get_by_role('button', name='Discard', exact=True).click()
                report['ok'] = True
            finally:
                if page and observed:
                    try:
                        cancel = page.get_by_role('button', name='Cancel draft', exact=True)
                        if cancel.count() and cancel.is_enabled():
                            cancel.click()
                            page.wait_for_function('window.__studioNativeProbe.receipt.cleaned', timeout=30000)
                    except Exception:
                        report['cleanupFailed'] = True
                        report['ok'] = False
                    finally:
                        page.evaluate('window.__studioNativeProbe?.restore()')
                # Disconnect only; this harness does not own the native process.
                browser.close()
    except Exception as error:
        # Avoid dumping gateway/provider error messages containing private context.
        report['ok'] = False
        report['failure'] = type(error).__name__
        report['failedCheck'] = next((c['name'] for c in reversed(report['checks']) if not c['pass']), 'Native prerequisites or operation unavailable')
    (out / 'verification.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))
    return 0 if report['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())
