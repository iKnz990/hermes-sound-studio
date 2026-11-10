"""Editable FX: backend contract, old-byte semantics and canonical TS parity."""
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch
import tempfile
import types
import uuid

ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location('compose_fx_backend',ROOT/'studio_backend.py')
BACKEND=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(BACKEND)
BASE=json.loads((ROOT/'assets/studio-palettes.json').read_text(encoding='utf-8'))[0]['events']['onCommit']
LIMITS={'eq':{'frequency':[40,16000],'gainDb':[-12,12],'q':[.1,8]},'saturation':{'drive':[0,10]},'compressor':{'thresholdDb':[-60,0],'ratio':[1,20],'attack':[.001,1],'release':[.01,2],'kneeDb':[0,40]},'chorus':{'rate':[.1,5],'depth':[0,.01],'mix':[0,1]},'delay':{'time':[.01,1],'feedback':[0,.7],'mix':[0,1]},'reverb':{'decay':[.05,2],'mix':[0,1]}}
DEFAULTS={'eq':{'frequency':1600,'gainDb':3.5,'q':.8},'saturation':{'drive':3},'compressor':{'thresholdDb':-25,'ratio':3.5,'attack':.003,'release':.16,'kneeDb':10},'chorus':{'rate':.9,'depth':.0035,'mix':.22},'delay':{'time':.145,'feedback':.22,'mix':.23},'reverb':{'decay':.62,'mix':.24}}

def parameter_patch():
    return dict(copy.deepcopy(BASE),fxParameters=copy.deepcopy(DEFAULTS))

class ComposeFxParameters(unittest.TestCase):
    def test_provider_contract_and_durable_draft_retain_parameters(self):
        calls=[];source=parameter_patch();source['fxParameters']['saturation']['drive']=9
        def complete(**kwargs):
            calls.append(kwargs)
            return types.SimpleNamespace(parsed=copy.deepcopy(source),provider='test-only',model='test-only')
        with tempfile.TemporaryDirectory(dir=ROOT/'evidence/compose-v1',prefix='fx-provider-') as temp:
            ctx=types.SimpleNamespace(profile_name='default',state=types.SimpleNamespace(data_dir=Path(temp)/'data'),llm=types.SimpleNamespace(complete_structured=complete))
            service=BACKEND.StudioGeneration(ctx)
            body={'request_id':str(uuid.uuid4()),'session_id':'fx-proof','event':'onCommit','current_patch':copy.deepcopy(BASE),'description':'A short local confirmation with independently driven saturation'}
            result=service.generate(body)
            self.assertEqual(result['status'],'completed');self.assertEqual(result['patch'],source)
            self.assertEqual(service.read(body['request_id'],'fx-proof')['patch'],source)
            self.assertEqual(len(calls),1)
            schema=json.loads((ROOT/'assets/sound-patch-v1.schema.json').read_text())
            self.assertEqual(calls[0]['json_schema'],schema)
            self.assertNotIn('fxParameters',calls[0]['json_schema']['required'])
            self.assertIn('all six complete effect objects',calls[0]['instructions'])
            self.assertIn('additive wet-send gain',calls[0]['instructions'])
            service.close()

    def test_complete_parameters_accepted_and_cloned(self):
        source=parameter_patch();clean=BACKEND.validate_patch(source)
        self.assertEqual(clean,source);self.assertIsNot(clean['fxParameters']['eq'],source['fxParameters']['eq'])
        self.assertEqual(BACKEND.validate_patch(BASE),BASE);self.assertNotIn('fxParameters',BACKEND.validate_patch(BASE))
        ordered=dict(source,fxOrder=list(BACKEND._FX_ORDER));self.assertEqual(BACKEND.validate_patch(ordered),ordered)

    def test_scalar_boundaries_and_invalid_shapes_match_typescript(self):
        cases=[('complete',parameter_patch(),True),('old',copy.deepcopy(BASE),True)]
        for effect,fields in LIMITS.items():
            for field,(low,high) in fields.items():
                for value in [low,high,low-.000001,high+.000001,None,True,'1',float('nan'),float('inf'),-float('inf')]:
                    p=parameter_patch();p['fxParameters'][effect][field]=value
                    cases.append((f'{effect}.{field}={value}',p,type(value) in (float,int) and low<=value<=high))
                p=parameter_patch();del p['fxParameters'][effect][field];cases.append((f'missing {effect}.{field}',p,False))
            p=parameter_patch();p['fxParameters'][effect]['extra']=0;cases.append((f'unknown {effect}',p,False))
            p=parameter_patch();del p['fxParameters'][effect];cases.append((f'missing {effect}',p,False))
        for value in [None,[],{},True,dict(DEFAULTS,unknown={})]:
            p=dict(copy.deepcopy(BASE),fxParameters=value);cases.append(('shape',p,False))
        actual=[]
        for label,p,expected in cases:
            try:BACKEND.validate_patch(p)
            except ValueError:accepted=False
            else:accepted=True
            self.assertEqual(accepted,expected,label);actual.append(accepted)
        code="""const ts=require('typescript'),fs=require('fs');const js=ts.transpileModule(fs.readFileSync('assets/studio-engine.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;const m={exports:{}};new Function('module','exports',js)(m,m.exports);console.log(JSON.stringify(JSON.parse(fs.readFileSync(0,'utf8')).map(p=>{try{m.exports.validateSoundPatch(p);return true}catch{return false}})));"""
        wire=json.dumps([p for _,p,_ in cases],allow_nan=True).replace('-Infinity','null').replace('Infinity','null').replace('NaN','null')
        run=subprocess.run(['node','-e',code],input=wire,text=True,capture_output=True,cwd=ROOT,check=True,timeout=30)
        self.assertEqual(actual,json.loads(run.stdout));print(f'FX scalar/shape parity cases: {len(cases)}')

    def test_backend_refuses_parameter_schema_drift(self):
        schema=json.loads((ROOT/'assets/sound-patch-v1.schema.json').read_text())
        self.assertIn('fxParameters',schema['properties'])
        for mutate in [lambda s:s['properties']['fxParameters']['properties']['delay']['properties']['feedback'].update(maximum=.99),lambda s:s['properties']['fxParameters']['required'].remove('eq'),lambda s:s['properties']['fxParameters'].update(additionalProperties=True)]:
            candidate=copy.deepcopy(schema);mutate(candidate)
            with tempfile.TemporaryDirectory(dir=ROOT/'evidence/compose-v1',prefix='fx-schema-') as temp:
                location=Path(temp);(location/'assets').mkdir();(location/'assets/sound-patch-v1.schema.json').write_text(json.dumps(candidate))
                with patch.object(BACKEND,'ROOT',location):self.assertRaises(ValueError,BACKEND.validate_patch,BASE)

if __name__=='__main__':unittest.main(verbosity=2)
