// Read/arm one fixed phase. No window creation, no process launch and no UI automation.
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {verifyAdapterPlan} from './adapter-device-worker.mjs';
const {values}=parseArgs({options:{root:{type:'string'},phase:{type:'string'},arm:{type:'boolean'}}});
const order=['N1','I1','I2','N2'];
if(!values.root||!order.includes(values.phase))throw new Error('Explicit --root --phase N1/I1/I2/N2 required');
const root=resolve(values.root),phase=values.phase;
const load=async file=>JSON.parse(await readFile(join(root,file),'utf8'));
if(values.arm){
  await verifyAdapterPlan(root);const at=order.indexOf(phase);
  if(at){const previous=await load(`${order[at-1]}-ended.json`);if(previous.cleanup?.closed!==true||previous.childClosed!==true||previous.final?.failure)throw new Error('Prior phase not proven clean');}
  const plan=await load('plan.json');
  await writeFile(join(root,`${phase}-armed.json`),JSON.stringify({label:phase,token:plan.token,expiresAt:Date.now()+600000},null,2),{flag:'wx'});
  console.log(JSON.stringify({armed:phase,adapter:phase.startsWith('N')?'NVIDIA':'Intel',windowOpened:false}));
}else{
  const started=await load(`${phase}-started.json`);const status=JSON.parse(await readFile(join(started.output,'preview-status.json'),'utf8'));
  const devices=status.diagnostics?.messages?.filter(m=>m.startsWith('[Capture] {')).map(m=>JSON.parse(m.slice('[Capture] '.length))).filter(d=>d.luid)??[];
  if(devices.length!==1||devices[0].luid!==started.adapter.luid)throw new Error('Actual device diagnosis missing or mismatched');
  if(status.failure||status.native?.captureSource!=='window'||!Number.isFinite(status.native?.seconds)||status.native.seconds<30||!(status.client?.rendered>0)||status.client?.hidden!==0)
    throw new Error('Not warm/visible/playing or capture failed');
  console.log(JSON.stringify({phase,capturePid:started.capturePid,location:status.window.location,nativeDirectory:started.output,hostDirectory:started.output,
    adapter:devices[0],nativeSeconds:status.native.seconds,clientRendered:status.client.rendered,clientHidden:status.client.hidden,status}));
}
