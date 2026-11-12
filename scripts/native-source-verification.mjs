import ts from 'typescript';
import {pathToFileURL} from 'node:url';

export const HOST_MODULES=Object.freeze(['@hermes/plugin-sdk','react','react/jsx-runtime','react/jsx-dev-runtime']);

/** Parse code, never import-looking text in a comment, regex or template.
 * Live URLs are admitted only after the caller verifies their shim source.
 * Keep each dependency's identity instead of erasing every import target. */
export function canonicalModule(source,liveShims=null){
 if(typeof source!=='string')throw new TypeError('Expected module source');
 source=source.replace(/\r\n/g,'\n');
 const tree=ts.createSourceFile('candidate.js',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 if(tree.parseDiagnostics.length)throw new Error('Invalid JavaScript module');
 const edits=[];
 function visit(node){
  if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword)throw new Error('Dynamic imports are not supported by native provenance verification');
  if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)&&node.moduleSpecifier){
   const literal=node.moduleSpecifier;
   if(!literal||!ts.isStringLiteral(literal))throw new Error('Expected literal module specifier');
   const target=literal.text;
   const identity=liveShims===null?target:Object.hasOwn(liveShims,target)?liveShims[target]:null;
   if(!HOST_MODULES.includes(identity))throw new Error('Unverified module dependency');
   edits.push({start:literal.getStart(tree),end:literal.getEnd(),text:JSON.stringify(identity)});
  }
  ts.forEachChild(node,visit);
 }
 visit(tree);
 for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);
 return source;
}

export function verifyModules({expected,modules,shims}){
 if(!shims||typeof shims!=='object'||Array.isArray(shims))throw new TypeError('Verified shim map is required');
 const canonical=canonicalModule(expected),matches={};
 for(const {url,source} of modules){
  try{matches[url]=canonicalModule(source,shims)===canonical;}catch{matches[url]=false;}
 }
 return matches;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let input='';for await(const chunk of process.stdin)input+=chunk;
 process.stdout.write(JSON.stringify(verifyModules(JSON.parse(input))));
}
