"""Emit the single canonical engine byte-for-byte with validated patch bindings."""
from __future__ import annotations
import json
from pathlib import Path
from .synth_schema import validate_patch

ENGINE_PATH = Path(__file__).resolve().parent / 'assets' / 'audio-engine.ts'


def compile_ts_hook(patch: dict, enable_css_vars: bool = True) -> str:
    valid = validate_patch(patch)
    if type(enable_css_vars) is not bool:
        raise ValueError('enable_css_vars must be a boolean')
    engine = ENGINE_PATH.read_text(encoding='utf-8')
    if not engine or 'export class SonicEngine' not in engine:
        raise ValueError('canonical audio engine is missing or invalid')
    encoded = json.dumps(valid, ensure_ascii=True, separators=(',', ':'), allow_nan=False)
    return (engine + ('' if engine.endswith('\n') else '\n') + '\n'
            + f'export const SONIC_PATCH = {encoded} as const;\n'
            + f'export const sonic = new SonicEngine(SONIC_PATCH, {{enableCssVars: {str(enable_css_vars).lower()}}});\n'
            + 'export const useSonicUI = () => sonic;\n')
