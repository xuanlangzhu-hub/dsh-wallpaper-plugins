import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {validateAuthorization} from './diagnostic-tool-guard.mjs';
import {validateDownload} from './validate-download.mjs';
const runtime=process.env.AUTHOR_UI_RUNTIME,build=JSON.parse(await readFile(process.env.AUTHOR_UI_BUILD,'utf8'));
const {createAuthorDiagnosticRecorder,validateAuthorDiagnosticSnapshot}=await import(pathToFileURL(runtime+'/src/wallpaper/author-diagnostics.js'));
const config={trialRoot:'synthetic',purpose:'unit',candidateVersion:'57',dailyVersion:'56',candidateSha256:'C',dailySha256:'D'};
const auth={...config,confirmedNormallyExited:true,sourceMessage:'synthetic test fixture only',acceptedAtUtc:'2026-01-01T00:00:00Z'};
test('synthetic authorization binds every current trial field',()=>{
 assert.equal(validateAuthorization(auth,config),auth);
 for(const key of Object.keys(config))assert.throws(()=>validateAuthorization({...auth,[key]:'wrong'},config));
});
test('authorization requires explicit exit, message and valid zoned time',()=>{
 for(const patch of [{confirmedNormallyExited:1},{sourceMessage:''},{sourceMessage:7},{acceptedAtUtc:'2026-01-01'},{acceptedAtUtc:'badZ'},{acceptedAtUtc:'2999-01-01T00:00:00Z'}])assert.throws(()=>validateAuthorization({...auth,...patch},config));
});
function bundle(){const r=createAuthorDiagnosticRecorder({sources:build.sources});return{format:'whale-author-diagnostics-v1',build,clockDomains:{renderer:'renderer-local-monotonic',host:'host-local-monotonic',crossProcessTiming:'not-correlated'},renderer:JSON.parse(r.exportJson()),host:JSON.parse(r.exportJson())};}
const check=v=>validateDownload(JSON.stringify(v),build,validateAuthorDiagnosticSnapshot);
test('actual candidate validator accepts separate local clock domains',()=>{const s=check(bundle());assert.equal(s.rendererTransactions,0);assert.equal(s.hostTransactions,0);assert.equal(s.crossProcessTiming,'not-correlated');});
test('different candidate identity, extra fields and wrong formats rejected',()=>{
 for(const mutate of [v=>v.build={...v.build,buildId:'0'.repeat(64)},v=>v.extra='secret',v=>v.format='wrong',v=>v.clockDomains.crossProcessTiming='synchronized']){const v=bundle();mutate(v);assert.throws(()=>check(v));}
});
test('raw diagnostic snapshot rejects values, paths, credentials and corrupt shapes',()=>{
 for(const mutate of [v=>v.host.extra='/private',v=>v.renderer.records='bad',v=>v.host.sources.host='0'.repeat(64),v=>v.host.historyComplete='yes']){const v=bundle();mutate(v);assert.throws(()=>check(v));}
});
test('byte cap is enforced before parsing and truncated history stays explicit',()=>{
 assert.throws(()=>validateDownload(' '.repeat(300001),build,validateAuthorDiagnosticSnapshot));
 const v=bundle();v.host.droppedEvents=1;assert.throws(()=>check(v));v.host.historyComplete=false;assert.equal(check(v).hostHistoryComplete,false);
});
test('download name allows bounded numbered browser suffix only',()=>{
 const pattern=new RegExp('^whale-author-diagnostic-'+build.buildId.slice(0,12)+'(?: \\([1-9][0-9]{0,2}\\))?\\.json$');
 for(const suffix of ['', ' (1)',' (999)'])assert.ok(pattern.test('whale-author-diagnostic-'+build.buildId.slice(0,12)+suffix+'.json'));
 for(const suffix of [' (0)',' (1000)','../',' (a)'])assert.ok(!pattern.test('whale-author-diagnostic-'+build.buildId.slice(0,12)+suffix+'.json'));
});
