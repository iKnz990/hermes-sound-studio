"""No-provider tests for durable generation admission and reviewable drafts."""
import copy, importlib.util, json, pathlib, tempfile, threading, types, unittest, uuid
ROOT=pathlib.Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location('studio_backend_test',ROOT/'studio_backend.py')
backend=None
if (ROOT/'studio_backend.py').exists():
    backend=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(backend)
PATCH=json.loads((ROOT/'assets/studio-palettes.json').read_text()) [0]['events']['onCommit']
class StudioGeneration(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(dir=ROOT/'evidence/studio-v1')
        self.addCleanup(self.tmp.cleanup);self.calls=[]
        def complete(**kwargs):
            self.calls.append(kwargs);return types.SimpleNamespace(parsed=copy.deepcopy(PATCH),provider='configured-provider',model='configured-model')
        self.ctx=types.SimpleNamespace(profile_name='default',state=types.SimpleNamespace(data_dir=pathlib.Path(self.tmp.name)/'plugin-data/hermes-sonic-ui'),llm=types.SimpleNamespace(complete_structured=complete))
    def service(self):
        self.assertIsNotNone(backend,'Sound Studio backend exists');return backend.StudioGeneration(self.ctx)
    def request(self,**changes):
        body={'request_id':str(uuid.uuid4()),'session_id':'test-session','description':'A short metallic confirmation','event':'onCommit','current_patch':copy.deepcopy(PATCH)};body.update(changes);return body
    def test_generation_uses_structured_configured_route_and_saves_draft(self):
        s=self.service();body=self.request();out=s.generate(body)
        self.assertEqual(out['status'],'completed');self.assertEqual(out['patch']['schemaVersion'],'SoundPatch/v1');self.assertEqual(len(self.calls),1)
        call=self.calls[0];self.assertEqual(call['schema_name'],'SoundPatch_v1');self.assertNotIn('model',call);self.assertNotIn('provider',call);self.assertNotIn('profile',call)
        self.assertEqual(call['json_schema']['additionalProperties'],False);self.assertEqual(s.read(body['request_id'],body['session_id'])['patch'],out['patch'])
        self.assertNotIn('apply',out);self.assertEqual(out['disposition'],'draft')
    def test_duplicate_same_input_never_spends_twice_across_services(self):
        s=self.service();body=self.request();s.generate(body);out=self.service().generate(body);self.assertEqual(len(self.calls),1);self.assertEqual(out['status'],'completed')
    def test_request_id_collision_changed_prompt_rejected(self):
        s=self.service();body=self.request();s.generate(body);body['description']='Different';self.assertRaises(ValueError,s.generate,body);self.assertEqual(len(self.calls),1)
    def test_wrong_session_cannot_read_and_invalid_input_never_dispatches(self):
        s=self.service();body=self.request();s.generate(body);self.assertRaises(ValueError,s.read,body['request_id'],'other');self.assertRaises(ValueError,s.generate,self.request(request_id='../outside'));self.assertRaises(ValueError,s.generate,self.request(description=''));self.assertEqual(len(self.calls),1)
    def test_provider_invalid_or_nonfinite_patch_is_not_completed(self):
        s=self.service()
        self.ctx.llm.complete_structured=lambda **k:types.SimpleNamespace(parsed={**PATCH,'intensity':float('nan')})
        body=self.request();out=s.generate(body);self.assertEqual(out['status'],'failed');self.assertNotIn('patch',out)
    def test_unsupported_envelope_and_unknown_fields_fail_before_provider(self):
        s=self.service();bad=copy.deepcopy(PATCH);bad['env2']['enabled']=True
        self.assertRaises(ValueError,s.generate,self.request(current_patch=bad));bad=copy.deepcopy(PATCH);bad['remoteSampleUrl']='https://not-allowed.invalid/s.wav'
        self.assertRaises(ValueError,s.generate,self.request(current_patch=bad));self.assertEqual(self.calls,[])
    def test_readiness_and_polling_are_read_only_no_generation(self):
        s=self.service();self.assertTrue(s.ready()['configured_model']);self.assertFalse(self.ctx.state.data_dir.exists());self.assertRaises(FileNotFoundError,s.read,str(uuid.uuid4()),'test-session');self.assertEqual(self.calls,[])
    def test_unload_during_provider_call_discards_completion(self):
        s=self.service();started=threading.Event();release=threading.Event()
        def call(**kw):started.set();release.wait(3);return types.SimpleNamespace(parsed=PATCH)
        self.ctx.llm.complete_structured=call;body=self.request();out=[]
        t=threading.Thread(target=lambda:out.append(s.generate(body)));t.start();self.assertTrue(started.wait(2));s.close();release.set();t.join(4)
        self.assertFalse(t.is_alive());self.assertEqual(out[0]['status'],'interrupted');self.assertNotIn('patch',out[0])
    def test_scope_change_during_provider_call_discards_completion(self):
        s=self.service();started=threading.Event();release=threading.Event();out=[]
        def call(**kw):started.set();release.wait(3);return types.SimpleNamespace(parsed=PATCH)
        self.ctx.llm.complete_structured=call;body=self.request()
        t=threading.Thread(target=lambda:out.append(s.generate(body)));t.start();self.assertTrue(started.wait(2))
        self.ctx.profile_name='other';release.set();t.join(4)
        self.assertFalse(t.is_alive());self.assertEqual(out[0]['status'],'failed');self.assertNotIn('patch',out[0])
        self.assertEqual(self.calls,[])
    def test_active_profile_or_home_drift_blocks_dispatch(self):
        s=self.service();self.ctx.profile_name='other';self.assertRaises(RuntimeError,s.generate,self.request());self.assertEqual(self.calls,[])
    def test_direct_agent_patch_is_a_durable_reviewable_draft_without_inference(self):
        s=self.service();body=self.request();body.pop('description');body['patch']=copy.deepcopy(PATCH);out=s.generate(body)
        self.assertEqual(out['status'],'completed');self.assertEqual(out['disposition'],'draft');self.assertEqual(self.calls,[])
    def test_exact_dsp_predicates_and_strict_types(self):
        for mutate in (
            lambda p:p.update(seed=True),
            lambda p:p.update(intensity=False),
            lambda p:p['env2'].update(enabled=0),
            lambda p:p.update(name='  '),
            lambda p:p.update(name='A\x7fB'),
            lambda p:(p.update(duration=0.02),p['adsr'].update(a=20,d=0,r=0.01)),
            lambda p:(p.update(baseFreq=4000,chords=[24]),p['osc1'].update(enabled=True,tune=24)),
        ):
            with self.subTest(mutate=repr(mutate)):
                bad=copy.deepcopy(PATCH);mutate(bad)
                self.assertRaises(ValueError,backend.validate_patch,bad)
        acceptable=copy.deepcopy(PATCH);acceptable.update(baseFreq=4000,chords=[24])
        for key in ('osc1','osc2','osc3'):acceptable[key].update(enabled=False,tune=24)
        self.assertEqual(backend.validate_patch(acceptable),acceptable)
    def test_draft_directory_link_refused_and_no_provider_called(self):
        s=self.service();s.root.parent.mkdir(parents=True)
        elsewhere=pathlib.Path(self.tmp.name)/'elsewhere';elsewhere.mkdir()
        try:s.root.symlink_to(elsewhere,target_is_directory=True)
        except OSError as exc:self.skipTest(f'symlink unavailable: {exc}')
        self.assertRaises(RuntimeError,s.generate,self.request())
        self.assertEqual(self.calls,[])
    def test_data_directory_link_not_hidden_by_resolve(self):
        location=pathlib.Path(self.tmp.name)/'linked';real=pathlib.Path(self.tmp.name)/'real';real.mkdir()
        try:location.symlink_to(real,target_is_directory=True)
        except OSError as exc:self.skipTest(f'symlink unavailable: {exc}')
        self.ctx.state.data_dir=location
        s=self.service()
        self.assertRaises(RuntimeError,s.generate,self.request())
        self.assertEqual(self.calls,[])
    def test_draft_file_link_refused_without_dispatch(self):
        s=self.service();s.root.mkdir(parents=True)
        body=self.request();outside=pathlib.Path(self.tmp.name)/'outside.json';outside.write_text('{}',encoding='utf-8')
        target=s.root/(body['request_id']+'.json')
        try:target.symlink_to(outside)
        except OSError as exc:self.skipTest(f'symlink unavailable: {exc}')
        self.assertRaises(RuntimeError,s.generate,body)
        self.assertEqual(outside.read_text(encoding='utf-8'),'{}')
        self.assertEqual(self.calls,[])
    def test_archive_limit_refuses_new_request_without_dispatch(self):
        s=self.service()
        for _ in range(128):s._reserve(self.request())
        self.assertRaises(RuntimeError,s.generate,self.request())
        self.assertEqual(self.calls,[])

