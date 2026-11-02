// Compile actual upstream declarations; neither the smoke consumers nor application JS execute.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const out=path.resolve(process.argv[2]),info=JSON.parse(fs.readFileSync(path.join(out,'inputs.json'),'utf8'));
const ts=(await import(pathToFileURL(info.compilerModule))).default;assert.equal(ts.version,'5.9.3');
const canon=f=>path.resolve(f).replaceAll('\\','/').toLowerCase();
const options={strict:true,noEmit:true,incremental:false,target:ts.ScriptTarget.ES2022,
 module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,
 lib:['lib.es2022.d.ts'],types:['node'],typeRoots:[path.join(info.cache,'types')],
 paths:{'undici-types':[path.join(info.cache,'types/undici-types')]},skipLibCheck:false};
let writes=0;
function inspect(file){
 const host=ts.createCompilerHost(options);host.writeFile=()=>{writes++;throw Error('Unexpected compiler output');};
 const program=ts.createProgram([file],options,host),files=program.getSourceFiles();
 assert.deepEqual(files.filter(f=>!f.isDeclarationFile).map(f=>canon(f.fileName)),[canon(file)]);
 const libs=files.filter(f=>f.isDeclarationFile).map(f=>canon(f.fileName));
 const compilerRoot=canon(path.dirname(info.compilerModule))+'/',typeRoot=canon(path.join(info.cache,'types'))+'/';
 assert.ok(libs.every(f=>f.startsWith(compilerRoot)||f.startsWith(typeRoot)));
 assert.ok(libs.every(f=>!/(?:lib\.dom|lib\.webworker)(?:\.|\/)/.test(f)));
 assert.ok(libs.includes(canon(path.join(info.cache,'types/node/index.d.ts'))));
 assert.ok(libs.includes(canon(path.join(info.cache,'types/undici-types/index.d.ts'))));
 for(const name of ['events.d.ts','buffer.d.ts','http.d.ts','perf_hooks.d.ts'])assert.ok(libs.includes(canon(path.join(info.cache,'types/node',name))));
 return {files:libs,errors:ts.getPreEmitDiagnostics(program).map(d=>({code:d.code,file:d.file?canon(d.file.fileName):null,message:ts.flattenDiagnosticMessageText(d.messageText,' ')}))};
}
const positive=inspect(info.positive);assert.deepEqual(positive.errors,[]);
const negative=inspect(info.negative);assert.equal(negative.errors.length,1,JSON.stringify(negative.errors));
assert.equal(negative.errors[0].code,2322);assert.equal(negative.errors[0].file,canon(info.negative));assert.equal(writes,0);
const result={passed:true,compilerVersion:ts.version,upstreamDeclarationsOnly:true,positivePassed:true,
 negativeCode:2322,skipLibCheck:false,compilerEmittedFiles:0,files:positive.files,
 standardLibraryFiles:positive.files.filter(f=>f.startsWith(canon(path.dirname(info.compilerModule))+'/')).length,
 nodeDeclarationFiles:positive.files.filter(f=>f.startsWith(canon(path.join(info.cache,'types/node'))+'/')).length,
 undiciDeclarationFiles:positive.files.filter(f=>f.startsWith(canon(path.join(info.cache,'types/undici-types'))+'/')).length,
 domOrSdkAdded:false,consumersOrApplicationExecuted:false,hostRuntimeVerified:false};
fs.writeFileSync(path.join(out,'smoke-result.json'),JSON.stringify(result,null,2),{flag:'wx'});
console.log(JSON.stringify({...result,files:undefined}));
