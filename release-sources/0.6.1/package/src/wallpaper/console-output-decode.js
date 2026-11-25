import {parseCurrentWallpaperResult} from './desktop-follow-selection.js';
// This is a narrow linear-output grammar, not a general terminal emulator.
// A cursor move, wrapped/repainted screen, log line, or missing close receipt refuses.
export function decodeConsoleOutput(receipt,bytes){
 if(receipt?.transport!=='desktop-follow-runtime-conpty-v1'||receipt.exited!==true||receipt.exitCode!==0||receipt.cancelled!==false||receipt.overflow!==false||receipt.consoleClosed!==true||receipt.childrenExited!==true)return {status:'query-error',reason:'console-unconfirmed'};
 if(!(bytes instanceof Uint8Array)||bytes.byteLength>8192)return {status:'query-error',reason:'console-output-limit'};
 try{
  const raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes);let text='';
  for(let i=0;i<raw.length;){
   if(raw[i]==='\x1b'){
    const tail=raw.slice(i);let found=false;
    for(const token of ['\x1b[?25l','\x1b[?25h','\x1b[m','\x1b[0m','\x1b[2J','\x1b[H'])if(tail.startsWith(token)){
     if(['\x1b[2J','\x1b[H'].includes(token)&&text.length)throw Error('console-repaint-refused');i+=token.length;found=true;break;
    }
    if(found)continue;
    if(tail.startsWith('\x1b]0;')||tail.startsWith('\x1b]2;')){
     const bell=raw.indexOf('\x07',i+4),st=raw.indexOf('\x1b\\',i+4);let end=bell<0?st:st<0?bell:Math.min(bell,st);
     if(end<0||end-i>1024||/[\x00-\x1f\x7f-\x9f]/.test(raw.slice(i+4,end)))throw Error('console-title-refused');
     i=end+(end===bell?1:2);continue;
    }
    throw Error('console-control-refused');
   }
   const c=raw[i++];if(/[\x00-\x09\x0b\x0c\x0e-\x1f\x7f-\x9f]/.test(c))throw Error('console-control-refused');text+=c;
  }
  const query={exited:true,timedOut:false,exitCode:0,signal:null,stdout:text};const parsed=parseCurrentWallpaperResult(query);
  return {...parsed,encoding:'utf-8',query,transport:'conpty-linear-v1'};
 }catch(error){return {status:'query-error',reason:error.message};}
}
