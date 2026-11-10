import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runPython} from './python.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const script of ['scripts/browser-build.mjs','scripts/workspace-upgrade-oracle.mjs']){const result=spawnSync(process.execPath,[script],{cwd:root,stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);}
for(const [script,out] of [['scripts/workspace-upgrade-proof.py','evidence/browser/workspace'],['scripts/desktop-target-browser-proof.py','evidence/browser/desktop-target'],['scripts/draft-session-browser-proof.py','evidence/browser/draft-session'],['scripts/audio-session-browser-proof.py','evidence/browser/audio-session']]){const result=runPython([script,out],{cwd:root});process.stdout.write(result.stdout+result.stderr);if(result.status!==0)process.exit(result.status??1);}
