import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]),info=JSON.parse(fs.readFileSync(path.join(root,'inputs.json'),'utf8'));
const ts=(await import(pathToFileURL(info.compilerModule))).default;assert.equal(ts.version,'5.9.3');
const canon=f=>path.resolve(f).replaceAll('\\','/').toLowerCase();
const options={allowJs:true,checkJs:true,strict:true,noEmit:true,incremental:false,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,lib:['lib.es2022.d.ts'],types:[],skipLibCheck:false};
function inspect(module,consumer){
 const host=ts.createCompilerHost(options);host.writeFile=()=>{throw Error('Compiler attempted an output');};
 const program=ts.createProgram([module,...(consumer?[consumer]:[])],options,host),files=program.getSourceFiles();
 assert.deepEqual(files.filter(x=>!x.isDeclarationFile).map(x=>canon(x.fileName)).sort(),[module,...(consumer?[consumer]:[])].map(canon).sort());
 assert.ok(files.filter(x=>x.isDeclarationFile).every(x=>canon(x.fileName).startsWith(canon(path.dirname(info.compilerModule))+'/lib.')&&!/lib\.dom/.test(x.fileName)));
 return ts.getPreEmitDiagnostics(program).map(x=>({code:x.code,file:x.file?canon(x.file.fileName):null,message:ts.flattenDiagnosticMessageText(x.messageText,' ')}));
}
const baseline=inspect(info.baseline);assert.deepEqual(baseline.map(x=>x.code).sort(),[2339,7006,7006,7006,7006,7008,7008]);
const positive=inspect(info.module,info.positive);assert.deepEqual(positive,[]);
const negatives=[];
for(const row of info.negatives){const errors=inspect(info.module,row.file);assert.equal(errors.length,1,JSON.stringify(errors));assert.equal(errors[0].code,row.code,JSON.stringify({name:row.name,errors}));assert.equal(errors[0].file,canon(row.file));negatives.push({name:row.name,code:row.code,rejected:true});}
function structural(text){
 const tree=ts.createSourceFile('probe-log.js',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);assert.equal(tree.parseDiagnostics.length,0);
 function visit(n){
  if(n.kind===ts.SyntaxKind.ParenthesizedExpression)return visit(n.expression);
  const children=[];ts.forEachChild(n,c=>{if(c.kind<ts.SyntaxKind.FirstJSDocNode||c.kind>ts.SyntaxKind.LastJSDocNode)children.push(visit(c));});
  const value={kind:n.kind,children};
  if(n.operator!==undefined)value.operator=n.operator;
  if(!children.length&&n.kind!==ts.SyntaxKind.SourceFile)value.token=n.getText(tree);
  return value;
 }
 return JSON.stringify(visit(tree));
}
const raw=fs.readFileSync(info.baseline,'utf8'),typed=fs.readFileSync(info.module,'utf8'),baselineAst=structural(raw);
assert.ok(!/@ts-(?:ignore|nocheck)|\bany\b/.test(typed));
assert.equal(structural(typed),baselineAst);
// Make sure the normalization does not erase control flow or unary operators.
for(const mutant of [raw.replace('this.errorCount++','this.errorCount--'),raw.replace('if (!text) return null;','if (text) return null;'),raw.replace("? value.level : 'info'","? value.level : 'error'")]){
 assert.notEqual(mutant,raw);assert.notEqual(structural(mutant),baselineAst);
}
const result={passed:true,compilerVersion:ts.version,baselineDiagnostics:baseline.length,positivePassed:true,negativeCases:negatives,normalizedRuntimeAstEqual:true,astNormalizationMutationChecks:3,runtimeAstSha256:createHash('sha256').update(baselineAst).digest('hex').toUpperCase(),compilerEmittedFiles:0,noAnyIgnoreOrFakeDeclarations:true,checkedModule:info.module};
fs.writeFileSync(path.join(root,'type-results.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result));
