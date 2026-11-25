// Task acknowledgements are independent of completion. No WE polling or IO here.
import {isSceneId,AGE_RATINGS} from '../appearance-contract.js';
const validPatch=p=>p&&typeof p==='object'&&!Array.isArray(p)&&Object.keys(p).every(k=>['enabled','wanted','manualSceneId','allowedRatings'].includes(k))&&
 Object.entries(p).every(([k,v])=>k==='manualSceneId'?v===null||isSceneId(v):k==='allowedRatings'?Array.isArray(v)&&v.every(r=>AGE_RATINGS.includes(r)):typeof v==='boolean');
export function createDesktopFollowTaskService(runtime,{taskMs=110000,maxQueued=4}={}) {
 if(!Number.isInteger(taskMs)||taskMs<1||taskMs>120000||!Number.isInteger(maxQueued)||maxQueued<1||maxQueued>8)throw Error('follow-task-budget-invalid');
 let owner=null,sequence=0,internalSequence=0,revision=0,epoch=0,nextId=0,disposed=false,fault=false,active=null,watch=null,watchUntil=0;
 const jobs=new Map(),queue=[],listeners=new Set();
 const unsettled=()=>[...jobs.values()].some(job=>job.pending);
 const physical=state=>state.pendingOperations>0||state.queryPending===true||state.catalogPending===true;
 function packet(job=null,serial=sequence){
  const raw=runtime.read(),busy=unsettled()||queue.length>0||physical(raw.state);
  return {...raw,protocol:2,owner,sequence:serial,revision,state:{...raw.state,busy,blocked:fault||raw.state.blocked,
   phase:busy&&raw.state.phase==='idle'?'waiting':raw.state.phase},task:job?{id:job.id,action:job.action,state:job.state,pending:job.pending,origin:job.origin??'manual'}:null};
 }
 function publish(job){revision++;const value=packet(job);for(const fn of [...listeners])try{fn(value);}catch{}}
 function watchPhysical(){
  if(watch||disposed)return;
  watch=setTimeout(()=>{watch=null;if(disposed)return;const current=packet();publish(null);
   if(current.state.busy&&Date.now()<watchUntil)watchPhysical();else if(current.state.busy){fault=true;publish(null);}
  },100);
 }
 function prune(){for(const [id,job] of jobs){if(jobs.size<16)break;if(!job.pending)jobs.delete(id);}}
 function cancelQueue(){for(const job of queue.splice(0)){clearTimeout(job.timer);job.state='cancelled';job.pending=false;publish(job);}}
 function run(job){
  job.state='running';job.pending=true;publish(job);
  // A stop calls the existing runtime synchronously, before returning its ack.
  let returned;try{returned=runtime.request(job.owner,++internalSequence,job.action,job.patch);}catch(error){returned=Promise.reject(error);}
  const work=Promise.resolve(returned);job.work=work;
  work.then(()=>{if(job.epoch===epoch&&owner===job.owner&&job.state!=='unknown')job.state='completed';
   else if(job.state!=='unknown')job.state='cancelled';
   if(job.action==='stop'&&!runtime.read().state.blocked&&!physical(runtime.read().state))fault=false;
  },()=>{if(job.state==='unknown')return;if(job.epoch===epoch&&owner===job.owner){job.state='failed';fault=true;cancelQueue();}else job.state='cancelled';})
   .finally(()=>{clearTimeout(job.timer);job.pending=false;if(active===job)active=null;publish(job);pump();watchPhysical();});
 }
 function stopJob(origin='manual'){
  const existing=[...jobs.values()].find(job=>job.action==='stop'&&job.pending&&job.owner===owner);if(existing)return existing;
  epoch++;cancelQueue();const job=create('stop');job.origin=origin;run(job);publish(job);watchPhysical();return job;
 }
 function pump(){if(active||disposed)return;const job=queue.shift();if(job){active=job;run(job);}}
 function create(action,patch){
  prune();const job={id:++nextId,owner,epoch,action,patch,state:'queued',pending:true,timer:null,work:null};jobs.set(job.id,job);
  job.timer=setTimeout(()=>{if(!job.pending)return;job.state='unknown';fault=true;epoch++;cancelQueue();
   // Retain the operation until its actual promise and physical operations finish.
   try{Promise.resolve(runtime.request(owner,++internalSequence,'stop')).catch(()=>{});}catch{}
   publish(job);
  },taskMs);watchUntil=Math.max(watchUntil,Date.now()+taskMs);return job;
 }
 return {
  setReady:(...args)=>runtime.setReady?.(...args),
  read:()=>packet(),subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
  claim(id){if(owner!==id){epoch++;cancelQueue();for(const job of jobs.values())clearTimeout(job.timer);owner=id;sequence=0;internalSequence=0;runtime.claim(id);}return packet();},
  release(id){if(owner!==id)return Promise.resolve();epoch++;cancelQueue();for(const job of jobs.values())clearTimeout(job.timer);owner=null;clearTimeout(watch);watch=null;return runtime.release(id);},
  request(id,serial,action,patch){
   if(disposed||id!==owner||!Number.isSafeInteger(serial)||serial<=sequence)throw Error('follow-stale-request');
   if(!['read','configure','tick','stop','startup'].includes(action)||(['configure','startup'].includes(action)?!validPatch(patch)||action==='startup'&&(patch.enabled!==true||patch.wanted!==true):patch!==undefined))throw Error('follow-task-invalid');
   if(action!=='read'&&action!=='stop'&&(fault||!runtime.read().state.available))throw Error('follow-unavailable');
   if(action!=='read'&&action!=='stop'&&queue.length>=maxQueued)throw Error('follow-queue-full');
   sequence=serial;
   if(action==='read')return packet(null,serial);
   if(action==='stop'){
    return packet(stopJob(),serial);
   }
   const job=create(action,patch);queue.push(job);publish(job);pump();watchPhysical();return packet(job,serial);
  },
  poll(){
   const raw=runtime.read(),s=raw.state;
   if(disposed||owner===null||fault||active||queue.length||unsettled()||physical(s)||!s.available||!s.enabled||!s.wanted||s.blocked||s.phase!=='running'||s.baseline!==true||
    raw.playback?.active!==true||raw.playback.failed===true||!s.desiredSceneId||s.activeSceneId!==s.desiredSceneId||raw.playback.activeSceneId!==s.desiredSceneId)return null;
   const job=create('tick');job.origin='automatic';queue.push(job);publish(job);pump();watchPhysical();return packet(job);
  },
  stopFromHost(){if(disposed||owner===null)return null;return packet(stopJob('host'));},
  verifyForPlayback:(...args)=>runtime.verifyForPlayback(...args),
  async dispose(){disposed=true;epoch++;cancelQueue();clearTimeout(watch);watch=null;for(const job of jobs.values())clearTimeout(job.timer);
   const result=await runtime.dispose();listeners.clear();return {...result,ok:result?.ok===true&&!unsettled()};},
 };
}
