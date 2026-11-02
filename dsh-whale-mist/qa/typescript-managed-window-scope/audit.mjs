// Parse application and test text, and compile only the actual managed-window module. Never import it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const out=path.resolve(process.argv[2]);
const info=JSON.parse(fs.readFileSync(path.join(out,'inputs.json'),'utf8'));
const ts=(await import(pathToFileURL(info.compilerModule))).default;
assert.equal(ts.version,'5.9.3');
const canon=f=>path.resolve(f).replaceAll('\\','/').toLowerCase();
function parsed(file){
  const text=fs.readFileSync(file,'utf8'),tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  assert.equal(tree.parseDiagnostics.length,0);
  return {file,text,tree};
}
function inventory(file){
  const {tree,text}=parsed(file);
  return {file,lines:text.split(/\r?\n/).length-(text.endsWith('\n')?1:0),
    imports:tree.statements.filter(ts.isImportDeclaration).map(n=>n.moduleSpecifier.text),
    exportedFunctions:tree.statements.filter(n=>ts.isFunctionDeclaration(n)&&n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))
      .map(n=>({name:n.name.text,line:tree.getLineAndCharacterOfPosition(n.getStart(tree)).line+1}))};
}
const candidateInventory=info.candidates.map(inventory);
assert.equal(candidateInventory[0].lines,122);
assert.deepEqual(candidateInventory[0].imports,[]);
const consumerImports=info.consumers.map(file=>{
  const {tree}=parsed(file);
  const declaration=tree.statements.find(n=>ts.isImportDeclaration(n)&&n.moduleSpecifier.text==='./managed-window.js');
  assert.ok(declaration);
  return {file,module:declaration.moduleSpecifier.text,names:declaration.importClause.namedBindings.elements.map(n=>n.name.text)};
});
const testInventory=info.tests.map(file=>{
  const {tree}=parsed(file),tests=[];
  function visit(node){
    if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='test'
      &&ts.isStringLiteral(node.arguments[0]))tests.push({name:node.arguments[0].text,line:tree.getLineAndCharacterOfPosition(node.getStart(tree)).line+1});
    ts.forEachChild(node,visit);
  }
  visit(tree);
  return {file,imports:tree.statements.filter(ts.isImportDeclaration).map(n=>n.moduleSpecifier.text),tests};
});
const options={allowJs:true,checkJs:true,strict:true,noEmit:true,incremental:false,target:ts.ScriptTarget.ES2022,
  module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,lib:['lib.es2022.d.ts'],skipLibCheck:false,
  types:['node'],typeRoots:[path.join(info.cache,'types')],paths:{'undici-types':[path.join(info.cache,'types/undici-types')]}};
let emitted=0;
const host=ts.createCompilerHost(options);
host.writeFile=()=>{emitted++;throw Error('Unexpected compiler output');};
const program=ts.createProgram([info.source],options,host),files=program.getSourceFiles(),checker=program.getTypeChecker();
const application=files.filter(f=>!f.isDeclarationFile);
assert.deepEqual(application.map(f=>canon(f.fileName)),[canon(info.source)]);
const libs=files.filter(f=>f.isDeclarationFile).map(f=>canon(f.fileName));
const compilerRoot=canon(path.dirname(info.compilerModule))+'/',cacheRoot=canon(path.join(info.cache,'types'))+'/';
assert.ok(libs.every(f=>f.startsWith(compilerRoot)||f.startsWith(cacheRoot)));
assert.ok(libs.every(f=>!/(?:lib\.dom|lib\.webworker)(?:\.|\/)/.test(f)));
assert.equal(libs.filter(f=>f.startsWith(compilerRoot)).length,59);
assert.equal(libs.filter(f=>f.startsWith(canon(path.join(info.cache,'types/node'))+'/')).length,66);
assert.equal(libs.filter(f=>f.startsWith(canon(path.join(info.cache,'types/undici-types'))+'/')).length,41);
const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({code:d.code,file:d.file?canon(d.file.fileName):null,
  ...(d.file?{line:d.file.getLineAndCharacterOfPosition(d.start).line+1,column:d.file.getLineAndCharacterOfPosition(d.start).character+1}:{}),
  message:ts.flattenDiagnosticMessageText(d.messageText,' ')}));
assert.ok(diagnostics.length>0);
assert.ok(diagnostics.every(d=>d.file===canon(info.source)));
const tree=program.getSourceFile(info.source);
const exports=checker.getExportsOfModule(checker.getSymbolAtLocation(tree)).map(symbol=>({name:symbol.name,
  inferredType:checker.typeToString(checker.getTypeOfSymbolAtLocation(symbol,tree),tree,ts.TypeFormatFlags.NoTruncation)}));
const byCode={};for(const d of diagnostics)byCode[d.code]=(byCode[d.code]??0)+1;
assert.equal(emitted,0);
fs.writeFileSync(path.join(out,'scope.json'),JSON.stringify({candidateInventory,consumerImports,testInventory,
  compiledApplicationFiles:application.map(f=>f.fileName),standardLibraryFiles:59,nodeDeclarationFiles:66,undiciDeclarationFiles:41,
  skipLibCheck:false,diagnosticCount:diagnostics.length,diagnosticsByCode:byCode,diagnostics,inferredExports:exports,
  compilerEmittedFiles:emitted,applicationModulesExecuted:0,runtimeTestsExecuted:0},null,2),{flag:'wx'});
