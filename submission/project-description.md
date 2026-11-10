# Hermes Sound Studio

**Tagline:** Give Hermes a sound of its own.

## What it does

Hermes Sound Studio adds a small audio instrument to Hermes Desktop. Design a sound, assign it to Hover, Focus, Confirm, Toggle, Error or Task complete, then enable the desktop target to hear those assignments as you use the app.

The same sounds can become an eight-layer loop in Compose. A docked piano grid, note velocity, pan, meters and loop handles keep editing in one workspace. Export a WAV for playback, JSON for later editing, or a standalone TypeScript sound runtime for another application.

## Why it is a plugin

The result is a running desktop instrument: synthesis, visual editing, real event bindings, audio-clock sequencing, persistence and portable exports. Sound Draft creates a sound in the background, then exposes the generated features for fine tuning and explicit acceptance inside Studio. The instrument also works without an AI request.

## How it is built

The desktop half uses React, TypeScript, Web Audio and public Hermes SDK routes/status controls. A canonical renderer supplies precision audition and export. The Python half provides bounded patch validation, reviewable sound drafts and optional JSX/TSX integration tools. The plugin ships a ready-built desktop bundle and requires no external audio library or samples for synthesis.

## What to show the judges

Shape a confirmation sound, enable the desktop target, and trigger real host controls. Change the assignment and hear it update. Switch to Compose, alter a note's velocity and a loop bound, play the loop, then export it. End on the status-bar mute control.

## Reliability and scope

Audio is opt-in and starts off after reload. Invalid drafts are rejected, interrupted requests keep their identity, stale UI reviews cannot overwrite later edits, and disabling the target stops its audio/listeners. Browser checks exercise real PCM and declared tolerances; native Windows inspection is recorded separately. Compose is a four-bar, eight-layer loop instrument. External model calls, real speaker behavior and other operating systems are not claimed as fully verified.
