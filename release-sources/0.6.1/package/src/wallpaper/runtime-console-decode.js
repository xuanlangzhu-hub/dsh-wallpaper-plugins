import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {decodeConsoleOutput} from './console-output-decode.js';
export function consumeConsoleEnvelope(envelope){
 if(envelope?.inBudget!==true||envelope.ownJobActive!==1||envelope.data?.result?.Succeeded!==true)return {status:'query-error',reason:'query-or-worker-unconfirmed'};
 const c=envelope.console,command=envelope.data.result.Command;
 if(!c||c.transport!=='desktop-follow-runtime-conpty-v1'||command?.Started!==true||command.Exited!==true||command.ExitCode!==0||command.TimedOut!==false||command.Forced!==false||command.OutputLimit!==false||command.ExitUnconfirmed!==false||command.Error!==null)return {status:'query-error',reason:'command-unconfirmed'};
 if(typeof c.rawBase64!=='string'||c.rawBase64.length>10924||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(c.rawBase64)||c.rawBase64!==command.StdoutBase64)return {status:'query-error',reason:'raw-output-unconfirmed'};
 return decodeConsoleOutput(c,Buffer.from(c.rawBase64,'base64'));
}
