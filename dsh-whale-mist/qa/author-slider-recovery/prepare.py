"""Isolate the fixed rc56 UI source; simplify only explicit own-failure recovery."""
from pathlib import Path
import argparse,difflib,hashlib,json
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
def prepare(out):
 p=json.loads((HERE/'baseline.json').read_bytes());source=ROOT/p['source'];assert sha(source)==p['sha256']
 out=Path(out).resolve();assert out.is_relative_to(ROOT/'.tmp') and not out.exists();out.mkdir(parents=True)
 old=source.read_text(encoding='utf-8');text=old
 def change(before,after):
  nonlocal text
  assert text.count(before)==1,(before[:80],text.count(before));text=text.replace(before,after)
 change('    discard({confirm=false,observed=false,expected=null,view=null}={}){','''    // Explicit refresh may clear only this controller's exact, settled failed delta.
    // This sends no apply command, never resets defaults, and retains foreign/stale recovery.
    async retry({view,discardOwnFailure=false}={}){
      if(disposed||views.get(view)!==true)return {ok:false,error:'unavailable'};
      const startEpoch=epoch,startContext=context;
      const result=await api.load();
      if(!result.ok||disposed||epoch!==startEpoch||context!==startContext||views.get(view)!==true)return {ok:false,error:'stale'};
      const pending=recovery;
      if(!pending)return result;
      if(discardOwnFailure!==true||pending.stale||!pending.own||pending.pending||!snapshot.canDiscard)return {ok:false,error:'manual-recovery-required'};
      return api.discard({confirm:true,observed:pending.unknown,expected:pending,view});
    },
    discard({confirm=false,observed=false,expected=null,view=null}={}){''')
 change("if(route==='schema')job.readDiagnostic=result?.__whaleReadDiagnostic??null;", "if(route==='schema')job.readDiagnostic=result?.__whaleReadDiagnostic??null;if(result?.ok===false&&result.error==='author_apply_timeout')job.applyTimedOut=true;")
 change("kind==='read'?'未能读取设置，请重试':uncertain?", "kind==='read'?'未能读取设置，请重试':job.applyTimedOut?'下发超时，请点击↻恢复编辑':uncertain?")
 change("title:state.editing?'取消未完成编辑后读取设置结构和本机记录；不读取壁纸实际值，不重复下发':'读取设置结构和本机记录；不读取壁纸实际值，不重复下发',", "title:state.phase==='blocked'||state.recovery?.own?'重新读取并恢复编辑；仅清除本侧栏本次待发送标记，不重复下发壁纸':state.editing?'取消未完成编辑后读取设置结构和本机记录；不读取壁纸实际值，不重复下发':'读取设置结构和本机记录；不读取壁纸实际值，不重复下发',")
 change("onClick:()=>author.load()},state.loading?", "onClick:()=>typeof author.retry==='function'?author.retry({view:token,discardOwnFailure:true}):author.load()},state.loading?")
 change("state.recovery.pending?'命令仍待结束，请稍后重新读取':state.recovery.unknown?", "state.recovery.pending?'命令仍待结束，请稍后重新读取':state.recovery.own&&!state.recovery.stale?'点击↻恢复编辑，不会重复下发':state.recovery.unknown?")
 change("?'点击↻恢复编辑，不会重复下发':state.recovery.unknown?", "?(state.recovery.unknown?'可能已发送；点击↻恢复编辑，不会重复下发':'点击↻恢复编辑，不会重复下发'):state.recovery.unknown?")
 change("重新读取只更新设置结构和本机记录，不读取壁纸实际值，不重复下发。", "刷新读取设置结构和本机记录；本侧栏自己的失败记录会清除待发送标记以恢复编辑。不读取壁纸实际值，也不重复下发。")
 change("!state.recovery.pending?h('details'", "!state.recovery.pending&&(!state.recovery.own||state.recovery.stale)?h('details'")
 (out/'native-sidebar.mjs').write_text(text,encoding='utf-8',newline='\n')
 (out/'native.patch').write_text(''.join(difflib.unified_diff(old.splitlines(True),text.splitlines(True),fromfile='rc56/native-sidebar.js',tofile='repair/native-sidebar.js')),encoding='utf-8')
 receipt={'source':p['source'],'inputSha256':p['sha256'],'outputSha256':sha(out/'native-sidebar.mjs'),'runtimePackageOrAssetsChanged':False,'hostAuthorizationRevisionAndDiscardGatesUnchanged':True,'automaticApplyRetry':False}
 (out/'source-receipt.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8');return receipt
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--output',required=True);print(json.dumps(prepare(p.parse_args().output)))
