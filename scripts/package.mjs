import {fileURLToPath} from 'node:url';
import {runPython} from './python.mjs';
const result=runPython(['scripts/package.py',...process.argv.slice(2)],{cwd:fileURLToPath(new URL('../',import.meta.url))});
process.stdout.write(result.stdout+result.stderr);
if(result.error)throw result.error;
if(result.status!==0)process.exitCode=result.status??1;
