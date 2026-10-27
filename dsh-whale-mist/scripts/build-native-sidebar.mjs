// Generate the ModuleLoader-safe client fragment from the single ESM implementation.
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const source=await readFile(new URL('src/sidebar/native-appearance-sidebar.js',root),'utf8');
if(/^import\s/m.test(source))throw Error('Native sidebar fragment must remain dependency-free');
const stripped=source.replace(/^export /gm,'');
const begin='    /* WM_NATIVE_SIDEBAR_BEGIN */',end='    /* WM_NATIVE_SIDEBAR_END */';
const fragment=begin+'\n    const WM_NATIVE_SIDEBAR = (() => {\n'+stripped+'\nreturn {createNativeAppearanceSidebar,attachNativeAppearanceSidebar,createAppearanceEditorGate,createLegacyAppearanceBoundary};\n    })();\n'+end;
const path=new URL('src/client.js',root),client=await readFile(path,'utf8');
const anchor='    const inject = ["theme", "slots"];';
let updated;
if(client.includes(begin)){
 const from=client.indexOf(begin),to=client.indexOf(end,from);
 if(to<from||client.indexOf(begin,from+begin.length)!==-1)throw Error('Invalid native sidebar bundle markers');
 updated=client.slice(0,from)+fragment+client.slice(to+end.length);
}else{
 if(client.split(anchor).length!==2)throw Error('Native sidebar insertion anchor mismatch');
 updated=client.replace(anchor,()=>fragment+'\n\n'+anchor);
}
if(process.argv.includes('--check')){if(client!==updated)throw Error('Native sidebar bundle is stale');}
else if(updated!==client)await writeFile(path,updated);
