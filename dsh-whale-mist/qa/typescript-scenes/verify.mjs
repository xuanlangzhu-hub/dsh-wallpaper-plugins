import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const out=path.resolve(process.argv[2]),info=JSON.parse(fs.readFileSync(path.join(out,'inputs.json'),'utf8'));
const ts=(await import(pathToFileURL(info.compilerModule))).default;assert.equal(ts.version,'5.9.3');
const canon=f=>path.resolve(f).replaceAll('\\','/').toLowerCase();
const options={allowJs:true,checkJs:true,strict:true,noEmit:true,incremental:false,target:ts.ScriptTarget.ES2022,
 module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,lib:['lib.es2022.d.ts'],types:[],skipLibCheck:false};
let writes=0;
function inspect(module,consumer){
 const host=ts.createCompilerHost(options);host.writeFile=()=>{writes++;throw Error('Unexpected compiler output');};
 const program=ts.createProgram([module,...(consumer?[consumer]:[])],options,host),files=program.getSourceFiles();
 assert.deepEqual(files.filter(f=>!f.isDeclarationFile).map(f=>canon(f.fileName)).sort(),[module,...(consumer?[consumer]:[])].map(canon).sort());
 const libs=files.filter(f=>f.isDeclarationFile);assert.equal(libs.length,57);
 assert.ok(libs.every(f=>canon(f.fileName).startsWith(canon(path.dirname(info.compilerModule))+'/lib.')&&!/lib\.dom/.test(f.fileName)));
 return ts.getPreEmitDiagnostics(program).map(d=>({code:d.code,file:d.file?canon(d.file.fileName):null,message:ts.flattenDiagnosticMessageText(d.messageText,' ')}));
}
const baseline=inspect(info.baseline);
assert.deepEqual(baseline.map(d=>d.code).sort(),[2349,2554,2554,7006,7006,7006,7053]);
assert.ok(baseline.every(d=>d.file===canon(info.baseline)));
assert.deepEqual(inspect(info.module,info.positive),[]);
const negatives=[];
for(const row of info.negatives){
 const errors=inspect(info.module,row.file);
 assert.equal(errors.length,1,JSON.stringify({name:row.name,errors}));
 assert.equal(errors[0].code,row.code,JSON.stringify({name:row.name,errors}));
 assert.equal(errors[0].file,canon(row.file));negatives.push({name:row.name,code:row.code,rejected:true});
}
function ast(text){
 const tree=ts.createSourceFile('scenes.js',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);assert.equal(tree.parseDiagnostics.length,0);
 function visit(node){
  if(ts.isParenthesizedExpression(node))return visit(node.expression);
  const children=[];ts.forEachChild(node,c=>{if(c.kind<ts.SyntaxKind.FirstJSDocNode||c.kind>ts.SyntaxKind.LastJSDocNode)children.push(visit(c));});
  const value={kind:node.kind,children};if(node.operator!==undefined)value.operator=node.operator;
  if(!children.length&&node.kind!==ts.SyntaxKind.SourceFile)value.token=node.getText(tree);
  return value;
 }
 return JSON.stringify(visit(tree));
}
const raw=fs.readFileSync(info.baseline,'utf8'),typed=fs.readFileSync(info.module,'utf8');
assert.ok(!/@ts-(?:ignore|nocheck)|\bany\b/.test(typed));
assert.equal(ast(typed),ast(raw));
for(const changed of [raw.replace("if (mode === 'preview')", "if (mode === 'daily')"),
 raw.replace('Math.max(PREVIEW_SECONDS.min, requested)','Math.min(PREVIEW_SECONDS.min, requested)'),
 raw.replace('let seconds = null','let seconds = 0')]){
 assert.notEqual(changed,raw);assert.notEqual(ast(changed),ast(raw));
}
assert.equal(writes,0);
const result={passed:true,compilerVersion:ts.version,baselineDiagnosticCount:baseline.length,positivePassed:true,
 negativeCases:negatives,standardLibraryFiles:57,noDomNodeSdkOrFakeDeclarations:true,
 normalizedRuntimeAstEqual:true,astMutationChecks:3,compilerEmittedFiles:0,checkedModule:info.module};
fs.writeFileSync(path.join(out,'type-results.json'),JSON.stringify(result,null,2),{flag:'wx'});
console.log(JSON.stringify(result));
