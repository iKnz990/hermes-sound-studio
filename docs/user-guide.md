# User guide

## Design and save

Select an event in the left library. A sound preset replaces only that event; a palette replaces all six event sounds. A project saves the six sounds and render settings. Compose is a separate document.

Beginner offers style, character, duration, intensity and a two-axis filter pad. The pad's vertical axis is logarithmic cutoff; its horizontal axis chooses resonance or voice drive. Advanced adds oscillators, chord intervals, shaping, modulation, effects and routing.

Drag knobs vertically or use arrow keys. Filled bars adjust a parameter and show its value inline. Click a parameter readout to type; Enter applies and Escape cancels. Tempo, meter, root and bar pills scrub vertically and edit on double-click or Enter. Root pills accept note names such as A3 and C♯4.

Save project creates a named project. Recovery drafts and unsaved edits are labelled separately. If storage cannot be verified, export JSON before closing. Replacements use inline review; stale reviews cannot overwrite later edits.

## Sound Draft

Click **Sound Draft**, describe the sound, and choose **Generate sound**. Hermes creates a separate background conversation using the active profile’s configured model and a prompt containing your request, starting patch, full JSON schema and synthesis limits. Studio stays open; existing chats and composer drafts are untouched. Generation can incur normal model usage.

Progress and **Cancel draft** stay in the panel. You can close it or leave Studio while the request runs; the toolbar shows **Working** or **Ready** when you return. A profile/connection change cancels that profile’s pending request. An uncertain request is never automatically resubmitted.

When the validated patch arrives, **Fine tune** shows the features it contains: oscillator voices, chords, envelope, filter, modulation and effects. Edit the candidate, **Audition draft**, or **Stop draft preview**. Parameter changes are silent. **Accept draft** replaces the original selected sound only after review; **Discard** keeps the current sound. If you edited or changed the selected sound while generation ran, acceptance is disabled so the result cannot overwrite newer work. Generate again for the current sound.

Review measures the actual rendered peak at unity master. Below −24 dBFS, **Balance draft level** targets approximately −18 dBFS: gain first, then proportional source levels or intensity if necessary. Pitch, timing, filter and effects are preserved, although drive or velocity modulation can respond to level changes. Audition again before accepting. Silent patches get a diagnosis, and zero Master output is reported separately. Draft preview plays the full rendered tail and has its own Stop button.

**Import JSON instead** retains manual SoundPatch/v1 review. Paste JSON and choose **Review sound JSON** to use the same Fine tune, audition and acceptance controls. Starting generation never enables audio or applies a patch. The playback timeline is permanently docked next to the transport; its clock moves without inserting rows or shifting the editor.

## Use the desktop assignments

In Event assignment, click **Enable desktop sounds**. Target becomes **Hermes Desktop**. Changes to the six sounds update the active target immediately.

| Assignment | Trigger |
| --- | --- |
| Hover | Enter an enabled host control. Child elements do not retrigger the same hover. |
| Focus | Focus an enabled host control. |
| Confirm | Activate a host action or submit a form. |
| Toggle | Change a checkbox, radio or select, or activate a switch/tab/toggle button. |
| Error | Native form validation or a matching focused-session backend failure. |
| Task complete | A successful matching focused-session completion. |

Automatic cues exclude Sound Studio and Compose controls, so shaping a patch stays quiet. Synthetic events and disabled controls are ignored. Hover and repeated cues are throttled.

The desktop target survives leaving Sound Design. Mute and Disable stay in the status bar. Disable detaches its listeners and stops target audio. Reload starts with desktop sounds off. A focused scope change stops old voices and pending target work. Built-in Hermes notification sounds have their own settings.

Audition is a separate local preview action. It enables/unmutes preview and plays the selected sound. Preview, desktop target and Compose have distinct audio controls.

Sound Design and Compose retain their audio readiness and mute setting while you navigate away and return, including opening a Sound Draft chat. Leaving stops playback; returning does not autoplay. Audition draft also enables the main preview controls. These settings last for the current app/plugin session; reload starts with audio off.

## Compose a loop

Set tempo, meter, root and total bars in the toolbar. Root transposes existing pitches atomically. Add Layer is below the track headers; each track's ··· menu duplicates sound, duplicates sound plus pattern, or deletes a layer. Undo is in Document actions.

Select a track to show its Step Grid. Click an empty cell to add a note or drag to set its length. Clicking a note selects it; clicking its already-selected onset deletes it. Sustain clicks remain selection-only. Shift/right-click or Delete/Backspace with grid focus removes a note. Overlapping notes have a chooser.

The piano keybed distinguishes natural and accidental rows. Fold to Scale uses the displayed root and Minor/Major choice, retaining existing out-of-scale notes. The 40px velocity lane changes each note's actual intensity. Track level, pan, Mute and session-only Solo feed the output mix. The narrow meters read live layer peaks.

Drag the ruler to seek. Drag the loop handles or use arrow keys to set the active range; markers never delete notes. Changing total bars or meter resets the range. Timing and document changes stop playback. Ordinary note and sound edits prepare a new schedule and adopt it on a safe upcoming bar; a failed update leaves the accepted loop playing with an error.

## Export and measurements

- Sound WAV: stereo 32-bit float PCM at the selected 44.1, 48 or 96 kHz render rate, including effect tails.
- Composition WAV: 48 kHz stereo float, one active range plus tails. It respects note velocity, layer level/pan, Mute and Solo.
- JSON: editable SoundTheme/v1 or Composition/v1 records.
- Precision TypeScript: the canonical renderer and theme, without a Hermes/React runtime dependency. Enable it from an explicit user gesture and dispose it at teardown.
- Sonic approximate export: a labelled, lossy FM translation. Read its warnings; it is separate from precision playback.

Dry duration includes release. Render buffer length includes bounded tail allowance and is not measured audible duration. Sound analysis uses rendered PCM. Waveforms/spectra are relative visualizations; absolute peak/RMS readings are separate. Live header and track meters measure playback, not speaker loudness.

## Compatibility and limits

The renderer bounds a note body to 2.5 seconds. The composition storage horizon is 16 beats; up to four bars and eight layers are supported. There is no probability lane, arbitrary clip dragging, song-section arranger or stem export in this release.

Optional pan/loop and oscillator detune/pan/spread fields are accepted by this release. Older builds do not understand them. Legacy patches with omitted or zero-valued oscillator extensions retain their existing synthesis behavior. Export new work before restoring an older build.

The testing-only Live Telemetry view and route are removed. Sound Design and Compose are the two workspace destinations.
