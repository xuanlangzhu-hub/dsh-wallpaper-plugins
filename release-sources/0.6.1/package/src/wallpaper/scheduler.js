// One deferred wake after a successful task settles. No catch-up, overlapping ticks,
// or retry after a failed/suspended/uncertain operation.
export function createFollowScheduler({read,subscribe,invoke,readSettings=()=>null,timers=globalThis,intervalMs=5000}={}) {
 if(typeof read!=='function'||typeof invoke!=='function'||!Number.isInteger(intervalMs)||intervalMs<1000||intervalMs>60000)throw Error('follow-scheduler-config-invalid');
 let disposed=false,timer=null,due=null,epoch=0,key=null,reason='not-started',fault=null,wakes=0;
 const now=()=>typeof timers.now==='function'?timers.now():Date.now();
 function cancel(why='cancelled'){epoch++;if(timer!==null)timers.clearTimeout(timer);timer=null;due=null;key=null;reason=why;}
 function eligible(){
  const p=read(),s=p?.state??{},settings=readSettings();
  if(p?.owner==null)return {ok:false,reason:'no-owner'};
  if(settings?.background!=='wallpaper')return {ok:false,reason:'background-inactive'};
  if(!s.available||!s.enabled||!s.wanted)return {ok:false,reason:'not-enabled-playing'};
  if(s.blocked||s.queryPending||s.catalogPending||s.pendingOperations>0)return {ok:false,reason:'pending-or-blocked'};
  if(s.busy)return {ok:false,reason:'busy'};
  if(s.phase!=='running'||s.baseline!==true||p.playback?.active!==true||p.playback.failed===true||
    !s.desiredSceneId||s.activeSceneId!==s.desiredSceneId||p.playback.activeSceneId!==s.desiredSceneId)return {ok:false,reason:'not-confirmed-running'};
  return {ok:true,key:JSON.stringify([p.owner,s.generation,s.desiredSceneId])};
 }
 function refresh(){
  if(disposed)return;
  if(fault){cancel('scheduler-failed');return;}
  let value;try{value=eligible();}catch{fault='state-unconfirmed';cancel('scheduler-failed');return;}
  if(!value.ok){cancel(value.reason);return;}
  if(timer!==null&&key===value.key)return;
  cancel('scheduled');key=value.key;due=now()+intervalMs;const stamp=epoch,scheduledKey=key;
  timer=timers.setTimeout(()=>{
   if(disposed||stamp!==epoch)return;
   timer=null;due=null;
   try{
    const current=eligible();if(!current.ok||current.key!==scheduledKey){refresh();return;}
    wakes++;invoke();refresh();
   }catch{fault='tick-admission-unconfirmed';cancel('scheduler-failed');}
  },intervalMs);timer?.unref?.();
 }
 const off=subscribe?.(refresh);refresh();
 return {refresh,cancel,reset(){fault=null;cancel('reset');refresh();},
  read:()=>({state:disposed?'disposed':fault?'suspended':timer!==null?'scheduled':['busy','pending-or-blocked'].includes(reason)?'in-flight':'paused',reason,fault,intervalMs,nextDelayMs:due===null?null:Math.max(0,due-now()),wakes}),
  dispose(){if(!disposed){disposed=true;cancel('disposed');off?.();}}};
}
