import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const out=path.resolve(process.argv[2]),info=JSON.parse(fs.readFileSync(path.join(out,'inputs.json'),'utf8'));
const part=process.argv[3];
assert.ok(['baseline-positive','negative-1','negative-2','negative-3','ast-and-legacy'].includes(part));
const ts=(await import(pathToFileURL(info.compilerModule))).default;assert.equal(ts.version,'5.9.3');
const canon=f=>path.resolve(f).replaceAll('\\','/').toLowerCase();
const options={allowJs:true,checkJs:true,strict:true,noEmit:true,incremental:false,target:ts.ScriptTarget.ES2022,
 module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,lib:['lib.es2022.d.ts'],skipLibCheck:false,
 types:['node'],typeRoots:[path.join(info.cache,'types')],paths:{'undici-types':[path.join(info.cache,'types/undici-types')]}};
let writes=0;
function inspect(module,protocol,consumer){
 const host=ts.createCompilerHost(options);host.writeFile=()=>{writes++;throw Error('Unexpected compiler output');};
 const program=ts.createProgram([module,...(consumer?[consumer]:[])],options,host),files=program.getSourceFiles();
 assert.deepEqual(files.filter(f=>!f.isDeclarationFile).map(f=>canon(f.fileName)).sort(),[module,protocol,...(consumer?[consumer]:[])].map(canon).sort());
 const libs=files.filter(f=>f.isDeclarationFile).map(f=>canon(f.fileName));
 const compilerRoot=canon(path.dirname(info.compilerModule))+'/',cacheRoot=canon(path.join(info.cache,'types'))+'/';
 assert.ok(libs.every(f=>f.startsWith(compilerRoot)||f.startsWith(cacheRoot)));
 assert.ok(libs.every(f=>!/(?:lib\.dom|lib\.webworker)(?:\.|\/)/.test(f)));
 assert.equal(libs.filter(f=>f.startsWith(compilerRoot)).length,59);
 assert.equal(libs.filter(f=>f.startsWith(canon(path.join(info.cache,'types/node'))+'/')).length,66);
 assert.equal(libs.filter(f=>f.startsWith(canon(path.join(info.cache,'types/undici-types'))+'/')).length,41);
 return {errors:ts.getPreEmitDiagnostics(program).map(d=>({code:d.code,file:d.file?canon(d.file.fileName):null,message:ts.flattenDiagnosticMessageText(d.messageText,' ')})),
  nonLibrary:files.filter(f=>!f.isDeclarationFile).map(f=>canon(f.fileName))};
}
assert.equal(info.negatives.length,14);const negatives=[];
let positive;
if(part==='baseline-positive'){
 const baseline=inspect(info.baseline,info.baselineProtocol);
 assert.deepEqual(baseline.errors.map(d=>d.code).sort((a,b)=>a-b),[...Array(9).fill(2339),...Array(3).fill(7006),...Array(3).fill(7053)]);
 assert.ok(baseline.errors.every(d=>d.file===canon(info.baseline)));
 positive=inspect(info.module,info.protocol,info.positive);assert.deepEqual(positive.errors,[]);
}
if(part.startsWith('negative-')){
 const number=Number(part.slice(-1)),selected=info.negatives.slice((number-1)*5,number*5);
 assert.equal(selected.length,number===3?4:5);
 for(const row of selected){
  const {errors}=inspect(info.module,info.protocol,row.file);
  assert.equal(errors.length,1,JSON.stringify({name:row.name,errors}));
  assert.equal(errors[0].code,row.code,JSON.stringify({name:row.name,errors}));assert.equal(errors[0].file,canon(row.file));
  negatives.push({name:row.name,code:row.code,rejected:true});
 }
}
function ast(text){
 const tree=ts.createSourceFile('frame-hub.js',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);assert.equal(tree.parseDiagnostics.length,0);
 function visit(node){
  if(ts.isParenthesizedExpression(node))return visit(node.expression);
  const children=[];ts.forEachChild(node,n=>{if(n.kind<ts.SyntaxKind.FirstJSDocNode||n.kind>ts.SyntaxKind.LastJSDocNode)children.push(visit(n));});
  const value={kind:node.kind,children};if(node.operator!==undefined)value.operator=node.operator;
  if(ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node)||ts.isCallExpression(node))value.optionalChain=!!(node.flags&ts.NodeFlags.OptionalChain);
  if(!children.length&&node.kind!==ts.SyntaxKind.SourceFile)value.token=node.getText(tree);
  return value;
 }
 return JSON.stringify(visit(tree));
}
if(part==='ast-and-legacy'){
const raw=fs.readFileSync(info.baseline,'utf8'),typed=fs.readFileSync(info.module,'utf8');
assert.ok(!/@ts-(?:ignore|nocheck)|\bany\b/.test(typed));assert.ok(ast(typed)===ast(raw),'Runtime AST changed');
for(const changed of [raw.replace('blocked = !writeResult','blocked = writeResult'),
 raw.replace('push(bytes) { if (!this.closed)','push(bytes) { if (this.closed)'),
 raw.replace("hub.off('frame', pump)","hub.on('frame', pump)")]){
 assert.notEqual(changed,raw);assert.notEqual(ast(changed),ast(raw));
}
// Extract only the two Hub cases. The original transport file also spawns a native helper.
const original=fs.readFileSync(info.transportTest,'utf8');
const tree=ts.createSourceFile(info.transportTest,original,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const packet=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='packet');
const response=tree.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='Response');assert.ok(packet&&response);
const names=['slow viewer receives only the newest frame after drain, with bounded retention','capture EOF closes viewers and detach prevents delivery after abort'];
const calls=names.map(name=>{
 const found=tree.statements.filter(ts.isExpressionStatement).map(n=>n.expression).filter(n=>ts.isCallExpression(n)&&
  ts.isIdentifier(n.expression)&&n.expression.text==='test'&&ts.isStringLiteral(n.arguments[0])&&n.arguments[0].text===name);
 assert.equal(found.length,1);return found[0].getText(tree)+';';
});
const pure="import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {EventEmitter} from 'node:events';\nimport {FrameHub,streamFrames} from './frame-hub.js';\n"+
 packet.getText(tree)+'\n'+response.getText(tree)+'\n'+calls.join('\n');
assert.ok(!/spawnSync|fileURLToPath|--self-test-pipe/.test(pure));
for(const folder of [path.dirname(info.baseline),path.dirname(info.module)])fs.writeFileSync(path.join(folder,'legacy.test.mjs'),pure,{flag:'wx'});
}
assert.equal(writes,0);
const result={passed:true,part,compilerVersion:ts.version,baselineDiagnostics:part==='baseline-positive'?15:undefined,
 positivePassed:part==='baseline-positive'?true:undefined,negativeCases:negatives,
 checkedModule:info.module,checkedNonLibraryFiles:positive?.nonLibrary,standardLibraryFiles:59,nodeDeclarationFiles:66,
 undiciDeclarationFiles:41,skipLibCheck:false,normalizedRuntimeAstEqual:true,optionalChainSemanticsPreserved:true,
 astMutationChecks:part==='ast-and-legacy'?3:undefined,extractedLegacyHubCases:part==='ast-and-legacy'?2:undefined,
 compilerEmittedFiles:0,noCustomAnyIgnoreOrFakeDeclarations:part==='ast-and-legacy'?true:undefined};
if(part!=='ast-and-legacy'){
 delete result.normalizedRuntimeAstEqual;delete result.optionalChainSemanticsPreserved;
}
fs.writeFileSync(path.join(out,part+'.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result));
