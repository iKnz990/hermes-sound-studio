import engineSource from '../assets/audio-engine.ts?raw';
import type { SonicPatch } from '../assets/audio-engine';
import { safePatch } from './preferences';

// Python compiler.py: json.dumps(valid, ensure_ascii=True, separators=(',', ':')).
// This applies the same UTF-16 surrogate escaping to JSON.stringify output.
export function compactPythonJson(value: unknown): string {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
export function compileWorkbenchHook(patch: SonicPatch, enableCssVars = true): string {
  if (!safePatch(patch)) throw new Error('Invalid sonic patch');
  const source = engineSource.replace(/\r\n?/g, '\n');
  return source + (source.endsWith('\n') ? '' : '\n') + '\n' +
    `export const SONIC_PATCH = ${compactPythonJson(patch)} as const;\n` +
    `export const sonic = new SonicEngine(SONIC_PATCH, {enableCssVars: ${enableCssVars}});\n` +
    'export const useSonicUI = () => sonic;\n';
}
