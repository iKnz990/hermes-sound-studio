import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {canonicalModule,verifyModules} from '../scripts/native-source-verification.mjs';

const shims={'blob:sdk':'@hermes/plugin-sdk','blob:react':'react','blob:jsx':'react/jsx-runtime','blob:jsx-dev':'react/jsx-dev-runtime'};
const expected='import {host} from "@hermes/plugin-sdk";\nimport React from "react";\nimport {jsx} from "react/jsx-runtime";\nexport default {id:"test",value:32};';
const loaded=expected.replace('"@hermes/plugin-sdk"','"blob:sdk"').replace('"react"','"blob:react"').replace('"react/jsx-runtime"','"blob:jsx"');
const matches=source=>verifyModules({expected,modules:[{url:'candidate',source}],shims}).candidate;

test('all approved dependency identities survive genuine host rewriting and CRLF',()=>{
 assert.ok(matches(loaded.replace(/\n/g,'\r\n')));
 for(const [url,identity] of Object.entries(shims))assert.equal(canonicalModule(`import "${url}";`,shims),canonicalModule(`import "${identity}";`));
});
test('a React-to-JSX swap is rejected even when both shims are verified',()=>{
 assert.equal(matches(loaded.replace('"blob:react"','"blob:jsx"')),false);
 assert.notEqual(canonicalModule(expected),canonicalModule(expected.replace('"react"','"react/jsx-runtime"')));
});
test('unknown blobs, bare live imports, external packages and modified code fail',()=>{
 for(const target of ['blob:unverified','react','unapproved-package','https://example.invalid/react.js'])assert.equal(matches(loaded.replace('"blob:react"',JSON.stringify(target))),false);
 assert.equal(matches(loaded.replace('value:32','value:31')),false);
 assert.throws(()=>canonicalModule('import x from "unapproved-package";'));
 assert.throws(()=>verifyModules({expected,modules:[{url:'candidate',source:expected}]}));
});
test('multiline imports are parsed while import-looking strings, comments and regexes stay exact',()=>{
 const prefix='const text=`\nimport x from "first";\n`;\n// import x from "first";\nconst regex=/import x from "first"/;\n';
 assert.equal(canonicalModule(prefix+`import {\n host\n} from "blob:sdk";`,shims),canonicalModule(prefix+`import {\n host\n} from "@hermes/plugin-sdk";`));
 assert.notEqual(canonicalModule(prefix),canonicalModule(prefix.replaceAll('first','second')));
});
test('syntax errors and dynamic imports fail closed',()=>{
 assert.throws(()=>canonicalModule('import {broken from "react";'));
 assert.throws(()=>canonicalModule('const lazy=import("react");'));
});

test('the full production bundle accepts verified host rewriting but rejects a swapped React dependency',async()=>{
 const source=await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8');
 const tree=ts.createSourceFile('plugin.js',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const imports=tree.statements.filter(ts.isImportDeclaration),map={},edits=[];
 for(const item of imports){const spec=item.moduleSpecifier,url=`blob:verified-${encodeURIComponent(spec.text)}`;map[url]=spec.text;edits.push({start:spec.getStart(tree),end:spec.getEnd(),text:JSON.stringify(url)});}
 let runtime=source;for(const edit of edits.reverse())runtime=runtime.slice(0,edit.start)+edit.text+runtime.slice(edit.end);
 const swapped=runtime.replace('"blob:verified-react"','"blob:verified-react%2Fjsx-runtime"');
 assert.notEqual(swapped,runtime);
 assert.deepEqual(verifyModules({expected:source,modules:[{url:'good',source:runtime},{url:'swapped',source:swapped}],shims:map}),{good:true,swapped:false});
});
