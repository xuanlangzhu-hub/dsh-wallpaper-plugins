// No native calls. A future supervised worker supplies its result AND exact child-close
// receipt; cancelling a UI wait is never treated as a child exiting.
export function createDesktopQueryLifecycle({launch=null,closeMs=2000}={}) {
  if(!Number.isInteger(closeMs)||closeMs<1||closeMs>10000)throw Error('invalid-query-close-budget');
  let active=null,uncertain=false,disposed=false;
  const read=()=>({available:!disposed&&!uncertain&&typeof launch==='function',pending:active!==null,uncertain});
  return {
    read,
    async query({signal,monitor=null}={}) {
      if(!read().available||active||signal?.aborted||monitor!==null)throw Error('query-unavailable');
      const task={handle:null};active=task;let timer,onAbort;
      try {
        task.handle=launch({monitor:null,signal});
        const h=task.handle;
        if(!h||typeof h.cancel!=='function'||!h.result?.then||!h.closed?.then){uncertain=true;throw Error('invalid-query-worker');}
        onAbort=()=>{try{h.cancel();}catch{uncertain=true;}};
        signal?.addEventListener('abort',onAbort,{once:true});if(signal?.aborted)onAbort();
        // Keep the physical slot even when the consumer's bounded close wait expires.
        const real=Promise.allSettled([h.result,h.closed]);
        real.then(()=>{if(active===task)active=null;});
        const result=await h.result.catch(()=>{throw Error('query-command-failed');});
        const close=await Promise.race([h.closed,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('query-close-unconfirmed')),closeMs);})]);
        if(close?.exited!==true||close.queryChildCleanupConfirmed!==true)throw Error('query-close-unconfirmed');
        if(signal?.aborted)throw Error('query-cancelled');
        return result;
      } catch(error) {
        // Cancel only the worker created by this launch, never a shared WE process.
        try{task.handle?.cancel?.();}catch{}
        if(error.message!=='query-cancelled')uncertain=true;
        throw Error(error.message==='query-cancelled'?'query-cancelled':'query-unconfirmed');
      } finally {
        clearTimeout(timer);signal?.removeEventListener('abort',onAbort);
        if(!task.handle&&active===task)active=null;
      }
    },
    dispose(){disposed=true;try{active?.handle?.cancel?.();}catch{uncertain=true;}return read();},
  };
}
