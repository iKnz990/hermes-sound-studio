# Installation disclosures

## Desktop

The desktop bundle imports React and the public Hermes plugin SDK. It registers its own route, sidebar navigation and status bar control. Its dark theme is scoped to plugin elements.

After explicit desktop-target enablement it observes trusted DOM control events using standard roles/tags and SDK gateway events for the focused connection/profile/session. It reads the control role/type/disabled state to classify a cue; it does not read typed input values, scrape conversations, send interaction logs or rewrite core markup. It removes listeners on Disable/unload. A transient CSS energy variable is attached while that target is active.

The synthesis and analysis graph runs in Web Audio. Audio consent is transient. No event opens/resumes a device without an explicit enable or audition action.

## Optional inference

The explicit Generate sound action sends the description, selected patch and JSON schema to the active profile’s configured model in a uniquely titled, hidden Hermes conversation. Public SDK routing pins the exact connection/profile without switching the foreground chat or modifying the composer. Normal model usage and provider policies apply. The transcript remains in Hermes session storage after its runtime is released. The plugin reads only the reply/events of the conversation it created, never another chat or model credentials.

Generation exposes progress and cancellation, times out after three minutes of generation wait, and never automatically resubmits an uncertain prompt. It requests tool-free generation when the backend advertises that option; the Studio wait is bounded and cancellation uses the session’s own controls. Interactive approvals are never approved by the plugin. Profile changes or unload cancel pending work and release its socket lease. A validated candidate is fine-tuned/auditioned locally and accepted explicitly. The separate native draft tool remains optional and retains its configured-provider bridge.

## Files and processes

Projects/presets/compositions use plugin-owned desktop storage. Native draft records use the plugin data directory. Schema and preset reads stay in the package.

The audit/injection tools can read the explicitly requested external project: package metadata, a generated module and eligible JSX/TSX source. Dry-run is the default. A registered `pre_tool_call` hook requires Hermes human approval for `inject_sonic_hooks` with `apply: true` and `synthesize_ui_soundscape` with `output_path`; persistent grants are scoped to that tool and destination. Native paths are checked against Hermes’s write denylist and reject Hermes home/profile, install and plugin trees, including resolved aliases. Apply rechecks input/module hashes, confines paths, preserves backups and refuses unsupported syntax. The tools spawn a bounded `node` parser process with argument arrays and an eight-second timeout, without a shell. Its explicit environment contains only PATH, HOME, LANG and, on Windows, SYSTEMROOT; credentials and Node preload settings are not inherited. The deterministic exporter can write a new explicitly requested file and refuses an existing target.

An explicit asynchronous model request can run one daemon worker thread within the host process. There is no persistent sidecar service or startup daemon.

## Distribution

No self-updater, binary executable, credentials or personal workspace records are shipped. The runtime includes readable JavaScript bundles, Python source, schemas, presets and notices. Development dependencies are pinned separately in package-lock.json. The optional dashboard REST bridge is plugin-local and uses the bound native service.
