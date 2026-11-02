import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {requireAuthorization} from './diagnostic-tool-guard.mjs';
import {validateDownload} from './validate-download.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),{config,auth}=requireAuthorization(root);
if(process.argv.length!==3)throw Error('Explicit downloaded JSON path required');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')),sha=b=>createHash('sha256').update(b).digest('hex').toUpperCase();
const build=read(path.join(root,'diagnostic-build.json')),intent=read(path.join(root,'download-intent.json'));
if(intent.trialRoot!==config.trialRoot||intent.buildId!==build.buildId||typeof intent.sourceMessage!=='string'||!intent.sourceMessage.trim()||typeof intent.requestedAtUtc!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(intent.requestedAtUtc)||!Number.isFinite(Date.parse(intent.requestedAtUtc))||Date.parse(intent.requestedAtUtc)<Date.parse(auth.acceptedAtUtc)||Date.parse(intent.requestedAtUtc)>Date.now()+300000)throw Error('Fresh explicit download intent required');
const source=path.resolve(process.argv[2]),downloads=path.resolve(config.downloadsRoot);
if(path.dirname(source)!==downloads||!new RegExp('^whale-author-diagnostic-'+build.buildId.slice(0,12)+'(?: \\([1-9][0-9]{0,2}\\))?\\.json$').test(path.basename(source)))throw Error('Unexpected diagnostic download location/name');
if(fs.realpathSync(source)!==source||fs.realpathSync(downloads)!==downloads||fs.lstatSync(source).isSymbolicLink())throw Error('Redirected download refused');
const fd=fs.openSync(source,'r');let bytes;
try{const before=fs.fstatSync(fd);if(!before.isFile()||before.size>300000||before.mtimeMs<Date.parse(intent.requestedAtUtc))throw Error('Old/nonregular/oversize file');bytes=fs.readFileSync(fd);const after=fs.fstatSync(fd);if(before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ino!==after.ino||bytes.length!==before.size)throw Error('Download changed during read');}finally{fs.closeSync(fd);}
// Bind the validator to the exact checked candidate; no installed code or app IO.
const manifest=read(path.join(root,'candidate-manifest.json')),candidate=path.dirname(config.candidateArchive),validator=path.join(candidate,'unpacked/src/wallpaper/author-diagnostics.js');
if(sha(fs.readFileSync(config.candidateArchive))!==config.candidateSha256||sha(fs.readFileSync(validator))!==manifest.files.find(x=>x.file==='src/wallpaper/author-diagnostics.js')?.sha256)throw Error('Candidate validator identity changed');
const {validateAuthorDiagnosticSnapshot}=await import(pathToFileURL(validator));
const summary=validateDownload(bytes.toString('utf8'),build,validateAuthorDiagnosticSnapshot);
fs.writeFileSync(path.join(root,'diagnostic-export.json'),bytes,{flag:'wx'});
const receipt={passed:true,...summary,sha256:sha(bytes),bytes:bytes.length,originalDownloadPreserved:true,realFileRead:true,liveAppQueried:false};
fs.writeFileSync(path.join(root,'diagnostic-download-validation.json'),JSON.stringify(receipt,null,2),{flag:'wx'});console.log(JSON.stringify(receipt));
