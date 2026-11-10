# Third-party notices

`dist/injector.cjs` includes the TypeScript parser from TypeScript 6.0.3, distributed under the Apache License, Version 2.0. The full upstream license is included in `licenses/TypeScript-LICENSE.txt`; upstream project: https://github.com/microsoft/TypeScript. The bundle also retains esbuild's collected legal comments.

React and the Hermes desktop SDK are host-provided runtime imports, not bundled copies. Development dependencies and their licenses remain in the pinned npm dependency tree. The generated application TypeScript engine has no external runtime dependencies.
