# Changelog

## 0.5.01 — 2026-11-10

- Require Hermes human approval before native TypeScript output writes or JSX/TSX injection applies; scope persistent approvals to the destination.
- Check native paths against the host write denylist and refuse Hermes home, active profile, install and plugin trees, including resolved aliases.
- Run the Node injector with only PATH, HOME, LANG and SYSTEMROOT on Windows; do not inherit credentials or Node preload options.
- Add regression coverage for write approval, protected paths and real child-process environment isolation.

## 0.5.0 — 2026-11-09

- Run Sound Draft in a separate background conversation without changing routes or composer drafts. Add progress, cancellation and feature-aware Fine tune review; protect newer edits from late results.
- Dock the playback clock beside the transport with reserved idle space; prevent focus helper copy from moving the editor.
- Keep draft effect tails intact, add Stop draft preview, and make candidate toggles update immediately.
- Retain Sound Design and Compose audio readiness/mute during navigation, stopping playback on departure and releasing devices on unload.
- Calibrate generated levels, measure quiet/silent candidates, and offer explicit draft-only level balancing.
- Connect six event assignments to the opt-in Hermes Desktop target with live updates and status-bar mute/disable.
- Replace raw floating-point readouts and stacked controls with compact precision controls and editable value pills.
- Dock Arrangement and Step Grid into a fixed workspace; add loop handles, piano shading, scale folding, velocity, pan and live meters.
- Add oscillator fine detune/pan/unison spread; honor active loop bounds and layer pan in WAV export.
- Remove testing-only Live Telemetry and prepare a clean, validated source/runtime release and submission material.
