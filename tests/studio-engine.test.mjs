import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

const root = new URL('../assets/', import.meta.url);
const source = await readFile(new URL('studio-engine.ts', root), 'utf8').catch(() => '');
const compiled = await transform(source || 'export const missing = true', { loader: 'ts', format: 'esm' });
const api = await import(`data:text/javascript;base64,${Buffer.from(compiled.code).toString('base64')}`);
const { createSoundPatch, validateSoundPatch, validateSoundTheme, analyzePcm, encodeWav } = api;

function theme(patch) {
  return { schemaVersion: 'SoundTheme/v1', engineVersion: 'sound-studio-dsp/v1', name: 'Proof', sampleRate: 48000, masterGain: 0.72, events: Object.fromEntries(api.SOUND_EVENTS.map(k => [k, patch])) };
}

test('default patch is schema-complete, cloned, and strict for unknown fields', () => {
  const one = createSoundPatch();
  const two = createSoundPatch();
  assert.equal(one.schemaVersion, 'SoundPatch/v1');
  assert.equal(one.env2.enabled, false);
  assert.notStrictEqual(one.chords, two.chords);
  assert.deepEqual(validateSoundPatch(one), one);
  assert.notStrictEqual(validateSoundPatch(one).osc1, one.osc1);
  for (const bad of [
    { ...one, alien: true }, { ...one, env2: { ...one.env2, enabled: true } },
    { ...one, seed: -1 }, { ...one, seed: 4294967296 }, { ...one, intensity: Infinity },
    { ...one, playback: { ...one.playback, mode: 'Polyphonic' } },
    { ...one, osc1: { ...one.osc1, extra: 1 } }, { ...one, chords: Array(7).fill(0) },
    { ...one, modMatrix: Array(13).fill(one.modMatrix[0]) },
    { ...one, duration: (one.adsr.a + one.adsr.d + one.adsr.r) / 1000 - 0.05 },
    { ...one, baseFreq: 8000 }, { ...one, chords: [0, 60] },
    { ...one, baseFreq: 3500, chords: [24], osc1: { ...one.osc1, tune: 24 } }
  ]) assert.throws(() => validateSoundPatch(bad), 'invalid input accepted');
});

test('theme requires six exact keys, valid gain, no alias; returns deep clone', () => {
  const p = createSoundPatch();
  const t = theme(p);
  assert.deepEqual(validateSoundTheme(t), t);
  assert.notStrictEqual(validateSoundTheme(t).events.onHover, p);
  assert.throws(() => validateSoundTheme({ ...t, events: { ...t.events, onTaskComplete: p } }));
  assert.throws(() => validateSoundTheme({ ...t, masterGain: 100 }));
  assert.throws(() => validateSoundTheme({ ...t, events: { onHover: p } }));
});

test('measured silence is null dB and float stereo WAV has truthful header and samples', () => {
  const a = new Float32Array(16); const b = new Float32Array(16);
  a[0] = 0.25; b[1] = -0.5;
  const buffer = { numberOfChannels: 2, length: 16, sampleRate: 48000, duration: 16/48000, getChannelData: n => n ? b : a };
  const measured = analyzePcm(buffer, 8);
  assert.ok(measured.peakDb < 0 && measured.peakDb > -7);
  assert.equal(measured.sampleRate, 48000);
  assert.deepEqual(analyzePcm({ ...buffer, getChannelData: () => new Float32Array(16) }, 8).spectrum, Array(8).fill(0));
  assert.equal(analyzePcm({ ...buffer, getChannelData: () => new Float32Array(16) }).rmsDb, null);
  const wav = encodeWav(buffer); const v = new DataView(wav.buffer, wav.byteOffset);
  assert.equal(wav.length, 44 + 16*2*4);
  assert.equal(v.getUint16(20, true), 3); assert.equal(v.getUint16(22, true), 2);
  assert.equal(v.getUint32(24, true), 48000); assert.equal(v.getUint16(34, true), 32);
  assert.equal(v.getFloat32(44, true), 0.25); assert.equal(v.getFloat32(48, true), 0);
  assert.equal(v.getFloat32(52, true), 0); assert.equal(v.getFloat32(56, true), -0.5);
});

