import fs from 'node:fs';
import path from 'node:path';
export function validateAuthorization(auth,config,now=Date.now()){
 if(!auth||Array.isArray(auth))throw Error('Invalid current-round authorization');
 for(const key of ['trialRoot','purpose','candidateVersion','dailyVersion','candidateSha256','dailySha256'])if(auth[key]!==config[key])throw Error('Authorization mismatch: '+key);
 if(auth.confirmedNormallyExited!==true||typeof auth.sourceMessage!=='string'||!auth.sourceMessage.trim())throw Error('Direct normal-exit confirmation required');
 if(typeof auth.acceptedAtUtc!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(auth.acceptedAtUtc)||!Number.isFinite(Date.parse(auth.acceptedAtUtc))||Date.parse(auth.acceptedAtUtc)>now+300000)throw Error('Invalid authorization timestamp');
 return auth;
}
export function requireAuthorization(root){
 const config=JSON.parse(fs.readFileSync(path.join(root,'trial-config.json'),'utf8').replace(/^\uFEFF/,''));
 if(path.resolve(root)!==path.resolve(config.trialRoot))throw Error('Unexpected trial root');
 if(fs.existsSync(path.join(root,'closed-out.json')))throw Error('This trial is already closed');
 if(!fs.existsSync(path.join(root,'authorization.json')))throw Error('Fresh current-round user authorization required');
 const auth=validateAuthorization(JSON.parse(fs.readFileSync(path.join(root,'authorization.json'),'utf8').replace(/^\uFEFF/,'')),config);
 return{config,auth};
}
