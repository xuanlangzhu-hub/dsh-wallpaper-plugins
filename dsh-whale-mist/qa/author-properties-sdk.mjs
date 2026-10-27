// Runs in isolated official Electron Node runtime. Real Cordis lifecycle, fake auth admission.
// No playback start, catalogue scan, model request, browser or daily profile access.
import assert from 'node:assert/strict';
import http from 'node:http';
import {writeFile} from 'node:fs/promises';
const result={isolated:true,realCordis:true,authenticationAdmission:'fixture',nativeIO:false};
const sdk=process.env.WM_CONTRACT_SDK??'file:///C:/Users/HP/AppData/Local/Programs/DeepSeek%20Harness/resources/app.asar/dsh/node_modules/@deepseek-ai/cordis/lib/index.js';
process.env.WM_CONTRACT_ISOLATED='1';
let root;
async function request(base,path,body,headers={}){
  return new Promise((resolve,reject)=>{const req=http.request(base+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',...headers},timeout:1500},res=>{
    let raw='';res.on('data',v=>raw+=v);res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(raw)}));
  });req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('sdk-http-timeout')));req.end(body?JSON.stringify(body):undefined);});
}
try{
  const {Context}=await import(sdk),plugin=await import('../src/index.js');root=new Context();const routes=[];let admission;
  root.plugin({name:'author-sdk-provider',apply(ctx){ctx.provide('webServer',{register(route){routes.push(route);return()=>{};}});ctx.provide('connection',{requestRejection:()=>admission});}});
  await new Promise(r=>setTimeout(r,20));root.plugin({name:'author-sdk-plugin',inject:plugin.inject,apply:plugin.apply});
  await new Promise(r=>setTimeout(r,120));
  const bootstrap=routes.find(r=>r.path==='/whale-appearance/bootstrap');assert.ok(bootstrap);
  async function boot(){const response={status:0,setHeader(){},writeHead(n){this.status=n;},end(value){this.data=JSON.parse(value);}};await bootstrap.handler({headers:{}},response);return response;}
  admission=401;assert.equal((await boot()).status,401);admission=undefined;const b=await boot();assert.equal(b.data.ok,true);
  const base=`http://127.0.0.1:${b.data.port}`;
  const u=await request(base,'/api/author-properties/schema?wallpaperId=lucy');assert.equal(u.data.error,'author_unauthorized');
  const registered=await request(base,'/api/main/connect',{instanceId:'sdk-main',mainToken:b.data.mainToken,snapshot:{revision:1,settings:{weScene:'lucy',weAgeRatings:'Everyone'}}});assert.equal(registered.data.ok,true);
  const authed=await request(base,'/api/author-properties/schema?wallpaperId=lucy',undefined,{'x-whale-main-token':b.data.mainToken,'x-whale-instance-id':'sdk-main','x-whale-generation':String(registered.data.generation)});
  // No catalogue scan here: library refuses an unloaded catalogue, after real auth/lifecycle wiring.
  assert.equal(authed.data.ok,false);assert.ok(!['author_unauthorized','author_context_invalid','author_route_unknown'].includes(authed.data.error));
  result.routes=routes.map(r=>r.path);result.authorAuthenticatedResponse=authed;result.bootstrapAdmissionEnforced=true;result.passed=true;
}catch(error){result.error=error.stack;result.passed=false;process.exitCode=1;}
finally{if(root)await root.fiber.dispose();}
await writeFile(process.env.WM_CONTRACT_OUT,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
