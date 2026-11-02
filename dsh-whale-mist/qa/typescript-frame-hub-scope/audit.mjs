// Source-only audit. Never import or execute FrameHub, its consumers, or the legacy tests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const out=path.resolve(process.argv[2]),info=JSON.parse(fs.readFileSync(path.join(out,'inputs.json'),'utf8'));
const ts=(await import(pathToFileURL(info.compilerModule))).default;assert.equal(ts.version,'5.9.3');
const canon=f=>path.resolve(f).replaceAll('\\','/').toLowerCase();
function parse(file){
 const text=fs.readFileSync(file,'utf8'),tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 assert.equal(tree.parseDiagnostics.length,0);return {text,tree,lines:text.split(/\r?\n/).length-(text.endsWith('\n')?1:0)};
}
function tokens(text){
 const scanner=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,text),result=[];
 for(let kind=scanner.scan();kind!==ts.SyntaxKind.EndOfFileToken;kind=scanner.scan())result.push([kind,scanner.getTokenText()]);
 return JSON.stringify(result);
}
const shared=parse(info.source),fixed=parse(info.fixed),legacy=parse(info.legacyHub);
function members(parsed){
 const declaration=parsed.tree.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='FrameHub');assert.ok(declaration);
 return Object.fromEntries(declaration.members.map(n=>[ts.isConstructorDeclaration(n)?'constructor':n.name.getText(parsed.tree),tokens(n.getText(parsed.tree))]));
}
const a=members(shared),b=members(fixed),sameMembers=Object.keys(a).filter(k=>a[k]===b[k]),differentMembers=Object.keys(a).filter(k=>a[k]!==b[k]);
assert.deepEqual(sameMembers.sort(),['close','push','snapshot']);assert.deepEqual(differentMembers,['constructor']);
const imports=shared.tree.statements.filter(ts.isImportDeclaration).map(n=>n.moduleSpecifier.text);
assert.deepEqual(imports,['node:events','./frame-protocol.js']);
const sharedStream=shared.tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='streamFrames');
const fixedStream=fixed.tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='streamFrames');
assert.notEqual(tokens(sharedStream.getText(shared.tree)),tokens(fixedStream.getText(fixed.tree)));
const traceRecords=[],responseMethods=new Set(),constructorOptions=new Set(),streamOptions=new Set();
const constructor=shared.tree.statements.find(ts.isClassDeclaration).members.find(ts.isConstructorDeclaration);
function optionKeys(node,result){
 if(ts.isPropertyAccessExpression(node)&&node.expression.getText(shared.tree)==='options')result.add(node.name.text);
 ts.forEachChild(node,n=>optionKeys(n,result));
}
optionKeys(constructor,constructorOptions);optionKeys(sharedStream,streamOptions);
function visit(node){
 if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)){
  const access=node.expression,receiver=access.expression.getText(shared.tree),name=access.name.text;
  if(receiver==='res')responseMethods.add(name);
  if(name==='record'&&['cadenceTrace','this.cadenceTrace'].includes(receiver)){
   const object=node.arguments[0];assert.ok(ts.isObjectLiteralExpression(object));
   const event=object.properties.find(p=>p.name?.getText(shared.tree)==='event');
   assert.ok(ts.isStringLiteral(event.initializer));
   traceRecords.push({event:event.initializer.text,keys:object.properties.map(p=>p.name.getText(shared.tree)),line:shared.tree.getLineAndCharacterOfPosition(node.getStart(shared.tree)).line+1});
  }
 }
 ts.forEachChild(node,visit);
}
visit(shared.tree);assert.equal(traceRecords.length,6);
assert.deepEqual([...constructorOptions].sort(),['cadenceTrace','runId']);
assert.deepEqual([...streamOptions].sort(),['cadenceTrace','clientTrace','connId','registerConnection','runId']);
// A restricted ES-only run records missing environment types; it is NOT a valid Node type check.
const options={allowJs:true,checkJs:true,strict:true,noEmit:true,incremental:false,target:ts.ScriptTarget.ES2022,
 module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,lib:['lib.es2022.d.ts'],types:[],skipLibCheck:false};
const host=ts.createCompilerHost(options);let writes=0;
host.writeFile=()=>{writes++;throw Error('Unexpected compiler output');};
const program=ts.createProgram([info.source],options,host),files=program.getSourceFiles();
assert.deepEqual(files.filter(f=>!f.isDeclarationFile).map(f=>canon(f.fileName)).sort(),[info.source,info.protocol].map(canon).sort());
const libs=files.filter(f=>f.isDeclarationFile);assert.equal(libs.length,57);
assert.ok(libs.every(f=>canon(f.fileName).startsWith(canon(path.dirname(info.compilerModule))+'/lib.')&&!/lib\.dom/.test(f.fileName)));
const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({code:d.code,file:d.file?canon(d.file.fileName):null,
 line:d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).line+1:null,
 message:ts.flattenDiagnosticMessageText(d.messageText,' ')}));
assert.ok(diagnostics.some(d=>d.code===2307&&d.message.includes('node:events')));
assert.ok(diagnostics.every(d=>d.file===canon(info.source)));
assert.equal(writes,0);
const tests=parse(info.transportTest),testNames=[];
function scanTests(node){
 if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='test'&&ts.isStringLiteral(node.arguments[0]))testNames.push(node.arguments[0].text);
 ts.forEachChild(node,scanTests);
}
scanTests(tests.tree);assert.equal(testNames.length,5);
assert.ok(testNames.includes('native C# encoder interoperates with JS decoder'));
const result={passed:true,scopeOnly:true,compilerVersion:ts.version,
 shared:{file:info.source,lines:shared.lines,imports},fixed:{file:info.fixed,lines:fixed.lines,sha256:info.fixedSha256},
 legacyQa:{file:info.legacyHub,lines:legacy.lines,sameAsFixed:legacy.text===fixed.text},
 sameRuntimeTokenMembers:sameMembers,differentRuntimeTokenMembers:differentMembers,streamImplementationDifferent:true,
 constructorOptionReads:[...constructorOptions],streamOptionReads:[...streamOptions],traceRecords,responseMethods:[...responseMethods].sort(),
 restrictedEsBaseline:{diagnostics,diagnosticCount:diagnostics.length,standardLibraryFiles:57,
  nodeEnvironmentDeclarationsPresent:false,validCompleteNodeTypeCheck:false,compilerEmittedFiles:0},
 testsInspectedOnly:testNames,hubTestsAvailableForLaterExtraction:testNames.slice(-2),
 moduleOrTestsExecuted:false,nodeTypesInstalledOrDownloaded:false,hostRuntimeVersionVerified:false};
fs.writeFileSync(path.join(out,'frame-hub-scope.json'),JSON.stringify(result,null,2),{flag:'wx'});
console.log(JSON.stringify({passed:true,sharedLines:shared.lines,fixedLines:fixed.lines,
 restrictedDiagnosticCount:diagnostics.length,nodeTypeCheckComplete:false,executedHub:false}));
