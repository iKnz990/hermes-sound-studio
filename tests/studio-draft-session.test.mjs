import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
const built=await build({stdin:{contents:`export * from './desktop-src/studio-draft-session';export {createSoundPatch} from './assets/studio-engine';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const api=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].contents).toString('base64'));
const patch=api.createSoundPatch();
test('prompt contains the request, event, complete schema, validated patch and DSP limits',()=>{
 const before=JSON.stringify(patch),prompt=api.soundDraftPrompt('A warm confirmation bell','onCommit',patch);
 assert.match(prompt,/User request: "A warm confirmation bell"/);assert.match(prompt,/SoundPatch\/v1/);assert.match(prompt,/Exact JSON Schema:/);assert.match(prompt,/18522 Hz/);assert.match(prompt,/ADSR a\/d\/r are milliseconds/);assert.match(prompt,/env2 disabled/);assert.ok(prompt.includes(JSON.stringify(patch,null,2)));assert.equal(JSON.stringify(patch),before);
 assert.match(prompt,/0\.11 safety gain/);assert.match(prompt,/Do not stack low intensity/);assert.match(prompt,/-18 dBFS/);assert.doesNotMatch(prompt,/Use conservative level and intensity/);
});

test('invalid requests and patches cannot build a prompt',()=>{for(const request of ['', 'x'.repeat(1501)])assert.throws(()=>api.soundDraftPrompt(request,'onCommit',patch));assert.throws(()=>api.soundDraftPrompt('bell','invalid',patch));assert.throws(()=>api.soundDraftPrompt('bell','onCommit',{...patch,duration:NaN}));});
