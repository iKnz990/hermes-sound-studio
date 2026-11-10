import { build } from 'esbuild';
import ts from 'typescript';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const asset = path.join(root, 'assets/audio-engine.ts');
const options = { strict: true, noEmit: true, jsx:ts.JsxEmit.ReactJSX, esModuleInterop:true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution:ts.ModuleResolutionKind.Bundler, resolveJsonModule:true, allowSyntheticDefaultImports:true, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], types: [], skipLibCheck: true };
const checked=['desktop-src/plugin.tsx',asset,'assets/studio-engine.ts','desktop-src/studio-store.ts','desktop-src/studio-export.ts','desktop-src/studio-draft-session.ts','desktop-src/studio-ui.tsx','desktop-src/compose-workspace.tsx','desktop-src/studio-assets.d.ts','desktop-src/studio-sdk-dialog.d.ts'].map(p=>path.isAbsolute(p)?p:path.join(root,p));
const program = ts.createProgram(checked, options);
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCurrentDirectory: () => root, getCanonicalFileName: f => f, getNewLine: () => '\n' }));
  process.exitCode = 1;
} else {
  await mkdir(path.join(root, 'desktop'), { recursive: true });
  await mkdir(path.join(root, 'dist'), { recursive: true });
  await build({ absWorkingDir: root, entryPoints: ['desktop-src/plugin.tsx'], outfile: 'desktop/plugin.js', bundle: true, format: 'esm', platform: 'browser', target: 'es2022', jsx: 'automatic', external: ['@hermes/plugin-sdk', 'react', 'react/jsx-runtime'], legalComments: 'eof', plugins: [{ name: 'raw-text', setup(b) { b.onResolve({filter: /\?raw$/}, args => ({ path: path.relative(root, path.resolve(args.resolveDir, args.path.replace(/\?raw$/, ''))).split(path.sep).join('/'), namespace: 'raw-text' })); b.onLoad({filter: /.*/, namespace: 'raw-text'}, async args => ({ contents: await readFile(path.join(root, args.path), 'utf8'), loader: 'text' })); } }] });
  await build({ absWorkingDir: root, entryPoints: ['injector-src/injector.cjs'], outfile: 'dist/injector.cjs', bundle: true, format: 'cjs', platform: 'node', target: 'node20', minify: true, legalComments: 'eof' });
  const files = {};
  for (const relative of ['desktop/plugin.js', 'dist/injector.cjs', 'assets/audio-engine.ts']) {
    const bytes = await readFile(path.join(root, relative));
    files[relative] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  console.log(JSON.stringify({ status: 'built', uiAndEngineTypecheck: 'strict pass', files }, null, 2));
}

