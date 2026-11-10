# Hackathon submission pack

Entry: **Hermes Sound Studio** · package `hermes-sonic-ui` · version **0.5.0**

The supplied announcement lists **November 11, 2026, 5 PM EST**, which is **3 PM America/Denver**, as the deadline. It asks for a catalog PR and an X demo under 90 seconds, with both links in the entry form.

Prepared here:

- [Submission copy](project-description.md)
- [80-second demo script](demo-script.md)
- [X post draft](x-post.md)
- [Catalog PR description](catalog-pr.md)
- [Catalog entry template](catalog-entry.yaml.template)

To finish the external submission:

1. Use the public source at [https://github.com/iKnz990/hermes-sound-studio](https://github.com/iKnz990/hermes-sound-studio). The built `desktop/plugin.js` and `dist/injector.cjs` are committed so judges can install the pinned tree.
2. Run local catalog validation at the exact public commit, then generate the entry with `npm run catalog -- --repo https://github.com/OWNER/REPO --sha FULL_40_CHARACTER_SHA --maintainer GITHUB_HANDLE`.
3. Open the catalog PR in NousResearch/hermes-agent using that generated YAML and the prepared description.
4. Record the script with actual desktop sound and loop playback. Keep it below 90 seconds; post it on X and tag @NousResearch.
5. Submit the catalog PR and X post links in the [entry form](https://form.typeform.com/to/FwJLvOln).

Publishing the repository or opening the catalog PR does not complete the X demo and entry-form steps. Do not present screenshots or a scripted browser harness as a recorded native demo.

Rules: [catalog submission guide](https://hermes-agent.nousresearch.com/docs/developer-guide/plugins/catalog-submission). The catalog entry must pin the exact public commit, and the entry form needs the catalog PR and demo links. Placeholders in reusable templates are intentionally conspicuous.
