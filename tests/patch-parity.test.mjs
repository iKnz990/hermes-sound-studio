import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const presets=JSON.parse(fs.readFileSync(path.join(root,'assets/presets.json'),'utf8'));
const output=await build({absWorkingDir:root,stdin:{contents:'export * from "./desktop-src/preferences.ts";export * from "./desktop-src/export.ts";',resolveDir:root},bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'raw',setup(b){b.onResolve({filter:/\?raw$/},a=>({path:path.resolve(a.resolveDir,a.path.replace(/\?raw$/,'')),namespace:'raw'}));b.onLoad({filter:/.*/,namespace:'raw'},a=>({contents:fs.readFileSync(a.path,'utf8'),loader:'text'}));}}]});
const api=await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
const copy=()=>structuredClone(presets.nocturnal_dark);
const defaults={preset:'nocturnal_dark',patch:copy(),volume:.12};
const cases=[];
const invalid=(name,edit)=>{const patch=copy();edit(patch);cases.push({name,patch,valid:false});};
invalid('invalid CSS color',p=>p.css_accent_hex='red; background:url(https://invalid.example)');
invalid('trailing color newline',p=>p.css_accent_hex='#990001\n');
invalid('extra patch property',p=>p.unexpected=true);
invalid('extra event',p=>p.events.onExtra=structuredClone(p.events.onHover));
invalid('extra voice property',p=>p.events.onCommit.unexpected=true);
invalid('missing patch field',p=>delete p.aesthetic_rationale);
invalid('missing event',p=>delete p.events.onFocus);
invalid('missing voice field',p=>delete p.events.onError.pan);
invalid('empty palette',p=>p.palette_name='');
invalid('overlong palette',p=>p.palette_name='x'.repeat(81));
invalid('empty rationale',p=>p.aesthetic_rationale='');
invalid('overlong rationale',p=>p.aesthetic_rationale='x'.repeat(401));
invalid('control character',p=>p.palette_name='bad\nname');
invalid('rationale control',p=>p.aesthetic_rationale='bad\u0000value');
invalid('overlong unicode palette',p=>p.palette_name='🎵'.repeat(81));
invalid('hover gain rejected not normalized',p=>p.events.onHover.gain=.041);
invalid('boolean fundamental',p=>p.fundamental_hz=true);
invalid('boolean semitone',p=>p.events.onCommit.chord_intervals=[true]);
invalid('fractional semitone',p=>p.events.onCommit.chord_intervals=[.5]);
invalid('wrong enum',p=>p.events.onError.filter_type='notch');
invalid('derived frequency',p=>{p.fundamental_hz=1000;p.events.onCommit.freq_ratio=16;p.events.onCommit.chord_intervals=[24]});
for(const [name,patch] of Object.entries(presets))cases.push({name,patch,valid:true});
const custom=copy();custom.palette_name='🎵'.repeat(80);custom.aesthetic_rationale='Custom '+'É'.repeat(393);custom.css_accent_hex='#a0Bc12';custom.events.onCommit.pan=.4;
cases.push({name:'valid bounded custom unicode',patch:custom,valid:true});
for(const entry of cases){
  test(`desktop contract: ${entry.name}`,()=>{
    const before=JSON.stringify(entry.patch),checked=api.safePatch(entry.patch);
    assert.equal(checked!==null,entry.valid);
    assert.equal(JSON.stringify(entry.patch),before,'validation never normalizes caller data');
    const loaded=api.loadPreferences({get(){return {preset:'custom',patch:entry.patch,volume:.25}},set(){}},defaults);
    if(entry.valid){assert.deepEqual(checked,entry.patch);assert.notEqual(checked,entry.patch);assert.deepEqual(loaded.patch,entry.patch);assert.equal(loaded.volume,.25)}
    else assert.equal(loaded,defaults,'invalid persisted patch must fall back entirely');
  });
}
test('desktop accept/reject decisions agree with native validator for entire JSON case matrix',()=>{
  const result=spawnSync('python',['-B','-c',`import sys,json\nfrom synth_schema import validate_patch\nrows=json.load(sys.stdin)\nout=[]\nfor row in rows:\n try:\n  validate_patch(row['patch']);out.append(True)\n except (ValueError,TypeError,OverflowError):out.append(False)\nprint(json.dumps(out))`],{cwd:root,input:JSON.stringify(cases),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);const native=JSON.parse(result.stdout);
  assert.deepEqual(native,cases.map(c=>c.valid));assert.deepEqual(native,cases.map(c=>api.safePatch(c.patch)!==null));
});
test('export validates patch and valid custom TypeScript matches native compiler',()=>{
  assert.throws(()=>api.compileWorkbenchHook(cases[0].patch),/patch/i);
  const result=spawnSync('python',['-B','-c',`import sys,json,types,importlib.util\npkg=types.ModuleType('p');pkg.__path__=['.'];sys.modules['p']=pkg\nfrom p.compiler import compile_ts_hook\nsys.stdout.buffer.write(compile_ts_hook(json.load(sys.stdin)).encode('utf-8'))`],{cwd:root,input:JSON.stringify(custom),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);assert.equal(api.compileWorkbenchHook(custom),result.stdout);
});
