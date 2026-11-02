// Run after installing the private package in an isolated scratch directory.
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
const scratch=path.resolve(here,'../../../.tmp/glass-controls-prototype-20261031-a');
const require=createRequire(path.join(scratch,'package.json'));
const {build}=require('esbuild');
const result=await build({entryPoints:[path.join(here,'src.jsx')],bundle:true,write:false,format:'iife',minify:true,legalComments:'inline',define:{'process.env.NODE_ENV':'"production"'},nodePaths:[path.join(scratch,'node_modules')]});
const css=await readFile(path.join(here,'style.css'),'utf8');
const js=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const licenses=(await readFile(path.join(here,'THIRD_PARTY_LICENSES.txt'),'utf8')).replace(/-->/g,'-- >');
await writeFile(path.join(here,'index.html'),`<!doctype html><!-- Bundled runtime licenses\n${licenses}\n--><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><meta name="referrer" content="no-referrer"><title>Whale · 控件材质对照（独立样板）</title><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`);
console.log('Built standalone, offline index.html; no production plugin files changed.');
