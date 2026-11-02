// Compile actual sources in two explicit environments; never import application modules.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const out=path.resolve(process.argv[2]),info=JSON.parse(fs.readFileSync(path.join(out,'inputs.json'),'utf8'));
const ts=(await import(pathToFileURL(info.compilerModule))).default;assert.equal(ts.version,'5.9.3');
const canon=f=>path.resolve(f).replaceAll('\\','/').toLowerCase();
const common={allowJs:true,checkJs:true,strict:true,noEmit:true,incremental:false,target:ts.ScriptTarget.ES2022,
 module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,lib:['lib.es2022.d.ts'],skipLibCheck:false};
let writes=0;
function inspect(node){
 const options={...common,types:node?['node']:[],typeRoots:node?[path.join(info.cache,'types')]:[],
  paths:node?{'undici-types':[path.join(info.cache,'types/undici-types')]}:{}};
 const host=ts.createCompilerHost(options);host.writeFile=()=>{writes++;throw Error('Unexpected compiler output');};
 const program=ts.createProgram([info.source],options,host),files=program.getSourceFiles();
 assert.deepEqual(files.filter(f=>!f.isDeclarationFile).map(f=>canon(f.fileName)).sort(),[info.source,info.protocol].map(canon).sort());
 const declarations=files.filter(f=>f.isDeclarationFile).map(f=>canon(f.fileName));
 const compilerRoot=canon(path.dirname(info.compilerModule))+'/',cacheRoot=canon(path.join(info.cache,'types'))+'/';
 assert.ok(declarations.every(f=>f.startsWith(compilerRoot)||(node&&f.startsWith(cacheRoot))));
 assert.ok(declarations.every(f=>!/(?:lib\.dom|lib\.webworker)(?:\.|\/)/.test(f)));
 const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({code:d.code,file:d.file?canon(d.file.fileName):null,
  line:d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).line+1:null,
  column:d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).character+1:null,
  message:ts.flattenDiagnosticMessageText(d.messageText,' ')}));
 assert.ok(diagnostics.every(d=>d.file===canon(info.source)),'Unexpected imported-module/declaration errors');
 const source=program.getSourceFile(info.source),checker=program.getTypeChecker();
 const declaration=source.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='FrameHub');
 const instance=checker.getDeclaredTypeOfSymbol(checker.getSymbolAtLocation(declaration.name));
 const members={};
 for(const name of ['latest','decoder','received','bytes','closed','cadenceTrace','runId','clientTrace','push','close','snapshot','on','emit']){
  const property=checker.getPropertyOfType(instance,name);
  members[name]=property?checker.typeToString(checker.getTypeOfSymbolAtLocation(property,declaration),declaration,ts.TypeFormatFlags.NoTruncation):null;
 }
 const count=prefix=>declarations.filter(f=>f.startsWith(canon(prefix)+'/')).length;
 const result={diagnosticCount:diagnostics.length,diagnostics,members,files:files.map(f=>canon(f.fileName)),
  standardLibraryFiles:count(path.dirname(info.compilerModule)),
  nodeDeclarationFiles:count(path.join(info.cache,'types/node')),
  undiciDeclarationFiles:count(path.join(info.cache,'types/undici-types'))};
 if(node){
  assert.ok(result.nodeDeclarationFiles>0&&result.undiciDeclarationFiles>0);
  assert.ok(declarations.includes(canon(path.join(info.cache,'types/node/events.d.ts'))));
  assert.ok(!diagnostics.some(d=>[2307,2304,2591,2580].includes(d.code)),'Environment is still unresolved');
 }else{
  assert.equal(result.standardLibraryFiles,57);assert.equal(result.nodeDeclarationFiles,0);assert.equal(result.undiciDeclarationFiles,0);
  assert.ok(diagnostics.some(d=>d.code===2307&&d.message.includes('node:events')));
 }
 return result;
}
const es=inspect(false),node=inspect(true);
const key=d=>JSON.stringify([d.code,d.file,d.line,d.column,d.message]);
const oldKeys=new Set(es.diagnostics.map(key)),newKeys=new Set(node.diagnostics.map(key));
const result={passed:true,scopeOnly:true,nodeTypeContextValid:true,typeRepairCompleted:false,
 compilerVersion:ts.version,esOnly:es,nodeContext:node,
 removedInNodeContext:es.diagnostics.filter(d=>!newKeys.has(key(d))),
 addedInNodeContext:node.diagnostics.filter(d=>!oldKeys.has(key(d))),
 unchangedInBoth:node.diagnostics.filter(d=>oldKeys.has(key(d))),
 compilerEmittedFiles:writes,skipLibCheck:false,moduleOrTestsExecuted:false,hostRuntimeVerified:false};
assert.equal(writes,0);
fs.writeFileSync(path.join(out,'node-baseline.json'),JSON.stringify(result,null,2),{flag:'wx'});
console.log(JSON.stringify({passed:true,esDiagnostics:es.diagnosticCount,nodeDiagnostics:node.diagnosticCount,
 removed:result.removedInNodeContext.length,added:result.addedInNodeContext.length,modulesExecuted:false}));
