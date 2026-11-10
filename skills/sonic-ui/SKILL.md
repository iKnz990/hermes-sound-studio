---
name: sonic-ui
description: Use when generating validated opt-in UI audio or planning safe JSX/TSX hook injection.
version: 0.5.0
---

# Sound Studio and Sonic UI workflow

Sound Studio is a local beginner/advanced instrument. Manual edit, audition, save and export require no AI. The new `SoundPatch/v1` and six-event `SoundTheme/v1` are separate from the retained legacy `SonicPatch` format. Never silently convert their formats. The explicit Enable desktop sounds control binds the six current assignments to the Hermes Desktop target; assignments update live, and status-bar Mute/Disable remain available outside the editor. Never claim another device was synced. Audio starts off after reload, consent is transient, and scope changes stop old voices and pending work.

In the desktop UI, Sound Draft opens a fresh normal Hermes session with the user request, current patch, full JSON schema and synthesis limits. The user copies the returned JSON back for explicit validation/review; never claim it was applied automatically. Sound Design and Compose are the only workspace destinations; testing-only Live Telemetry is removed.

Use `sonic_create_patch` with a complete `patch` for local validation and a durable reviewable draft without inference. Alternatively, supply `description` and optionally `event`/`current_patch` for an explicit configured-model request. It never changes the active Studio theme. Preserve `request_id` across an uncertain attempt; do not silently generate again. Review or audition the returned draft and explicitly accept/import it in Studio. Model support requires active native registration; a copied package is not proof of an available bridge.

Studio precision audition, analysis, exported TypeScript and WAV use the same canonical processed PCM. Match patch, seed, engine version, sample rate and master gain when comparing audio. Current desktop-target/extended-effect Chrome checks use a declared 1e-5 full-scale sample tolerance; historical exporter checks use 2e-6. This is a numerical tolerance, not a bit-exact or cross-browser guarantee. Keep tooltip explanations short and descriptive.

Use explicit audio actions for one-gesture enablement; never enable from hover, focus, preset selection, editing or telemetry. Keep engine snapshots authoritative for status. Share pending processed buffers and analysis per event, invalidate only changed rendering inputs, and let existing voices finish on edits. Preserve destructive cancellation for mute, stop, dispose and scope changes. Apply envelope normalization only to intentional UI edits, not imported or provider data.

The separate Sonic real-time approximate export is explicitly lossy and must show its conversion warnings. Do not silently sync it into legacy host audio, claim precision PCM identity, or advertise unmeasured size/latency. Preserve the canonical legacy engine in the exported TypeScript and verify the actual generated artifact, including disabled/muted import and all six event voices.

## Retained legacy tools

Use `synthesize_ui_soundscape` with `preset: nocturnal_dark`, `post_bop_chamber`, or `brutalist_mono` for an offline six-event patch. A supplied `patch` is validated locally; `brief` invokes the host-owned `sonic_patch_designer` model route and is never silently substituted for an offline preset. The canonical engine starts disabled and must be enabled by a user gesture. If writing generated TypeScript, specify an absolute new `output_path`; existing files are refused.

Use `audit_ui_silence` for read-only AST eligibility and skip reasons, not a subjective claim that a visual UI is acoustically deficient. Supply an absolute project root. Vue/Svelte, spreads, unsupported callbacks and Next app server components without `use client` are skipped or refused.

Call `inject_sonic_hooks` without `apply` to inspect a diff and input/output hashes. Explicitly review the proposed file list and ensure that `module` resolves to a separately generated TypeScript module exported at that relative project path (default `src/sonic-ui.ts`). Only then call with `apply: true`, `project_root`, and the exact returned `plan`. The apply path replans, compares hashes, retains backups under `.sonic-ui-backups`, writes only contained real JSX/TSX files, and does not overwrite a changed source. It is not a whole-project transaction against concurrent external writers. Run the application's own type check and UI behavior checks before accepting changes.
