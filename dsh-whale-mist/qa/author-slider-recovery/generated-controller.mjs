import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
// Exercise the exact generated fragment. This export is a test-only VM seam;
// neither the source module nor the generated payload gains a public export.
const raw=await readFile(process.env.AUTHOR_GENERATED_CLIENT,'utf8');
const begin='    /* WM_NATIVE_SIDEBAR_BEGIN */',end='    /* WM_NATIVE_SIDEBAR_END */';
const from=raw.indexOf(begin),to=raw.indexOf(end,from);
if(from<0||to<from||raw.indexOf(begin,from+begin.length)!==-1)throw Error('fragment-boundary');
let code=raw.slice(from+begin.length,to);
const marker='return {createNativeAppearanceSidebar,attachNativeAppearanceSidebar,createAppearanceEditorGate,createLegacyAppearanceBoundary};';
if(code.split(marker).length!==2)throw Error('fragment-exports');
code=code.replace(marker,marker.replace('};',',createNativeAuthorSwitches};'))+'\nWM_NATIVE_SIDEBAR;';
const api=vm.runInNewContext(code,{setTimeout,clearTimeout,AbortController,performance,console},{timeout:1000});
export const createNativeAuthorSwitches=api.createNativeAuthorSwitches;
