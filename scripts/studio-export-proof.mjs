// Exercise the real exporter, not a handwritten engine wrapper.
import {build,transform} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import path from 'node:path';
const root=process.cwd(),proof=path.join(root,'proof');await mkdir(proof,{recursive:true});
const raw={name:'raw',setup(b){b.onResolve({filter:/\?raw$/},a=>({path:path.resolve(a.resolveDir,a.path.slice(0,-4)),namespace:'raw'}));b.onLoad({filter:/.*/,namespace:'raw'},async a=>({contents:await readFile(a.path,'utf8'),loader:'text'}));}};
const result=await build({entryPoints:['desktop-src/studio-export.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[raw]});
const exporter=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const source=(await readFile('assets/studio-engine.ts','utf8')).replace(/\r\n?/g,'\n');
const palettes=JSON.parse(await readFile('assets/studio-palettes.json','utf8'));
const rows=[];
for(let p=0;p<palettes.length;p++)for(const rate of [44100,48000,96000]){
 const theme={...palettes[p],sampleRate:rate};const output=exporter.compileStudioRuntime(theme);
 if(!output.startsWith(source+'\n\n'))throw Error('Export does not contain exact canonical source');
 const file=`studio-export-${p}-${rate}`;
 await writeFile(path.join(proof,file+'.ts'),output);
 await writeFile(path.join(proof,file+'.js'),(await transform(output,{loader:'ts',format:'esm',target:'es2022'})).code);
 rows.push({file,theme,sha256:createHash('sha256').update(output).digest('hex')});
}
const program=ts.createProgram(rows.map(r=>path.join(proof,r.file+'.ts')),{strict:true,noEmit:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,lib:['lib.es2022.d.ts','lib.dom.d.ts'],types:[],skipLibCheck:true});
const diagnostics=ts.getPreEmitDiagnostics(program);if(diagnostics.length)throw Error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>root,getCanonicalFileName:f=>f,getNewLine:()=> '\n'}));
await writeFile(path.join(proof,'studio-export-editor.js'),(await transform(source,{loader:'ts',format:'esm',target:'es2022'})).code);
await writeFile(path.join(proof,'studio-export-fixtures.json'),JSON.stringify(rows,null,2));
const receipt={kind:'actual compileStudioRuntime output',strictTypeScript:true,exports:rows.length,expectedPcmPairs:rows.length*6,engineSha256:createHash('sha256').update(source).digest('hex'),exporterSha256:createHash('sha256').update(await readFile('desktop-src/studio-export.ts')).digest('hex'),outputHashes:rows.map(({file,sha256})=>({file,sha256}))};
await writeFile('evidence/studio-v1/export-build.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
