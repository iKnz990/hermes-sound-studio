"""Bounded Python schema interpreter must agree with canonical TypeScript validator."""
import copy
import importlib.util
import json
import pathlib
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location('studio_backend_schema_parity',ROOT/'studio_backend.py')
BACKEND=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BACKEND)
PALETTES=json.loads((ROOT/'assets/studio-palettes.json').read_text(encoding='utf-8'))
BASE=PALETTES[0]['events']['onCommit']


def cases():
    result=[(f'palette:{p["name"]}:{event}',patch) for p in PALETTES for event,patch in p['events'].items()]
    def changed(label,fn):
        patch=copy.deepcopy(BASE);fn(patch);result.append((label,patch))
    changed('seed boolean',lambda p:p.update(seed=True))
    changed('seed fractional',lambda p:p.update(seed=2.3))
    changed('seed integral float',lambda p:p.update(seed=1.0))
    changed('seed max',lambda p:p.update(seed=4294967295))
    changed('seed too large',lambda p:p.update(seed=4294967296))
    changed('number boolean',lambda p:p.update(intensity=False))
    changed('number NaN',lambda p:p.update(intensity=float('nan')))
    changed('number infinity',lambda p:p.update(duration=float('inf')))
    changed('unknown top',lambda p:p.update(remoteSampleUrl='https://example.invalid/test.wav'))
    changed('missing nested',lambda p:p['osc1'].pop('vol'))
    changed('unknown nested',lambda p:p['osc1'].update(extra=True))
    changed('env2 numeric zero',lambda p:p['env2'].update(enabled=0))
    changed('env2 enabled',lambda p:p['env2'].update(enabled=True))
    changed('blank label',lambda p:p.update(name='  '))
    changed('control label',lambda p:p.update(name='A\x7fB'))
    changed('label 80',lambda p:p.update(name='a'*80))
    changed('label 81',lambda p:p.update(name='a'*81))
    changed('chords empty',lambda p:p.update(chords=[]))
    changed('chords max',lambda p:p.update(chords=[0]*6))
    changed('chords over',lambda p:p.update(chords=[0]*7))
    changed('matrix 12',lambda p:p.update(modMatrix=[copy.deepcopy(p['modMatrix'][0])]*12))
    changed('matrix 13',lambda p:p.update(modMatrix=[copy.deepcopy(p['modMatrix'][0])]*13))
    changed('ADSR exceeds duration',lambda p:p.update(duration=0.02))
    changed('ADSR boundary',lambda p:(p.update(duration=0.02),p['adsr'].update(a=10,d=5,r=5.001)))
    changed('frequency exceeds',lambda p:(p.update(baseFreq=4000,chords=[24]),p['osc1'].update(enabled=True,tune=24)))
    changed('disabled high freq',lambda p:(p.update(baseFreq=4000,chords=[24]),[(p[k].update(enabled=False,tune=24)) for k in ('osc1','osc2','osc3')]))
    changed('enabled high freq second',lambda p:(p.update(baseFreq=4000,chords=[24]),p['osc1'].update(enabled=False),p['osc2'].update(enabled=True,tune=24)))
    order=['eq','saturation','compressor','chorus','delay','reverb']
    changed('fxOrder canonical',lambda p:p.update(fxOrder=order.copy()))
    changed('fxOrder reversed',lambda p:p.update(fxOrder=list(reversed(order))))
    changed('fxOrder empty',lambda p:p.update(fxOrder=[]))
    changed('fxOrder duplicate',lambda p:p.update(fxOrder=order[:-1]+['eq']))
    changed('fxOrder unknown',lambda p:p.update(fxOrder=order[:-1]+['unknown']))
    changed('fxOrder missing',lambda p:p.update(fxOrder=order[:-1]))
    changed('fxOrder string',lambda p:p.update(fxOrder='eq'))
    changed('fxOrder null',lambda p:p.update(fxOrder=None))
    changed('fx numeric',lambda p:p['fx'].update(eq=1))
    changed('mode enum',lambda p:p['playback'].update(mode='loop'))
    return result


class StudioSchemaParity(unittest.TestCase):
    def test_against_canonical_typescript(self):
        values=cases()
        code=r'''const ts=require('typescript'),fs=require('fs');
const src=fs.readFileSync('assets/studio-engine.ts','utf8');
const js=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const m={exports:{}};new Function('module','exports',js)(m,m.exports);
const vals=JSON.parse(fs.readFileSync(0,'utf8'));
console.log(JSON.stringify(vals.map(v=>{try{m.exports.validateSoundPatch(v);return true}catch(e){return false}})));
'''
        # NaN cannot cross JSON; represent it with null for the TS call (also rejected).
        wire=json.dumps([p for _,p in values],allow_nan=True).replace('NaN','null').replace('Infinity','null')
        run=subprocess.run(['node','-e',code],input=wire,text=True,capture_output=True,cwd=ROOT,timeout=30,check=True)
        expected=json.loads(run.stdout)
        actual=[]
        for label,patch in values:
            try:BACKEND.validate_patch(patch)
            except ValueError:actual.append(False)
            else:actual.append(True)
        self.assertEqual(len(actual),len(expected))
        self.assertEqual([(n,a,e) for (n,_),a,e in zip(values,actual,expected) if a!=e],[])
        self.assertEqual(sum(actual[:len(PALETTES)*6]),len(PALETTES)*6)
        decisions=dict(zip((label for label,_ in values),actual))
        self.assertTrue(decisions['fxOrder canonical'])
        self.assertTrue(decisions['fxOrder reversed'])
        for label in ('fxOrder empty','fxOrder duplicate','fxOrder unknown','fxOrder missing','fxOrder string','fxOrder null'):
            self.assertFalse(decisions[label],label)
        self.assertNotIn('fxOrder',BACKEND.validate_patch(BASE))
        self.assertEqual(BACKEND.validate_patch(dict(BASE,fxOrder=list(reversed(['eq','saturation','compressor','chorus','delay','reverb']))))['fxOrder'],list(reversed(['eq','saturation','compressor','chorus','delay','reverb'])))

    def test_schema_drift_rejected(self):
        schema=json.loads((ROOT/'assets/sound-patch-v1.schema.json').read_text())
        import tempfile
        from unittest.mock import patch
        for mutation in (
            lambda s:s['properties']['seed'].update(multipleOf=2),
            lambda s:s['x-dspConstraints'].update(lowestSupportedSampleRate=48000),
            lambda s:s['properties']['name'].update(pattern='.*'),
            lambda s:s['properties']['osc1'].update(**{'$ref':'#/$defs/unknown'}),
            lambda s:s['properties']['fxOrder']['items'].update(enum=['eq','saturation','compressor','chorus','delay','unknown']),
            lambda s:s['properties']['fxOrder'].update(uniqueItems=False),
            lambda s:s['required'].remove('fx'),
        ):
            mutated=copy.deepcopy(schema);mutation(mutated)
            with tempfile.TemporaryDirectory(dir=ROOT/'evidence/studio-v1') as temp:
                location=pathlib.Path(temp);(location/'assets').mkdir()
                (location/'assets/sound-patch-v1.schema.json').write_text(json.dumps(mutated),encoding='utf-8')
                with patch.object(BACKEND,'ROOT',location):
                    self.assertRaises(ValueError,BACKEND.validate_patch,BASE)

if __name__=='__main__':unittest.main(verbosity=2)
