// Offline process/clock substitutes; this never launches DSH, PowerShell or a browser.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,readFile,existsSync} from 'node:fs';
import * as fs from 'node:fs';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import vm from 'node:vm';

const [runner,output]=process.argv.slice(2);
assert.ok(runner&&output&&!existsSync(output));mkdirSync(output,{recursive:true});
const source=readFileSync(runner,'utf8'),rows=[];
for(const kind of ['success','helper-exit-error','timeout-exit','timeout-unknown','duplicate-receipt']){
 const root=path.join(output,kind);mkdirSync(root);
 const timers=[],calls=[];let unrefs=0,kills=0,treeKills=0;
 const child=new EventEmitter();Object.assign(child,{pid:912345,exitCode:null,signalCode:null,unref(){unrefs++;},kill(){kills++;if(kind==='timeout-exit'){child.signalCode='SIGTERM';child.emit('close',null,'SIGTERM');}}});
 const proc={argv:['node','runner','launchDefault'],execPath:process.execPath};
 if(kind==='duplicate-receipt')fs.writeFileSync(path.join(root,'launchDefault-result.json'),'{}');
 const sandbox={__dirname:root,process:proc,console:{log(){},error(){}},
  require(name){if(name==='node:child_process')return{spawn(exe,args,options){calls.push({exe,args,options});return child;},spawnSync(){treeKills++;throw Error('tree termination forbidden');}};if(name==='node:fs')return fs;if(name==='node:path')return path;throw Error('unapproved require');},
  setTimeout(fn,ms){const t={fn,ms};timers.push(t);return t;},clearTimeout(t){t.cleared=true;}};
 if(kind==='duplicate-receipt'){
  assert.throws(()=>vm.runInNewContext(source,sandbox,{timeout:500}),/Step evidence already exists/);assert.equal(calls.length,0);rows.push({kind,passed:true});continue;
 }
 vm.runInNewContext(source,sandbox,{timeout:500});assert.equal(calls.length,1);
 const {options,args}=calls[0];assert.equal(options.windowsHide,true);assert.equal(options.stdio[0],'ignore');assert.equal(typeof options.stdio[1],'number');assert.equal(typeof options.stdio[2],'number');
 assert.ok(args.includes(path.join(root,'launch-diagnostic-trial.ps1')));assert.ok(args.includes('default'));
 if(kind==='success'){child.exitCode=0;child.emit('close',0,null);}
 else if(kind==='helper-exit-error'){child.exitCode=1;child.emit('close',1,null);}
 else{timers.find(t=>t.ms===20000).fn();if(kind==='timeout-unknown')timers.find(t=>t.ms===26000).fn();}
 const result=JSON.parse(readFileSync(path.join(root,'launchDefault-result.json'),'utf8'));
 assert.equal(result.passed,kind==='success');assert.equal(result.appTreeKilled,false);assert.equal(treeKills,0);assert.equal(kills,kind.startsWith('timeout')?1:0);
 assert.equal(result.timedOut,kind.startsWith('timeout'));assert.equal(result.exitConfirmed,kind!=='timeout-unknown');assert.equal(unrefs,kind==='timeout-unknown'?1:0);
 assert.equal(result.launchOutcome,kind==='success'?'discovery-required':'unknown-do-not-retry');
 for(const fd of options.stdio.slice(1))assert.throws(()=>fs.fstatSync(fd),{code:'EBADF'});
 rows.push({kind,passed:true});
}
fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,cases:rows,realProcessesStarted:0,realAppsUsed:false},null,2),{flag:'wx'});
console.log(JSON.stringify({passed:true,cases:rows.length,realProcessesStarted:0}));
