# Install from GitHub

```sh
hermes plugins install https://github.com/iKnz990/hermes-sound-studio
```

The repository includes its built runtime. Add `--ref FULL_40_CHARACTER_COMMIT_SHA` to pin an exact reviewed commit. Catalog listing is subject to Hermes maintainer review.

# Install the prebuilt package

The runtime archive is already built. It includes the desktop bundle, Python tools, schemas and notices. Use the source archive for npm build, tests, catalog generation or development.

1. Extract `hermes-sonic-ui` into your configured Hermes home's `plugins` directory. The result must be `<HERMES_HOME>/plugins/hermes-sonic-ui/plugin.yaml`. Preserve an existing plugin folder before replacing it.
2. Run `hermes plugins doctor hermes-sonic-ui --ci` and `hermes plugins enable hermes-sonic-ui` using that Hermes installation/profile.
3. In Hermes Desktop's Plugins settings, rescan/enable **Hermes Sound Studio**. Open **Sound Studio** from the sidebar.
4. Use Audition for a local preview. In Event assignment, **Enable desktop sounds** activates the app-wide target. Status-bar Mute/Disable stay available outside the editor.

Hermes Desktop 0.23.0+ is required. The optional JSX/TSX tools require Node.js on PATH. Sound Draft runs a separate background conversation through public profile-routing/session APIs and displays validated results in Studio for fine tuning. Older desktops without these APIs can still edit, audition and import JSON manually. Manual synthesis does not require inference. The separate native draft tool retains its optional bridge.

Audio is off after reload. Existing built-in Hermes notification sounds retain their separate settings. The documented build/test commands in README apply to the source distribution.

