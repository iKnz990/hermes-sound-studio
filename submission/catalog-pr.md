# Add Hermes Sound Studio

Hermes Sound Studio adds a local sound designer, opt-in desktop event sounds and an eight-layer composition workspace. Users can assign six patches to Hermes interactions, edit and audition them, build a short loop, and export WAV, editable JSON or a standalone TypeScript runtime. Sound Draft generates a candidate in a separate background Hermes conversation and shows feature-aware Fine tune controls inside Studio.

The package uses public Desktop SDK routes, sidebar/status contributions, storage and gateway events. The desktop target observes trusted standard DOM control events only after enablement; it does not rewrite core markup, patch prototypes, import application chunks or access internal stores. The Python half registers four native tools and an optional plugin-local draft bridge. No Hermes core changes are required.

## Disclosures

- Manual synthesis is local. Sound Draft sends the description/event/starting patch/schema to the active profile’s configured model in a separate hidden conversation and may incur normal usage. Its transcript remains in Hermes storage; its runtime is released on completion/cancellation. Separate native model-draft requests retain their configured-provider route.
- The optional audit/injection tools read the explicitly requested project. Injection defaults to a diff plan, requires apply, rechecks hashes, confines paths and keeps backups.
- AST parsing launches a bounded Node process using arguments, without a shell. An explicit async draft may use one daemon worker thread. No sidecar service, analytics endpoint, credential file access or self-updater is included.
- Desktop audio consent is transient. Built-in Hermes notification sounds remain independently configured.
- Windows/Chromium is the tested desktop environment. Background Sound Draft uses the active profile’s configured model and the public profile-routing/session APIs. The separate native draft tool requires its optional default-profile bridge.

## Validation and media

- Plugin version: 0.5.0; Hermes floor: >=0.23.0.
- Public repository: **REPLACE_WITH_PUBLIC_REPOSITORY_URL**
- Exact 40-character commit: **REPLACE_WITH_REVIEWED_COMMIT_SHA**
- Paste the fresh `hermes plugins validate . --install-deps --json` result for that commit here.
- Attach `docs/images/sound-design.png`, `docs/images/compose.png` and `docs/images/fine-tune.png` from the same tree.
- Demo post: **REPLACE_WITH_X_DEMO_URL**

Local verification is documented in `docs/verification.md`; catalog acceptance remains separate. A native Windows background-generation check returned a valid patch into Fine tune without applying it; the automated browser fixture does not call a model.
