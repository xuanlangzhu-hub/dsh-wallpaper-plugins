// Read/type-check candidates; execute only the chosen import-free rules in pure tests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const out=path.resolve(process.argv[2]), info=JSON.parse(fs.readFileSync(path.join(out,'inputs.json'),'utf8'));
const ts=(await import(pathToFileURL(info.compilerModule))).default;
assert.equal(ts.version,'5.9.3');
const canon=f=>path.resolve(f).replaceAll('\\','/').toLowerCase();
const rows=[];
for(const item of info.candidates){
 const text=fs.readFileSync(item.source,'utf8');
 const tree=ts.createSourceFile(item.source,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 assert.equal(tree.parseDiagnostics.length,0);
 rows.push({source:item.source,lines:text.split(/\r?\n/).length-(text.endsWith('\n')?1:0),
   imports:tree.statements.filter(ts.isImportDeclaration).map(n=>n.moduleSpecifier.text),
   exportedStatements:tree.statements.filter(n=>n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)).length,
   sameAsFixedRc53:item.sameAsFixedRc53,sha256:item.sha256});
}
const options={allowJs:true,checkJs:true,strict:true,noEmit:true,incremental:false,
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,
 lib:['lib.es2022.d.ts'],types:[],skipLibCheck:false};
const host=ts.createCompilerHost(options);let writes=0;
host.writeFile=()=>{writes++;throw Error('Unexpected compiler output');};
const program=ts.createProgram([info.source],options,host), files=program.getSourceFiles();
assert.deepEqual(files.filter(x=>!x.isDeclarationFile).map(x=>canon(x.fileName)),[canon(info.source)]);
const libs=files.filter(x=>x.isDeclarationFile);
assert.equal(libs.length,57);
assert.ok(libs.every(x=>canon(x.fileName).startsWith(canon(path.dirname(info.compilerModule))+'/lib.')&&!/lib\.dom/.test(x.fileName)));
const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({code:d.code,
 file:d.file?canon(d.file.fileName):null,
 line:d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).line+1:null,
 message:ts.flattenDiagnosticMessageText(d.messageText,' ')}));
assert.ok(diagnostics.length>0);
assert.ok(diagnostics.every(d=>d.file===canon(info.source)));
assert.equal(rows.find(x=>canon(x.source)===canon(info.source)).imports.length,0);
assert.equal(writes,0);

// Extract named existing pure cases by AST. Do not import the session/library test files:
// they contain Profile helpers, routes and injected child-process lifecycles.
function namedTest(file,name,wrapped=false){
 const text=fs.readFileSync(file,'utf8'), tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const found=[];
 function visit(node){
  if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text===(wrapped?'checked':'test')&&
    ts.isStringLiteral(node.arguments[0])&&node.arguments[0].text===name)found.push(node);
  ts.forEachChild(node,visit);
 }
 visit(tree);assert.equal(found.length,1);
 const call=found[0],callback=call.arguments[1];
 assert.ok(ts.isArrowFunction(callback)&&ts.isBlock(callback.body)&&callback.parameters.length===0);
 return wrapped?'test('+JSON.stringify(name)+', async () => '+callback.body.getText(tree)+');':call.getText(tree)+';';
}
const existing=[namedTest(info.sessionTest,'scene payloads are constrained to the whitelist and to the playback modes'),
 namedTest(info.libraryTest,'The scene id syntax is a shape, not a lookup, and only the Host resolves it',true)];
