import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {wallpaperEngineImage} from './steam-library.js';
const build=fileURLToPath(new URL('../../assets/desktop-follow/',import.meta.url));
const buildSha256="35ebf4fda1b9eea98f345aefc4c8a0b09f1f61fce4e3fa3525ad9cd1255fbdad";
const supportedImageSha256 = 'da37927fc77151429406ede43011a879798468c104d3d3801eaed5bfc045443a';
const hash=b=>createHash('sha256').update(b).digest('hex');
// Missing/drifted optional assets disable D while leaving manual wallpaper available.
// This reads only packaged files, never a WE image/process or user settings.
export function readPackagedFollowConfig(){try{
 if(!wallpaperEngineImage)return null;
 const raw=readFileSync(join(build,'manifest.json'));if(hash(raw)!==buildSha256)return null;
 const m=JSON.parse(raw);if(!m.conptyRuntimeSupported||m.runtimeScope!=='desktop-follow-runtime-console-v1')return null;
 for(const [n,d] of Object.entries(m.native)){if(!/^(?:fixture\/)?[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(n)||n.includes('..')||hash(readFileSync(join(build,'native',n)))!==d)return null;}
 return {build,buildSha256,image:{path:wallpaperEngineImage,sha256:supportedImageSha256}};
}catch{return null;}}
