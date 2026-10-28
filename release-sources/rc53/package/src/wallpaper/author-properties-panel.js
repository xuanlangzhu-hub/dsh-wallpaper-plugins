import {createAuthorFormModel} from './author-properties-contract.js';

// One DOM form for the docked React mount and the standalone window. No HTML from authors.
// Palette/type inherit the existing appearance panel; sections explain the selected wallpaper.
export function createAuthorPanel({root,request,documentObj=root?.ownerDocument,timeoutMs=4000}={}) {
  if (!root || !documentObj?.createElement || typeof request!=='function') throw new TypeError('Author panel needs a mount and transport');
  if (!Number.isInteger(timeoutMs)||timeoutMs<10||timeoutMs>5000) throw new TypeError('Invalid author form deadline');
  const model=createAuthorFormModel();
  let disposed=false,contextKey=null,selected=null,usable=false,operation=null,epoch=0,filter='',message='',busy=false;
  let fieldsRoot,notice,save,refresh,reset,confirmReset,apply,inputs=[],canApply=false,applicationAvailable=false;
  const invalidKeys=new Set();
  const textStyle={fontSize:'12px',lineHeight:'1.6',color:'inherit'};
  const el=(tag,text,props={})=>{
    const node=documentObj.createElement(tag);if(text!==null)node.textContent=text;
    if(tag==='button')Object.assign(node.style,{font:'inherit',color:'inherit',background:'transparent',border:'1px solid var(--dsw-alias-border-l2, #ffffff44)',padding:'6px 9px',borderRadius:'6px'});
    for(const [key,value] of Object.entries(props)){if(key==='style')Object.assign(node.style,value);else if(key==='onClick')node.addEventListener('click',value);else node[key]=value;}
    return node;
  };
  function cancel(){epoch++;if(operation){operation.abort();operation=null;}busy=false;}
  function status(value){message=value;if(notice)notice.textContent=value;}
  function setBusy(value){busy=value;for(const node of inputs)node.disabled=value;
    if(save)save.disabled=value||invalidKeys.size>0||!Object.keys(model.snapshot()?.pending??{}).length;
    if(apply)apply.disabled=value||invalidKeys.size>0||!canApply||Object.keys(model.snapshot()?.pending??{}).length>0||!model.snapshot()?.draft.dirtyKeys?.length;
    if(refresh)refresh.disabled=value;if(reset)reset.disabled=value||!model.snapshot();}
  function errorMessage(error){
    if(error==='author_revision_conflict')return '另一窗口已更新草稿。请点“刷新草稿”后再保存；本地修改仍保留。';
    if(['author_schema_changed','author_schema_stale'].includes(error))return '作者参数已变化。请刷新；确认后可单独恢复作者默认值。';
    if(['author_unauthorized','author_context_changed','author_cancelled'].includes(error))return '选择、播放状态或连接已变化，请刷新草稿。';
    if(error==='author_apply_busy')return '上一条参数命令尚未确认结束，请稍后刷新；草稿保留。';
    if(error?.startsWith('author_apply')||error?.startsWith('author_target'))return '未能确认参数下发，请先检查当前播放状态，再刷新草稿；不会自动重试。';
    return '未能读取或保存草稿，请刷新重试。';
  }
  async function perform(kind){
    if(disposed||busy||!usable||(kind==='draft'&&invalidKeys.size))return;
    const ticket=model.ticket(),myEpoch=epoch,controller=new AbortController();operation=controller;setBusy(true);
    let timer;
    try{
      const payload=kind==='schema'?{wallpaperId:selected}:kind==='reset'?model.resetRequest():kind==='apply'?model.planRequest():model.request();
      const result=await Promise.race([
        Promise.resolve().then(()=>request(kind==='schema'?'schema':kind==='apply'?'apply':'draft',payload,{signal:controller.signal})),
        new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('timeout'));},kind==='apply'?10000:timeoutMs);}),
        new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true})),
      ]);
      if(disposed||myEpoch!==epoch||controller.signal.aborted)return;
      if(!result?.ok){if(kind==='apply')canApply=false;status(result?.sentMayHaveOccurred?'参数可能已发送，但结果未确认。草稿保留，请观察当前壁纸后刷新；不会自动重试。':errorMessage(result?.error));return;}
      if(model.accept(ticket,result)){
        applicationAvailable=result.application?.available===true;canApply=result.application?.targetActive===true;
        message=kind==='apply'?'参数已发送；请观察当前壁纸的效果，尚未读取当前值。':kind==='schema'?'已读取作者默认值和插件草稿；尚未下发壁纸。':kind==='reset'?'插件草稿已恢复作者默认值；尚未下发壁纸。':'草稿已保存到本次连接；尚未下发壁纸。';
        invalidKeys.clear();draw();
      }
    }catch{if(!disposed&&myEpoch===epoch)status('请求已取消或超时，请刷新草稿。');}
    finally{clearTimeout(timer);if(myEpoch===epoch){operation=null;setBusy(false);}}
  }
  function change(field,value,node){
    try{model.edit({[field.key]:value});invalidKeys.delete(field.key);status('有未保存的修改；尚未下发壁纸。');node?.removeAttribute?.('aria-invalid');}
    catch{invalidKeys.add(field.key);status('数值不符合作者参数限制，请修正后保存。');node?.setAttribute?.('aria-invalid','true');}
    setBusy(false);
  }
  function control(field,value){
    const node=el(field.type==='combo'?'select':'input',null,{style:{maxWidth:'100%',color:'inherit',background:'transparent',accentColor:'var(--dsw-alias-brand-primary, #8c72f2)'}});
    node.setAttribute('aria-label',field.label);node.setAttribute('data-author-key',field.key);
    if(field.type==='bool'){node.type='checkbox';node.checked=value===true;node.addEventListener('change',()=>change(field,node.checked,node));}
    else if(field.type==='slider'){
      node.type='number';node.min=field.min;node.max=field.max;node.step=field.step??(field.fraction?'any':1);node.value=String(value);
      Object.assign(node.style,{width:'72px'});
      const wrap=el('span',null,{style:{display:'flex',gap:'6px',alignItems:'center',maxWidth:'60%'}});
      const range=el('input',null,{type:'range',min:field.min,max:field.max,step:node.step,value:String(value),style:{width:'90px',maxWidth:'45%'}});
      range.setAttribute('aria-label',field.label+'滑块');range.addEventListener('input',()=>{node.value=range.value;change(field,Number(range.value),node);});
      node.addEventListener('change',()=>{change(field,node.value.trim()===''?NaN:Number(node.value),node);range.value=node.value;});
      wrap.appendChild(range);wrap.appendChild(node);inputs.push(range,node);return wrap;
    }else if(field.type==='color'){
      node.type='color';node.value='#'+value.split(' ').map(n=>Math.round(Number(n)*255).toString(16).padStart(2,'0')).join('');
      node.addEventListener('change',()=>change(field,[1,3,5].map(i=>parseInt(node.value.slice(i,i+2),16)/255).join(' '),node));
    }else if(field.type==='combo'){
      field.options.forEach((option,index)=>node.appendChild(el('option',option.label,{value:String(index)})));
      node.value=String(field.options.findIndex(option=>Object.is(option.value,value)));
      node.addEventListener('change',()=>change(field,field.options[Number(node.value)]?.value,node));
    }else{node.type='text';node.maxLength=256;node.value=value;node.addEventListener('change',()=>change(field,node.value,node));}
    inputs.push(node);return node;
  }
  function drawFields(){
    fieldsRoot.replaceChildren();inputs=[];const snapshot=model.snapshot();if(!snapshot)return;
    const {schema,draft}=snapshot;
    if(schema.state==='empty'){fieldsRoot.appendChild(el('p','作者没有公开可调参数。'));return;}
    if(draft.stale){fieldsRoot.appendChild(el('p','旧草稿与新参数不兼容，已暂停编辑。恢复作者默认值会清除旧草稿。'));return;}
    let section=fieldsRoot,count=0;
    for(const field of schema.fields){
      if(['group','text'].includes(field.type)&&field.reason==='unsupported-type'){
        const group=el('details',null,{open:true}),summary=el('summary',field.label,{style:{fontWeight:'600',padding:'10px 0'}});
        group.appendChild(summary);fieldsRoot.appendChild(group);section=group;continue;
      }
      if(filter&&!`${field.label} ${field.key}`.toLowerCase().includes(filter.toLowerCase()))continue;
      count++;
      const row=el('label',null,{style:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',padding:'9px 0',borderBottom:'1px solid var(--dsw-alias-border-l2, #ffffff22)'}});
      row.appendChild(el('span',field.label,{style:{flex:'1',overflowWrap:'anywhere'}}));
      row.appendChild(field.supported?control(field,draft.values[field.key]):el('span',field.reason==='unsupported-condition'?'条件参数暂未支持':'暂不支持',{style:{opacity:'.65',fontSize:'11px'}}));
      section.appendChild(row);
    }
    if(!count)fieldsRoot.appendChild(el('p',filter?'没有匹配的参数。':'这张壁纸的公开参数暂未支持。'));
  }
  function draw(){
    root.replaceChildren();Object.assign(root.style,{...textStyle,paddingTop:'16px',marginTop:'12px',borderTop:'1px solid var(--dsw-alias-border-l2, #ffffff22)'});
    root.appendChild(el('h3','壁纸作者设置',{style:{fontSize:'13px',margin:'0 0 6px'}}));
    if(!usable){root.appendChild(el('p','所选壁纸不可读取参数，或连接已断开。'));return;}
    root.appendChild(el('p','草稿仅保存在本次连接。作者默认值不代表壁纸当前值。',{style:{margin:'0 0 10px',opacity:'.75'}}));
    const search=el('input',null,{type:'search',placeholder:'搜索此壁纸的参数',value:filter,style:{boxSizing:'border-box',width:'100%',padding:'7px',background:'transparent',color:'inherit',border:'1px solid var(--dsw-alias-border-l2, #ffffff44)',borderRadius:'6px'}});
    search.setAttribute('aria-label','搜索作者参数');search.addEventListener('input',()=>{filter=search.value.slice(0,160);drawFields();setBusy(busy);});root.appendChild(search);
    fieldsRoot=el('div',null,{style:{maxHeight:'360px',overflowY:'auto',overscrollBehavior:'contain'}});root.appendChild(fieldsRoot);drawFields();
    notice=el('p',message,{style:{margin:'10px 0',opacity:'.85'}});notice.setAttribute('role','status');root.appendChild(notice);
    const actions=el('div',null,{style:{display:'flex',gap:'8px',flexWrap:'wrap'}});
    save=el('button','保存草稿',{type:'button',onClick:()=>perform('draft')});
    refresh=el('button','刷新草稿',{type:'button',onClick:()=>perform('schema')});
    apply=el('button',applicationAvailable?'应用到当前壁纸':'应用到当前壁纸（待接入）',{type:'button',disabled:true,onClick:()=>perform('apply')});
    actions.appendChild(save);actions.appendChild(refresh);actions.appendChild(apply);root.appendChild(actions);
    const resetBox=el('details',null,{style:{marginTop:'12px'}});resetBox.appendChild(el('summary','恢复作者默认值'));
    resetBox.appendChild(el('p','只重置插件草稿，会丢弃这张壁纸尚未保存的修改。不会修改原壁纸文件。'));
    confirmReset=el('input',null,{type:'checkbox'});const confirmLabel=el('label','我确认重置草稿 ');confirmLabel.appendChild(confirmReset);resetBox.appendChild(confirmLabel);
    reset=el('button','确认恢复默认草稿',{type:'button',onClick:()=>{if(confirmReset.checked)perform('reset');else status('请先勾选确认，再恢复默认草稿。');}});resetBox.appendChild(reset);root.appendChild(resetBox);setBusy(busy);
  }
  return {
    update({wallpaperId,allowed=false,connected=false,contextKey:key=''}){
      if(disposed)return;const next=JSON.stringify([wallpaperId,allowed,connected,key]);if(next===contextKey)return;
      const privacyChange=!allowed||!connected;cancel();invalidKeys.clear();contextKey=next;usable=allowed&&connected;
      if(privacyChange){model.clear();selected=null;}else if(selected!==wallpaperId){model.select(wallpaperId);selected=wallpaperId;filter='';}else model.ticket();
      canApply=false;applicationAvailable=false;message=usable?'读取作者设置中…':'';draw();if(usable)void perform('schema');
    },
    refresh:()=>perform('schema'),
    snapshot:()=>model.snapshot(),
    dispose(){if(disposed)return;disposed=true;cancel();model.clear();root.replaceChildren();},
  };
}
