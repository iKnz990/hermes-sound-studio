"""One bounded patch contract for presets, LLM output and emitted TypeScript."""
from __future__ import annotations
import json
import math
import re
from pathlib import Path

EVENTS = ("onHover", "onFocus", "onCommit", "onToggle", "onError", "onBackgroundTaskComplete")
WAVES = ("sine", "triangle", "square", "sawtooth")
FILTERS = ("lowpass", "highpass", "bandpass")
NUMBERS = {
    "freq_ratio": (0.01, 16), "pitch_bend_ratio": (0.1, 4),
    "mod_freq_ratio": (0.01, 32), "mod_index": (0, 500),
    "noise_mix": (0, 1), "cutoff_hz": (20, 18000),
    "q_factor": (0.1, 25), "attack_ms": (0, 3000),
    "decay_ms": (1, 3000), "gain": (0, 0.2), "pan": (-1, 1),
}
SOUND_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["waveform", "mod_waveform", "filter_type", "chord_intervals", *NUMBERS],
    "properties": {
        "waveform": {"type": "string", "enum": list(WAVES)},
        "mod_waveform": {"type": "string", "enum": list(WAVES)},
        "filter_type": {"type": "string", "enum": list(FILTERS)},
        "chord_intervals": {"type": "array", "minItems": 1, "maxItems": 6,
                            "items": {"type": "integer", "minimum": -24, "maximum": 24}},
        **{key: {"type": "number", "minimum": minimum, "maximum": maximum}
           for key, (minimum, maximum) in NUMBERS.items()},
    },
}
PATCH_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["palette_name", "aesthetic_rationale", "fundamental_hz", "css_accent_hex", "events"],
    "properties": {
        "palette_name": {"type": "string", "minLength": 1, "maxLength": 80},
        "aesthetic_rationale": {"type": "string", "minLength": 1, "maxLength": 400},
        "fundamental_hz": {"type": "number", "minimum": 40, "maximum": 1000},
        "css_accent_hex": {"type": "string", "pattern": "^#[0-9a-fA-F]{6}$"},
        "events": {"type": "object", "additionalProperties": False,
                   "required": list(EVENTS), "properties": {
                       event: {**SOUND_SCHEMA, "properties": {
                           **SOUND_SCHEMA["properties"], "gain": {**SOUND_SCHEMA["properties"]["gain"], "maximum": .04}
                       }} if event == "onHover" else SOUND_SCHEMA for event in EVENTS
                   }},
    },
}


def _number(value, low, high, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{label} must be a finite number in [{low}, {high}]")
    # Bound integers before conversion: math.isfinite(10**400) raises OverflowError.
    if isinstance(value, int):
        valid = abs(value) <= 2**53 - 1 and low <= value <= high
    else:
        valid = math.isfinite(value) and low <= value <= high
    if not valid:
        raise ValueError(f"{label} must be a finite number in [{low}, {high}]")


def _fields(value, expected, label):
    if not isinstance(value, dict) or set(value) != set(expected):
        raise ValueError(f"{label} requires exactly: {', '.join(expected)}")


def validate_patch(patch):
    """Return an independent JSON-safe patch or raise ValueError before any output is written."""
    _fields(patch, PATCH_SCHEMA['required'], 'patch')
    for key, maximum in (("palette_name", 80), ("aesthetic_rationale", 400)):
        value = patch[key]
        if not isinstance(value, str) or not 1 <= len(value) <= maximum or any(ord(c) < 32 for c in value):
            raise ValueError(f"{key} must be printable and 1..{maximum} characters")
    if not isinstance(patch['css_accent_hex'], str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', patch['css_accent_hex']):
        raise ValueError('css_accent_hex requires #RRGGBB')
    _number(patch['fundamental_hz'], 40, 1000, 'fundamental_hz')
    _fields(patch['events'], EVENTS, 'events')
    for event, sound in patch['events'].items():
        _fields(sound, SOUND_SCHEMA['required'], event)
        for key, choices in (("waveform", WAVES), ("mod_waveform", WAVES), ("filter_type", FILTERS)):
            if not isinstance(sound[key], str) or sound[key] not in choices:
                raise ValueError(f"{event}.{key} invalid")
        for key, (low, high) in NUMBERS.items():
            _number(sound[key], low, high, f"{event}.{key}")
        if event == 'onHover' and sound['gain'] > .04:
            raise ValueError('onHover.gain must be <= 0.04')
        intervals = sound['chord_intervals']
        if not isinstance(intervals, list) or not 1 <= len(intervals) <= 6 or any(type(n) is not int or not -24 <= n <= 24 for n in intervals):
            raise ValueError(f"{event}.chord_intervals must contain 1..6 bounded integers")
        # Every voice must remain in a valid audible range even after the largest bend/chord.
        for interval in intervals:
            freq = patch['fundamental_hz'] * sound['freq_ratio'] * 2 ** (interval / 12)
            if not 20 <= freq * sound['pitch_bend_ratio'] <= 18000 or not 20 <= freq <= 18000:
                raise ValueError(f"{event}: derived frequency outside 20..18000 Hz")
    return json.loads(json.dumps(patch, allow_nan=False))


def load_preset(name):
    if not isinstance(name, str) or name not in ('nocturnal_dark', 'post_bop_chamber', 'brutalist_mono'):
        raise ValueError('unknown preset')
    path = Path(__file__).resolve().parent / 'assets' / 'presets.json'
    return validate_patch(json.loads(path.read_text(encoding='utf-8'))[name])
