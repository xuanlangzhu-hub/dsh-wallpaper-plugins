import {parseAgeRatings} from '../appearance-contract.js';
import {createBootstrapBoundService} from './bootstrap-service.js';
import {createDesktopFollowTaskService} from './task-service.js';
import {createFollowScheduler} from './scheduler.js';
export function createScheduledFollowService({readSettings=()=>null,timers=globalThis,intervalMs=5000,taskOptions={},...options}={}) {
 const runtime=createBootstrapBoundService({...options,readSettings}),tasks=createDesktopFollowTaskService(runtime,taskOptions);
 const scheduler=createFollowScheduler({read:()=>tasks.read(),subscribe:fn=>tasks.subscribe(fn),invoke:()=>tasks.poll(),readSettings,timers,intervalMs});
 const decorate=packet=>({...packet,state:{...packet.state,scheduling:scheduler.read()}});
 return {
  read:()=>decorate(tasks.read()),subscribe:fn=>tasks.subscribe(packet=>fn(decorate(packet))),
  claim(id){const result=tasks.claim(id);scheduler.reset();return decorate(result);},
  setReady(id,ready){tasks.setReady(id,ready);scheduler.refresh();},
  release(id){if(id===tasks.read().owner)scheduler.cancel('connection-retired');const result=tasks.release(id);scheduler.refresh();return result;},
  request(id,sequence,action,patch){const result=tasks.request(id,sequence,action,patch);if(action!=='read')scheduler.reset();return decorate(result);},
  settingsChanged(id){
   if(id!==tasks.read().owner)return;
   const settings=readSettings(),intent=runtime.readIntent();
   const policyChanged=JSON.stringify(parseAgeRatings(settings?.weAgeRatings))!==JSON.stringify(intent.allowedRatings);
   if(settings?.background!=='wallpaper'||policyChanged){scheduler.cancel('settings-stop');if(intent.wanted)tasks.stopFromHost();}
   scheduler.refresh();
  },
  verifyForPlayback:(...args)=>tasks.verifyForPlayback(...args),
  async dispose(){scheduler.dispose();return tasks.dispose();},
 };
}