test('JSON schema has closed nested objects and bounded chords', async () => {
  const schema = JSON.parse(await readFile(new URL('sound-patch-v1.schema.json', root), 'utf8'));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.chords.maxItems, 6);
  for (const key of ['adsr','filter','env2','fx','playback']) {
    assert.equal(schema.properties[key].additionalProperties, false, key);
  }
  assert.equal(schema.$defs.oscillator.additionalProperties, false);
  assert.equal(schema.$defs.lfo.additionalProperties, false);
  assert.equal(schema.properties.env2.properties.enabled.const, false);
  assert.equal(schema['x-dspConstraints'].frequencyHeadroomSemitones, 2);
  assert.match(schema['x-dspConstraints'].adsrBodySeconds, /duration \+ 0\.000001/);
});

test('optional complete fxOrder survives validation and rejects malformed orders', async () => {
  const original=createSoundPatch();
  assert.equal(Object.hasOwn(original,'fxOrder'),false);
  assert.equal(Object.hasOwn(validateSoundPatch(original),'fxOrder'),false);
  assert.equal(Object.hasOwn(validateSoundTheme(theme(original)).events.onCommit,'fxOrder'),false);
  const order=['reverb','delay','chorus','compressor','saturation','eq'];
  assert.deepEqual(api.FX_ORDER,['eq','saturation','compressor','chorus','delay','reverb']);
  const ordered=validateSoundPatch({...original,fxOrder:order});
  assert.deepEqual(ordered.fxOrder,order);
  assert.notStrictEqual(ordered.fxOrder,order);
  assert.deepEqual(validateSoundTheme(theme(ordered)).events.onCommit.fxOrder,order);
  for(const bad of [[],order.slice(1),[...order.slice(0,5),'unknown'],[...order.slice(0,5),'reverb'],null,undefined,'eq'])
    assert.throws(()=>validateSoundPatch({...original,fxOrder:bad}),String(bad));
  const schema=JSON.parse(await readFile(new URL('sound-patch-v1.schema.json',root),'utf8'));
  assert.equal(schema.required.includes('fxOrder'),false);
  assert.equal(schema.properties.fxOrder.uniqueItems,true);
  assert.equal(schema.properties.fxOrder.minItems,6);
  assert.equal(schema.properties.fxOrder.maxItems,6);
});

test('routing describes actual legacy sends, ordered stages, bypass and modulation', () => {
  const base=createSoundPatch({fx:{eq:true,saturation:true,compressor:true,chorus:true,delay:true,reverb:true}});
  const legacy=api.describeSoundRouting(base);
  assert.equal(legacy.mode,'legacy-parallel');
  const audio=g=>g.edges.filter(e=>e.kind==='audio').map(e=>`${e.from}>${e.to}`);
  assert.ok(audio(legacy).includes('voice>eq'));
  assert.ok(audio(legacy).includes('compressor>sum'));
  for(const id of ['chorus','delay','reverb']) {
    assert.ok(audio(legacy).includes(`compressor>${id}`));
    assert.ok(audio(legacy).includes(`${id}>sum`));
  }
  assert.ok(audio(legacy).includes('sum>output-gain'));
  assert.ok(audio(legacy).includes('output-gain>limiter'));
  const order=['delay','eq','reverb','chorus','saturation','compressor'];
  const ordered=api.describeSoundRouting({...base,fxOrder:order});
  assert.equal(ordered.mode,'ordered');
  assert.ok(audio(ordered).includes('voice>delay'));
  assert.ok(audio(ordered).includes('delay>eq'));
  assert.ok(audio(ordered).includes('eq>reverb'));
  assert.ok(audio(ordered).includes('compressor>output-gain'));
  assert.equal(audio(ordered).includes('compressor>sum'),false);
  for(const source of ['lfo1','lfo2','env1','velocity'])
    assert.ok(ordered.edges.some(e=>e.from===source&&e.kind==='modulation'),source);
  const bypass=api.describeSoundRouting({...base,fxOrder:order,fx:{...base.fx,eq:false,chorus:false}});
  assert.ok(audio(bypass).includes('delay>reverb'));
  assert.ok(!audio(bypass).some(e=>e.includes('>eq')||e.startsWith('eq>')));
  assert.ok(bypass.nodes.some(n=>n.id==='eq'&&/bypass/i.test(n.label)));
  const noMod=api.describeSoundRouting({...base,modMatrix:[{source:'LFO 2',amount:0,dest:'Pan'}],lfo1:{...base.lfo1,enabled:false},lfo2:{...base.lfo2,enabled:false}});
  assert.equal(noMod.edges.filter(e=>e.kind==='modulation').length,0);
});
