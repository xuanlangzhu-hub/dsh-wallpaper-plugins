// Parse real consumer files, then type-check extracted actual inline decoder code only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const out=path.resolve(process.argv[2]),info=JSON.parse(fs.readFileSync(path.join(out,'inputs.json'),'utf8'));
const ts=(await import(pathToFileURL(info.compilerModule))).default;assert.equal(ts.version,'5.9.3');
const canon=f=>path.resolve(f).replaceAll('\\','/').toLowerCase();
const graph=[];
for(const file of info.files){
 const source=fs.readFileSync(file,'utf8'),tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 assert.equal(tree.parseDiagnostics.length,0);
 const imports=tree.statements.filter(ts.isImportDeclaration).map(n=>({specifier:n.moduleSpecifier.text,
  names:n.importClause?.namedBindings&&ts.isNamedImports(n.importClause.namedBindings)?n.importClause.namedBindings.elements.map(e=>e.name.text):[]}));
 const calls=[];
 function visit(node){
  if((ts.isNewExpression(node)||ts.isCallExpression(node))&&ts.isIdentifier(node.expression)&&
    ['FrameDecoder','WM_FRAME_DECODER','ProbeJournal','sceneSelection','resolveSceneRequest','describeScenes','isSceneId'].includes(node.expression.text))
   calls.push({name:node.expression.text,line:tree.getLineAndCharacterOfPosition(node.getStart(tree)).line+1});
  ts.forEachChild(node,visit);
 }
 visit(tree);graph.push({file,lines:source.split(/\r?\n/).length-(source.endsWith('\n')?1:0),imports,calls});
}
const scripts=JSON.parse(fs.readFileSync(info.manifest,'utf8')).scripts;
assert.equal(scripts['build:client-protocol'],'node scripts/build-wm-protocol.mjs');
assert.ok(!/typescript|\btsc\b/.test(scripts.check));
function block(file){
 const bytes=fs.readFileSync(file),start=Buffer.from('/* WM_FRAME_PROTOCOL */'),end=Buffer.from('/* WM_FRAME_PROTOCOL_END */');
 const a=bytes.indexOf(start),b=bytes.indexOf(end);
 assert.ok(a>=0&&b>a&&bytes.indexOf(start,a+1)===-1&&bytes.indexOf(end,b+1)===-1);
 return {text:bytes.subarray(a+start.length,b).toString('utf8'),outside:[bytes.subarray(0,a),bytes.subarray(b+end.length)]};
}
const current=block(info.client),generated=block(info.generatedClient);
assert.deepEqual(generated.outside,current.outside);
function tokens(text){
 const scanner=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,text),result=[];
 for(let token=scanner.scan();token!==ts.SyntaxKind.EndOfFileToken;token=scanner.scan())result.push([token,scanner.getTokenText()]);
 return result;
}
assert.deepEqual(tokens(current.text),tokens(generated.text));
// The wrapper merely exposes real private runtime code to the checker; it supplies no declarations.
const suffix='\nexport {WM_FRAME_DECODER as FrameDecoder,HEADER_BYTES,MAX_FRAME_BYTES};\n';
for(const [name,body] of [['current',current.text],['generated',generated.text]])
 fs.writeFileSync(path.join(out,name+'-decoder.js'),body+suffix,{flag:'wx'});
const positive=fs.readFileSync(info.positive,'utf8');assert.equal(positive.split('../../src/wallpaper/frame-protocol.js').length,2);
fs.writeFileSync(path.join(out,'positive.ts'),positive.replace('../../src/wallpaper/frame-protocol.js','./generated-decoder.js'),{flag:'wx'});
fs.writeFileSync(path.join(out,'bad-chunk.ts'),"import {FrameDecoder} from './generated-decoder.js';\nnew FrameDecoder(()=>{}).push('wrong');\n",{flag:'wx'});
const options={allowJs:true,checkJs:true,strict:true,noEmit:true,incremental:false,target:ts.ScriptTarget.ES2022,
 module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,lib:['lib.es2022.d.ts'],types:[],skipLibCheck:false};
let writes=0;
function inspect(module,consumer){
 const host=ts.createCompilerHost(options);host.writeFile=()=>{writes++;throw Error('Unexpected compiler output');};
 const program=ts.createProgram([module,...(consumer?[consumer]:[])],options,host),files=program.getSourceFiles();
 assert.deepEqual(files.filter(f=>!f.isDeclarationFile).map(f=>canon(f.fileName)).sort(),[module,...(consumer?[consumer]:[])].map(canon).sort());
 const libs=files.filter(f=>f.isDeclarationFile);assert.equal(libs.length,57);
 assert.ok(libs.every(f=>canon(f.fileName).startsWith(canon(path.dirname(info.compilerModule))+'/lib.')&&!/lib\.dom/.test(f.fileName)));
 return ts.getPreEmitDiagnostics(program).map(d=>({code:d.code,file:d.file?canon(d.file.fileName):null,
  line:d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).line+1:null,
  message:ts.flattenDiagnosticMessageText(d.messageText,' ')}));
}
const currentErrors=inspect(path.join(out,'current-decoder.js'));
assert.deepEqual(currentErrors.map(d=>d.code),[7006,7006]);
assert.ok(currentErrors.every(d=>d.file===canon(path.join(out,'current-decoder.js'))));
assert.deepEqual(inspect(path.join(out,'generated-decoder.js'),path.join(out,'positive.ts')),[]);
const bad=inspect(path.join(out,'generated-decoder.js'),path.join(out,'bad-chunk.ts'));
assert.equal(bad.length,1);assert.equal(bad[0].code,2345);assert.equal(bad[0].file,canon(path.join(out,'bad-chunk.ts')));
assert.equal(writes,0);
const result={passed:true,scopeOnly:true,graph,scripts,
 selectedBoundary:'actual generated inline WHL1 decoder type contract',
 currentInlineDiagnostics:currentErrors,generatedInlinePositivePassed:true,badChunkDiagnostic:bad[0],
 extractedBodiesAreActualRuntimeCode:true,exportWrapperOnly:true,fakeDeclarations:false,
 protocolTokensUnchanged:true,outsideProtocolBytesUnchanged:true,standardLibraryFiles:57,
 compilerEmittedFiles:0,wholeHostOrClientTypeChecked:false,hostOrClientExecuted:false};
fs.writeFileSync(path.join(out,'consumer-scope.json'),JSON.stringify(result,null,2),{flag:'wx'});
console.log(JSON.stringify({passed:true,currentInlineDiagnostics:currentErrors.length,generatedInlinePositivePassed:true,badChunkCode:2345,wholeClientChecked:false}));