const pure=`import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENES,PREVIEW_SECONDS,isSceneId,sceneSelection,resolveSceneRequest,describeScenes} from ${JSON.stringify(pathToFileURL(info.source).href)};
const HELPER='F:\\\\fake\\\\WallpaperProbe.exe';
const SCENE_FILE=SCENES.lucy.project;
const exists=path=>path===HELPER||path===SCENE_FILE;
${existing.join('\n')}
test('shape coercion is deliberately broader than selection validation',()=>{
 const id='we-'+'a'.repeat(24), object={toString(){return id;}};
 assert.equal(isSceneId(object),true);assert.equal(isSceneId([id]),true);
 assert.throws(()=>sceneSelection({scene:object}),/unknown scene/);
 assert.throws(()=>sceneSelection({scene:7}),/unknown scene/);
 assert.equal(resolveSceneRequest({scene:7}).sceneId,'lucy');
});
test('selection keeps absent defaults and unvalidated mode for the request stage',()=>{
 for(const input of [undefined,null,false,7,[],{}])assert.deepEqual(sceneSelection(input),{sceneId:'lucy',mode:undefined});
 assert.deepEqual(sceneSelection({scene:null,mode:'bad'}),{sceneId:'lucy',mode:'bad'});
 assert.throws(()=>resolveSceneRequest({mode:'bad'}),/unknown mode/);
 assert.throws(()=>resolveSceneRequest({mode:null}),/unknown mode/);
});
test('preview duration accepts integers and keeps bounds and migration defaults',()=>{
 for(const [input,seconds] of [[undefined,180],[null,180],['80',180],[1.5,180],[NaN,180],[Infinity,180],[-2,30],[0,30],[31,31],[999,300]]){
  const result=resolveSceneRequest({seconds:input});assert.equal(result.seconds,seconds);assert.equal(result.mode,'preview');
 }
 for(const seconds of [undefined,null])assert.equal(resolveSceneRequest({mode:'daily',seconds}).seconds,null);
 for(const seconds of [0,false,'',180])assert.throws(()=>resolveSceneRequest({mode:'daily',seconds}),/does not take a duration/);
});
test('project resolver owns lookup and refusal, never silently falls back',()=>{
 const id='we-'+'b'.repeat(24),seen=[];
 const resolved=resolveSceneRequest({scene:id,mode:'daily',project:'caller-path'}, {resolveProject:value=>{seen.push(value);return 'verified-project';}});
 assert.deepEqual(seen,[id]);assert.equal(resolved.project,'verified-project');assert.equal(resolved.seconds,null);
 for(const value of [null,undefined,7,''])assert.throws(()=>resolveSceneRequest({scene:id},{resolveProject:()=>value}),/unknown scene/);
 const sentinel=Error('resolver-refused');assert.throws(()=>resolveSceneRequest({scene:id},{resolveProject:()=>{throw sentinel;}}),error=>error===sentinel);
 assert.throws(()=>resolveSceneRequest({scene:'bad'},{resolveProject:()=>{throw Error('must not run');}}),/unknown scene: bad/);
});
test('injected scene records and availability remain pure data',()=>{
 const scenes={custom:{id:'custom',label:'Custom',project:'fixture-path',playbackVerified:true},other:{id:'other',label:'Other',project:'missing'}};
 const seen=[],exists=file=>{seen.push(file);return file==='fixture-path';};
 assert.equal(resolveSceneRequest({scene:'custom'},{scenes,exists}).project,'fixture-path');
 const listed=describeScenes({scenes,exists});assert.equal(listed[0].available,true);assert.equal(listed[0].playbackVerified,true);
 assert.equal(listed[1].available,false);assert.equal(listed[1].playbackVerified,false);
 assert.ok(seen.every(x=>['fixture-path','missing'].includes(x)));
});
test('conversion errors keep their existing propagation',()=>{
 const error=Error('coercion-sentinel'),value={toString(){throw error;}};
 assert.throws(()=>isSceneId(value),x=>x===error);
 assert.throws(()=>sceneSelection({scene:value}),x=>x===error);
});
`;
assert.equal((pure.match(/^test\(/gm)||[]).length,8);
assert.ok(!/spawnSync|createProfile|registerWallpaperRoutes|createPreviewSession/.test(pure));
fs.writeFileSync(path.join(out,'pure-scenes.test.mjs'),pure,{flag:'wx'});
const result={passed:true,scopeOnly:true,typeImplementationCompleted:false,compilerVersion:ts.version,
 selected:info.source,candidates:rows,baselineDiagnosticCount:diagnostics.length,diagnostics,
 nonLibraryFiles:1,standardLibraryFiles:libs.length,compilerEmittedFiles:writes,
 existingPureTests:2,additionalBoundaryCases:6,sessionOrLibraryExecuted:false};
fs.writeFileSync(path.join(out,'scope-types.json'),JSON.stringify(result,null,2),{flag:'wx'});
console.log(JSON.stringify({passed:true,baselineDiagnosticCount:diagnostics.length,standardLibraryFiles:libs.length,pureCases:8}));
