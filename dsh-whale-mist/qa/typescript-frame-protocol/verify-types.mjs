import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const round=path.resolve(process.argv[2]),info=JSON.parse(fs.readFileSync(path.join(round,'inputs.json'),'utf8'));
const ts=(await import(pathToFileURL(info.compilerModule))).default;
assert.equal(ts.version,'5.9.3');
const canonical=file=>path.resolve(file).replaceAll('\\','/').toLowerCase();
const configFile=ts.readConfigFile(path.join(round,'tsconfig.json'),ts.sys.readFile);assert.equal(configFile.error,undefined);
const config=ts.parseJsonConfigFileContent(configFile.config,ts.sys,round);assert.equal(config.errors.length,0);
assert.equal(config.options.noEmit,true);assert.equal(config.options.strict,true);assert.equal(config.options.checkJs,true);assert.deepEqual(config.options.types,[]);
const diagnostics=d=>d.map(x=>({code:x.code,file:x.file?canonical(x.file.fileName):null,message:ts.flattenDiagnosticMessageText(x.messageText,' ')}));
let writes=0;
function inspect(file,module=info.module){
 const host=ts.createCompilerHost(config.options);host.writeFile=()=>{writes++;throw Error('Compiler attempted to emit a file');};
 const program=ts.createProgram([module,...(file?[file]:[])],config.options,host);
 const sourceFiles=program.getSourceFiles(),libRoot=canonical(path.dirname(info.compilerModule))+'/';
 const external=sourceFiles.filter(x=>!x.isDeclarationFile).map(x=>canonical(x.fileName)).sort();
 assert.deepEqual(external,[module,...(file?[file]:[])].map(canonical).sort());
 for(const source of sourceFiles.filter(x=>x.isDeclarationFile)){
  assert.ok(canonical(source.fileName).startsWith(libRoot));assert.ok(/^lib\..+\.d\.ts$/.test(path.basename(source.fileName)));assert.ok(!path.basename(source.fileName).startsWith('lib.dom'));
 }
 return{diagnostics:diagnostics(ts.getPreEmitDiagnostics(program)),files:sourceFiles.map(x=>canonical(x.fileName))};
}
function tokens(text){
 const scanner=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,text),result=[];
 for(let token=scanner.scan();token!==ts.SyntaxKind.EndOfFileToken;token=scanner.scan())result.push([token,scanner.getTokenText()]);
 return result;
}
const baseline=inspect(null,info.baseline);
assert.deepEqual(baseline.diagnostics.map(x=>x.code).sort(),[7006,7006]);
const positive=inspect(info.positive);assert.deepEqual(positive.diagnostics,[]);
const negatives=[];
for(const row of info.negatives){
 const result=inspect(row.file);assert.equal(result.diagnostics.length,1,JSON.stringify(result.diagnostics));
 assert.equal(result.diagnostics[0].code,row.code);assert.equal(result.diagnostics[0].file,canonical(row.file));
 negatives.push({name:row.name,code:row.code,rejected:true});
}
const raw=fs.readFileSync(info.baseline,'utf8'),typed=fs.readFileSync(info.module,'utf8');assert.deepEqual(tokens(typed),tokens(raw));
const inline=text=>text.split('/* WM_FRAME_PROTOCOL */')[1].split('/* WM_FRAME_PROTOCOL_END */')[0];
const rawInline=raw.replace(/^export /gm,'').replace(/\bFrameDecoder\b/g,'WM_FRAME_DECODER');
for(const client of info.clients)assert.deepEqual(tokens(inline(fs.readFileSync(client,'utf8'))),tokens(rawInline));
assert.equal(writes,0);
const result={passed:true,compilerVersion:ts.version,baselineImplicitAnyErrors:baseline.diagnostics.length,positivePassed:true,negativeCases:negatives,checkedNonLibraryFiles:positive.files.filter(x=>!x.endsWith('.d.ts')),standardLibraryFiles:positive.files.filter(x=>x.endsWith('.d.ts')).length,noDomNodeOrSdkTypes:true,compilerWrites:writes,runtimeTokensIdentical:true,existingClientProtocolBodiesUnchanged:info.clients.length,emittedFiles:0};
fs.writeFileSync(path.join(round,'type-results.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result));
