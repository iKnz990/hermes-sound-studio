import copy
import json
from pathlib import Path
import unittest
from studio_backend import validate_patch

class WorkspaceUpgradeTests(unittest.TestCase):
    def setUp(self):
        palettes = json.loads((Path(__file__).resolve().parents[1] / 'assets/studio-palettes.json').read_text(encoding='utf-8'))
        self.patch = copy.deepcopy(palettes[0]['events']['onCommit'])

    def test_legacy_shape_is_preserved(self):
        self.assertEqual(validate_patch(self.patch), self.patch)

    def test_fine_controls_round_trip(self):
        self.patch['osc1'].update(detune=12, pan=-0.5, spread=20)
        self.assertEqual(validate_patch(self.patch), self.patch)

    def test_fine_controls_reject_invalid_values(self):
        for key, value in [('detune',101), ('pan',1.01), ('spread',51), ('spread',-1), ('unknown',0)]:
            with self.subTest(key=key, value=value):
                patch = copy.deepcopy(self.patch)
                patch['osc1'][key] = value
                with self.assertRaises(ValueError):
                    validate_patch(patch)

if __name__ == '__main__':
    unittest.main()
