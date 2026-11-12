import {spawnSync} from 'node:child_process';
export function runPython(args,options={}) {
 const env={...process.env,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1',...options.env};
 // Honor the active PATH interpreter (venv/setup-python) before the Windows
 // launcher, which can select a different installation without its dependencies.
 const candidates=process.env.PYTHON?[[process.env.PYTHON,[]]]:process.platform==='win32'?[['python',[]],['py',['-3']]]:[['python3',[]],['python',[]]];
 for(const [executable,prefix] of candidates){const result=spawnSync(executable,[...prefix,...args],{encoding:'utf8',...options,env});if(result.error?.code==='ENOENT')continue;return result;}
 throw new Error('Python was not found. Set PYTHON to a Python 3.11+ executable.');
}
