// Keep the non-ESM DSH ModuleLoader client on the exact same form/model as companion.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const strip=s=>s.replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'');
const sources=await Promise.all(['src/wallpaper/managed-window.js','src/wallpaper/author-properties-contract.js','src/wallpaper/author-properties-panel.js'].map(p=>readFile(new URL(p,root),'utf8')));
const bundle='    /* WM_AUTHOR_PANEL_BEGIN */\n    const WM_AUTHOR_PANEL = (() => {\n'+sources.map(strip).join('\n')+'\nreturn {createAuthorPanel,validateAuthorValue};\n    })();\n    /* WM_AUTHOR_PANEL_END */';
const target=new URL('src/client.js',root),source=await readFile(target,'utf8');
const updated=source.includes('/* WM_AUTHOR_PANEL_BEGIN */')?source.replace(/    \/\* WM_AUTHOR_PANEL_BEGIN \*\/[\s\S]*?    \/\* WM_AUTHOR_PANEL_END \*\//,()=>bundle):source.replace('    /* WM_FRAME_PROTOCOL */',bundle+'\n\n    /* WM_FRAME_PROTOCOL */');
if(process.argv.includes('--check')){if(source!==updated)throw new Error('Author panel bundle is stale');}
else await writeFile(target,updated);
