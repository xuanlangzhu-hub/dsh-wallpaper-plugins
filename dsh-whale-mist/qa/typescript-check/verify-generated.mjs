// Verify actual generated code and its QA-only export wrapper, not a hand-written decoder.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const out=path.resolve(process.argv[2]),info=JSON.parse(fs.readFileSync(path.join(out,'inputs.json'),'utf8'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex').toUpperCase();
const generated=fs.readFileSync(info.generatedClient),moduleBytes=fs.readFileSync(info.module);
const receipt=info.extraction,begin=Buffer.from('/* WM_FRAME_PROTOCOL */'),end=Buffer.from('/* WM_FRAME_PROTOCOL_END */');
const a=generated.indexOf(begin),b=generated.indexOf(end);
assert.ok(a>=0&&b>a&&generated.indexOf(begin,a+1)===-1&&generated.indexOf(end,b+1)===-1);
const body=generated.subarray(a+begin.length,b);
const suffix=Buffer.from('\nexport { WM_FRAME_DECODER as FrameDecoder, HEADER_BYTES, MAX_FRAME_BYTES };\n');
assert.deepEqual(moduleBytes,Buffer.concat([body,suffix]));
assert.equal(receipt.generatedClientSha256,digest(generated));
assert.equal(receipt.bodyStart,a+begin.length);assert.equal(receipt.bodyEnd,b);
assert.equal(receipt.bodySha256,digest(body));assert.equal(receipt.moduleSha256,digest(moduleBytes));
assert.equal(receipt.exportSuffixSha256,digest(suffix));
assert.ok(!/@ts-(?:ignore|nocheck)/.test(body.toString('utf8')));
const ts=(await import(pathToFileURL(info.compilerModule))).default;assert.equal(ts.version,'5.9.3');
const canon=f=>path.resolve(f).replaceAll('\\','/').toLowerCase();
const options={allowJs:true,checkJs:true,strict:true,noEmit:true,incremental:false,target:ts.ScriptTarget.ES2022,
 module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,lib:['lib.es2022.d.ts'],types:[],skipLibCheck:false};
let writes=0;
function inspect(module,consumer){
 const host=ts.createCompilerHost(options);host.writeFile=()=>{writes++;throw Error('Unexpected compiler output');};
 const program=ts.createProgram([module,...(consumer?[consumer]:[])],options,host),files=program.getSourceFiles();
 const nonLibrary=files.filter(f=>!f.isDeclarationFile).map(f=>canon(f.fileName)).sort();
 assert.deepEqual(nonLibrary,[module,...(consumer?[consumer]:[])].map(canon).sort());
 const libs=files.filter(f=>f.isDeclarationFile);assert.equal(libs.length,57);
 assert.ok(libs.every(f=>canon(f.fileName).startsWith(canon(path.dirname(info.compilerModule))+'/lib.')&&!/lib\.dom/.test(f.fileName)));
 return {nonLibrary,diagnostics:ts.getPreEmitDiagnostics(program).map(d=>({code:d.code,file:d.file?canon(d.file.fileName):null,message:ts.flattenDiagnosticMessageText(d.messageText,' ')}))};
}
const baseline=inspect(info.baseline);assert.deepEqual(baseline.diagnostics.map(d=>d.code),[7006,7006]);
assert.ok(baseline.diagnostics.every(d=>d.file===canon(info.baseline)));
const positive=inspect(info.module,info.positive);assert.deepEqual(positive.diagnostics,[]);
assert.equal(info.negatives.length,7);
const negatives=[];
for(const row of info.negatives){
 const {diagnostics:errors}=inspect(info.module,row.file);
 assert.equal(errors.length,1,JSON.stringify({name:row.name,errors}));
 assert.equal(errors[0].code,row.code,JSON.stringify({name:row.name,errors}));
 assert.equal(errors[0].file,canon(row.file));negatives.push({name:row.name,code:row.code,rejected:true});
}
function tokens(text){
 const scanner=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,text),result=[];
 for(let token=scanner.scan();token!==ts.SyntaxKind.EndOfFileToken;token=scanner.scan())result.push([token,scanner.getTokenText()]);
 return result;
}
const inlineText=text=>text.replace(/^export /gm,'').replace(/\bFrameDecoder\b/g,'WM_FRAME_DECODER');
assert.deepEqual(tokens(body.toString('utf8')),tokens(inlineText(fs.readFileSync(info.protocolSource,'utf8'))));
assert.deepEqual(tokens(body.toString('utf8')),tokens(inlineText(fs.readFileSync(info.baseline,'utf8'))));
assert.equal(writes,0);
const result={passed:true,compilerVersion:ts.version,checkedGeneratedModule:info.module,
 checkedNonLibraryFiles:positive.nonLibrary,sourceReceiptVerified:true,actualBodyWithExportOnly:true,
 baselineImplicitAnyErrors:2,positivePassed:true,negativeCases:negatives,standardLibraryFiles:57,
 runtimeTokensIdentical:true,compilerEmittedFiles:0,wholeClientCheckedOrExecuted:false};
fs.writeFileSync(path.join(out,'type-results.json'),JSON.stringify(result,null,2),{flag:'wx'});
console.log(JSON.stringify(result));
