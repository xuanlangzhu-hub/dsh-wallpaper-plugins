import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const out=path.resolve(process.argv[2]),part=process.argv[3];
const info=JSON.parse(fs.readFileSync(path.join(out,'inputs.json'),'utf8'));
const ts=(await import(pathToFileURL(info.compilerModule))).default;
assert.equal(ts.version,'5.9.3');
assert.ok(['baseline-positive','negative-1','negative-2','negative-3','negative-4','ast'].includes(part));
const canon=f=>path.resolve(f).replaceAll('\\','/').toLowerCase();
const options={allowJs:true,checkJs:true,strict:true,noEmit:true,incremental:false,target:ts.ScriptTarget.ES2022,
  module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,lib:['lib.es2022.d.ts'],skipLibCheck:false,
  types:['node'],typeRoots:[path.join(info.cache,'types')],paths:{'undici-types':[path.join(info.cache,'types/undici-types')]}};
let emitted=0;
function inspect(module,consumer){
  const host=ts.createCompilerHost(options);host.writeFile=()=>{emitted++;throw Error('Unexpected compiler output');};
  const program=ts.createProgram([module,...(consumer?[consumer]:[])],options,host),files=program.getSourceFiles();
  const application=files.filter(f=>!f.isDeclarationFile).map(f=>canon(f.fileName));
  assert.deepEqual(application.sort(),[module,...(consumer?[consumer]:[])].map(canon).sort());
  const libs=files.filter(f=>f.isDeclarationFile).map(f=>canon(f.fileName));
  const compilerRoot=canon(path.dirname(info.compilerModule))+'/',cacheRoot=canon(path.join(info.cache,'types'))+'/';
  assert.ok(libs.every(f=>f.startsWith(compilerRoot)||f.startsWith(cacheRoot)));
  assert.ok(libs.every(f=>!/(?:lib\.dom|lib\.webworker)(?:\.|\/)/.test(f)));
  assert.equal(libs.filter(f=>f.startsWith(compilerRoot)).length,59);
  assert.equal(libs.filter(f=>f.startsWith(canon(path.join(info.cache,'types/node'))+'/')).length,66);
  assert.equal(libs.filter(f=>f.startsWith(canon(path.join(info.cache,'types/undici-types'))+'/')).length,41);
  return {application,diagnostics:ts.getPreEmitDiagnostics(program).map(d=>({code:d.code,file:d.file?canon(d.file.fileName):null,
    message:ts.flattenDiagnosticMessageText(d.messageText,' ')}))};
}
function ast(text){
  const tree=ts.createSourceFile('managed-window.js',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  assert.equal(tree.parseDiagnostics.length,0);
  function visit(node){
    if(ts.isParenthesizedExpression(node))return visit(node.expression);
    const children=[];
    ts.forEachChild(node,n=>{if(n.kind<ts.SyntaxKind.FirstJSDocNode||n.kind>ts.SyntaxKind.LastJSDocNode)children.push(visit(n));});
    const value={kind:node.kind,children};if(node.operator!==undefined)value.operator=node.operator;
    if(ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node)||ts.isCallExpression(node))value.optionalChain=!!(node.flags&ts.NodeFlags.OptionalChain);
    if(!children.length&&node.kind!==ts.SyntaxKind.SourceFile)value.token=node.getText(tree);
    return value;
  }
  return JSON.stringify(visit(tree));
}
const result={passed:true,part,standardLibraryFiles:59,nodeDeclarationFiles:66,undiciDeclarationFiles:41,
  skipLibCheck:false,compilerVersion:ts.version,negativeCases:[]};
if(part==='baseline-positive'){
  const baseline=inspect(info.baseline);
  assert.deepEqual(baseline.diagnostics.map(d=>d.code).sort((a,b)=>a-b),[...Array(18).fill(7006),...Array(3).fill(18048)]);
  assert.ok(baseline.diagnostics.every(d=>d.file===canon(info.baseline)));
  const positive=inspect(info.module,info.positive);assert.deepEqual(positive.diagnostics,[]);
  Object.assign(result,{baselineDiagnostics:21,positivePassed:true,checkedNonLibraryFiles:positive.application});
}
if(part.startsWith('negative-')){
  const n=Number(part.slice(-1)),selected=info.negatives.slice((n-1)*4,n*4);assert.equal(selected.length,4);
  for(const row of selected){
    const {diagnostics}=inspect(info.module,row.file);
    assert.equal(diagnostics.length,1,JSON.stringify({name:row.name,diagnostics}));
    assert.equal(diagnostics[0].file,canon(row.file));
    assert.equal(diagnostics[0].code,row.code,JSON.stringify({name:row.name,diagnostics}));
    result.negativeCases.push({name:row.name,code:row.code,rejected:true});
  }
}
if(part==='ast'){
  const raw=fs.readFileSync(info.baseline,'utf8'),typed=fs.readFileSync(info.module,'utf8');
  assert.ok(!/@ts-(?:ignore|nocheck)|\bany\b/.test(typed));
  assert.equal(ast(typed),ast(raw),'Runtime AST changed');
  for(const changed of [raw.replace('value > 7680','value > 7681'),raw.replace('matches.length === 1','matches.length === 2'),raw.replace('if (settled) return;','if (!settled) return;')]){
    assert.notEqual(changed,raw);assert.notEqual(ast(changed),ast(raw));
  }
  Object.assign(result,{normalizedRuntimeAstEqual:true,optionalChainSemanticsPreserved:true,astMutationChecks:3,noCustomAnyIgnoreOrFakeDeclarations:true});
}
assert.equal(emitted,0);result.compilerEmittedFiles=emitted;
fs.writeFileSync(path.join(out,part+'.json'),JSON.stringify(result,null,2),{flag:'wx'});
