import {execFile, spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {promisify} from 'node:util';
import {validateSceneRoot} from './source-evidence.mjs';
import {validateMediaRoot} from './media-source-evidence.mjs';

const executeFile = promisify(execFile);
const launchOptions = {windowsHide:true, maxBuffer:8192};

export function processStartTicks(value) {
  const match = typeof value === 'string' && /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,7}))?(?:Z|\+00:00)$/.exec(value);
  const beforeFraction = match ? Date.parse(match[1]+'Z') : NaN;
  if (!Number.isFinite(beforeFraction)) throw Error('fixed-canvas-source-time-invalid');
  return String(621355968000000000n + BigInt(beforeFraction)*10000n + BigInt((match[2] ?? '').padEnd(7,'0')));
}

export function createFixedCanvasNative({executable, desktopPid, desktopImage, engineImage,
  execute=executeFile, spawnProcess=spawn}) {
  async function read(args, signal, timeout) {
    signal.throwIfAborted();
    const {stdout} = await execute(executable,args,{...launchOptions,signal,timeout});
    signal.throwIfAborted();
    return JSON.parse(stdout);
  }

  return {
    async readMonitor({signal}) {
      const {monitor} = await read(['--monitor'],signal,2400);
      const {left,top,right,bottom} = monitor;
      if (![left,top,right,bottom].every(Number.isSafeInteger)) return null;
      return {left,top,width:right-left,height:bottom-top,monitorCount:1};
    },
    async proveSource({source,sourceType='scene',monitor,signal}) {
      if (!['scene','video','web'].includes(sourceType)) throw Error('fixed-canvas-type-unsupported');
      const {pid,hwnd,startUtc,location} = source;
      if (![pid,hwnd].every(value=>Number.isSafeInteger(value)&&value>0) ||
          !/^WhaleWallpaperProbe-[A-Za-z0-9-]{1,90}$/.test(location)) throw Error('fixed-canvas-source-identity-invalid');
      const runId = randomUUID();
      const startTicks = processStartTicks(startUtc);
      const identity = {runId,pid,hwnd,startTicks};
      const client = sourceType !== 'scene';
      const report = await read([client ? '--prove-client' : '--prove-source',String(pid),String(hwnd),
        engineImage,startUtc,location,runId],signal,10000).catch(error=>{
        if (client && error.code === 2 && !signal.aborted) {
          const reason = JSON.parse(error.stdout)?.error;
          if (typeof reason === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(reason)) throw Error(reason);
        }
        throw error;
      });
      return client ? validateMediaRoot(report,identity,monitor) : validateSceneRoot(report,identity);
    },
    watchDesktop({ownerGeneration,signal,onPacket}) {
      signal.throwIfAborted();
      const runId = randomUUID();
      const child = spawnProcess(executable,['--watch-dsh',String(desktopPid),desktopImage,runId,String(ownerGeneration)],
        {windowsHide:true,stdio:['pipe','pipe','ignore']});
      let reason = null, result = null, buffer = '', heartbeat, terminator, reapDeadline;
      let finish;
      const exited = new Promise(resolve=>{finish=resolve;});
      const abort = () => requestStop('stopped');

      function requestStop(cause) {
        if (reason || result) return;
        reason = cause;
        clearTimeout(heartbeat);
        child.stdin?.end();
        terminator = setTimeout(() => {
          if (child.exitCode === null && child.signalCode === null) {
            try { child.kill(); } catch {}
          }
        },250);
        reapDeadline = setTimeout(()=>finish({reaped:false,reason}),1600);
      }
      function expectPacket() {
        clearTimeout(heartbeat);
        heartbeat = setTimeout(()=>requestStop('watch-timeout'),2800);
      }

      child.stdin?.on('error',()=>requestStop('watch-pipe-error'));
      child.stdout?.on('error',()=>requestStop('watch-output-error'));
      child.on('error',()=>requestStop('watch-child-error'));
      child.once('close',(exitCode,signalCode)=>{
        clearTimeout(heartbeat);clearTimeout(terminator);clearTimeout(reapDeadline);
        signal.removeEventListener('abort',abort);
        result = {reaped:true,reason,exitCode,signalCode};
        finish(result);
      });
      child.stdout?.setEncoding('utf8');
      child.stdout?.on('data',chunk=>{
        if (reason || result) return;
        buffer += chunk;
        if (buffer.length > 16384) { requestStop('watch-output-limit'); return; }
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          try {
            const packet = JSON.parse(line);
            if (packet.runId !== runId || packet.ownerGeneration !== ownerGeneration || packet.pid !== desktopPid)
              throw Error('watch-identity-mismatch');
            onPacket(packet);
            if (packet.terminal === true) { requestStop('watch-binding-retired'); return; }
            if (reason) return;
            expectPacket();
          } catch { requestStop('watch-packet-invalid'); return; }
        }
      });
      expectPacket();
      signal.addEventListener('abort',abort,{once:true});
      if (signal.aborted) abort();
      return {exited,async close() { requestStop('stopped'); return result ?? await exited; }};
    },
  };
}
