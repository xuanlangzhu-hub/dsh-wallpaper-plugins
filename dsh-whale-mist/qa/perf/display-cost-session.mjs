// QA-only wrapper around the accepted session/transport. Each phase retains normal window ownership.
import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {contextSnapshot} from './context-device-worker.mjs';
import {verifyAdapterPlan} from './adapter-device-worker.mjs';

const save=(path,value)=>writeFile(path,JSON.stringify(value,null,2),{flag:'wx'});
const load=async path=>JSON.parse(await readFile(path,'utf8'));
const order=['N1','I1','I2','N2'];

export function costCaptureArgs(args,luid){
  if(args[2]!=='--forever'||args[4]!=='pipe'||args[5]!=='--owned-location'||!args[6])throw new Error('QA requires accepted daily owned pipe argv');
  const out=[...args];out[2]='300'; // Five-minute safety budget per phase; never unattended unlimited QA.
  return [...out,'--qa-adapter-luid',luid];
}

export function createDisplayCostFactory({root,createSession,spawnImpl=spawn,verify=verifyAdapterPlan,describe=contextSnapshot}){
  let next=0;let busy=false;
  return options=>{
    let selected=null,child=null,closed=Promise.resolve(),phase=null,stopping=null;
    const session=createSession({...options,spawnChild:(helper,args,spawnOptions)=>{
      if(!selected||helper!==selected.helper)throw new Error('Unarmed QA capture');
      child=spawnImpl(helper,costCaptureArgs(args,selected.luid),spawnOptions);
      closed=new Promise(resolveClose=>child.once('close',(code,signal)=>resolveClose({code,signal})));
      child.once('close',()=>queueMicrotask(()=>session.stop().catch(error=>console.warn('[Whale display-cost QA]',error.message))));
      return child;
    }});
    const originalCreate=session.create.bind(session),originalStop=session.stop.bind(session);
    session.create=async config=>{
      if(config.scene?.mode!=='daily')throw new Error('This QA uses daily mode with a 300-second safety budget');
      if(busy||next>=order.length)throw new Error('QA phase already running or all four phases used');
      const label=order[next];const plan=await verify(root);const main=await load(join(root,'plan.json'));
      const ticket=await load(join(root,`${label}-armed.json`));
      if(ticket.label!==label||ticket.token!==main.token||!Number.isFinite(ticket.expiresAt)||ticket.expiresAt<Date.now())throw new Error('QA phase is not armed');
      const adapter=plan.adapters[label.startsWith('N')?1:0];
      selected={helper:plan.helper,luid:adapter.luid};phase={label,adapter,output:config.output,host:describe(),startedAt:Date.now()};
      await save(join(root,`${label}-claimed.json`),phase);next++;busy=true;
      try{
        const result=await originalCreate({...config,helper:plan.helper});
        phase={...phase,capturePid:child?.pid??null,source:session.report().window};
        await save(join(root,`${label}-started.json`),phase);
        return result;
      }catch(error){
        await save(join(root,`${label}-start-failed.json`),{...phase,error:error.message});
        throw error;
      }
    };
    session.stop=()=>{
      if(stopping)return stopping;
      stopping=(async()=>{
        const cleanup=await originalStop();let timer;
        try{
          if(child)await Promise.race([closed,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('QA child closure unconfirmed')),15000);})]);
        }finally{clearTimeout(timer);}
        if(phase&&cleanup?.closed===true){
          try{await save(join(root,`${phase.label}-ended.json`),{...phase,cleanup,childClosed:true,endedAt:Date.now(),final:session.report()});}
          catch(error){if(error.code!=='EEXIST')throw error;}
          busy=false;
        }
        return cleanup;
      })().finally(()=>{stopping=null;});
      return stopping;
    };
    return session;
  };
}

export function registerDisplayCost(ctx,resources,root,{registerRoutes,createSession}){
  const ready=(async()=>{
    const plan=await verifyAdapterPlan(root);const snapshot=contextSnapshot();
    if(process.platform!=='win32'||!snapshot.electron||snapshot.environment.ELECTRON_RUN_AS_NODE!=='1')throw new Error('Official Desktop Host required');
    await save(join(root,'display-host-ready.json'),{snapshot,helper:plan.helper,files:plan.files,order});
    return plan;
  })();
  ready.catch(error=>console.warn('[Whale display-cost QA]',error.message));
  // Wrapper waits for verified readiness before any session can be created.
  const factory=createDisplayCostFactory({root,createSession,verify:async()=>{await ready;return verifyAdapterPlan(root);}});
  const helper=join(root,'native','WallpaperProbeAdapterQa.exe');
  return registerRoutes(ctx,{...resources,helper,logRoot:join(root,'playback'),sessionFactory:factory});
}
