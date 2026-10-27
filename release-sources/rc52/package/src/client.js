window.__ModuleLoader__.load({
  id: "dsh-whale-mist",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    const { FishLogo } = require("@deepseek-ai/dsh-client-ui-primitives");

    /* WM_AUTHOR_PANEL_BEGIN */
    const WM_AUTHOR_PANEL = (() => {
// Local, machine-checked validation for the supervised managed-window mode.
// The Host creates and closes the wallpaper window itself, so every value that
// reaches a helper command line is validated here first: the location must be
// this round's unique window name, and the sample must be an absolute .json or .mp4
// playback path. Nothing in this file reads the network or the environment.

const LOCATION_PREFIX = 'WhaleWallpaperProbe-';
const MAX_LOCATION = 120;
const MAX_FILE = 400;

const FORBIDDEN_LOCATION = new Set(['"', '\\', '/', ';', '&', '|', '^', '%']);

function validateLocation(value) {
  const location = typeof value === 'string' ? value.trim() : '';
  if (!location) throw new Error('window location is required');
  if (location.length > MAX_LOCATION) throw new Error(`window location must be at most ${MAX_LOCATION} characters`);
  if (!location.startsWith(LOCATION_PREFIX)) throw new Error(`window location must start with ${LOCATION_PREFIX}`);
  for (const character of location) {
    const code = character.codePointAt(0);
    if (code < 0x21 || code > 0x7e || FORBIDDEN_LOCATION.has(character))
      throw new Error(`window location contains unsupported character 0x${code.toString(16)}`);
  }
  return location;
}

function validateProjectFile(value) {
  const file = typeof value === 'string' ? value.trim() : '';
  if (!file) throw new Error('wallpaper project file is required');
  if (file.length > MAX_FILE) throw new Error(`wallpaper project file must be at most ${MAX_FILE} characters`);
  if (!/^[a-zA-Z]:[\\/]/.test(file) && !file.startsWith('\\\\')) throw new Error('wallpaper project file must be an absolute path');
  if (file.startsWith('\\\\') && !/^\\\\[^\\/:]+\\[^\\/:]+\\/.test(file)) throw new Error('wallpaper project file must be an absolute path');
  if (!/\.(json|mp4)$/i.test(file)) throw new Error('wallpaper project file must be a .json or .mp4 path');
  if (file.startsWith('\\\\.\\') || /[\x00-\x1f";<>|?*]/.test(file) || file.slice(2).includes(':')) throw new Error('wallpaper project file contains unsupported characters');
  return file;
}

function validateSize(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value < 160 || value > 7680) throw new Error('window size is out of range');
  return value;
}

/** Round-unique window name; never reuses a previous round's name. */
function newLocation(now = Date.now(), random = Math.random()) {
  const stamp = new Date(now).toISOString().replace(/[-:TZ.]/g, '').slice(2, 14);
  const suffix = Math.floor(random * 0x10000).toString(16).padStart(4, '0');
  return validateLocation(`${LOCATION_PREFIX}${stamp}-${suffix}`);
}

/** One helper invocation, resolved with its parsed stdout or a bounded error. */
function runHelper(spawnImpl, helper, args, { timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl(helper, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => { try { child.kill(); } catch { /* already gone */ } finish(new Error(`${args[0]} timed out after ${timeoutMs} ms`)); }, timeoutMs);
    child.on('error', error => finish(error));
    child.stdout?.on('data', chunk => { stdout += chunk; });
    child.stderr?.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-4000); });
    child.on('close', code => {
      const text = stdout.trim();
      if (code === 0 && text) {
        try { finish(null, JSON.parse(text)); return; } catch { finish(new Error(`${args[0]} returned unreadable output: ${text.slice(0, 200)}`)); return; }
      }
      const reason = stderr.trim().split('\n').filter(Boolean).pop() ?? '';
      finish(new Error(`${args[0]} exited ${code}${reason ? `: ${reason.slice(0, 300)}` : ''}`));
    });
  });
}

const defaultSleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Poll until exactly one window with this round's name exists. A window can be
 * created by the helper slightly before or after its process exits, so the wait
 * runs a fast grace poll first and only then falls back to slow polling.
 * Returns null when nothing appeared within the bounded attempts.
 */
async function waitForWindow(runHelperFn, location, {
  fastAttempts = 40, fastDelayMs = 100,
  attempts = 400, delayMs = 100,
  graceAttempts = 0, graceDelayMs = 250,
  sleep = defaultSleep,
} = {}) {
  const total = fastAttempts + graceAttempts + attempts;
  for (let attempt = 0; attempt < total; attempt++) {
    const found = await runHelperFn(['--window-find']).catch(() => []);
    const matches = (found ?? []).filter(window => window.title === location);
    if (matches.length === 1) return normalizeWindow(matches[0]);
    if (matches.length > 1) throw new Error(`${matches.length} windows named ${location}; refusing an ambiguous session`);
    const delay = attempt < fastAttempts ? fastDelayMs : attempt < fastAttempts + graceAttempts ? graceDelayMs : delayMs;
    await sleep(delay);
  }
  return null;
}

/**
 * One shape for window records regardless of the helper's field naming, so the
 * lifecycle never depends on a serialization detail.
 */
function normalizeWindow(window) {
  if (!window || typeof window !== 'object') throw new Error('window record is missing');
  const hwnd = window.hwnd ?? window.Hwnd;
  const pid = window.pid ?? window.Pid;
  const title = window.title ?? window.Title;
  if (!Number.isInteger(hwnd) || hwnd <= 0) throw new Error(`window record has no usable handle: ${JSON.stringify(window)}`);
  const rawStartUtc = window.startUtc ?? window.StartUtc ?? null;
  const startUtc = typeof rawStartUtc === 'string' && rawStartUtc.trim() ? rawStartUtc.trim() : null;
  return {
    hwnd,
    pid: typeof pid === 'number' ? pid : null,
    title,
    visible: window.visible ?? window.Visible ?? null,
    left: window.left ?? window.Left ?? null,
    top: window.top ?? window.Top ?? null,
    startUtc,
  };
}

// Shared by the future docked/detached forms and Host. No Node, DOM, eval or command execution.

const AUTHOR_SCHEMA_VERSION=1;
const AUTHOR_LIMITS=Object.freeze({fields:256,options:64,label:160,text:256,key:64,number:1e6,bodyBytes:32768,drafts:32});
const banned=new Set(['__proto__','constructor','prototype']);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const authorError=code=>Object.assign(new Error(code),{authorReason:code});
const isAuthorKey=value=>typeof value==='string'&&/^[A-Za-z0-9_]{1,64}$/.test(value)&&!banned.has(value.toLowerCase());
const isAuthorFingerprint=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const isAuthorObject=plain;
function safeAuthorString(value,max=AUTHOR_LIMITS.text){
  if(typeof value!=='string'||value.length>max||/[\x00-\x1f\x7f<>]/.test(value)||value.includes(')~END')||value.includes('RAW~(')||/^(?:[a-z]:[\\/]|\\\\|file:)/i.test(value))throw authorError('author_string_invalid');
  return value;
}

function validateAuthorValue(field,value){
  if(!field||field.supported!==true||!isAuthorKey(field.key))throw authorError('author_field_unsupported');
  if(field.type==='bool'){if(typeof value!=='boolean')throw authorError('author_value_invalid');return value;}
  if(field.type==='slider'){
    if(!Number.isFinite(field.min)||!Number.isFinite(field.max)||field.min>field.max||Math.abs(field.min)>AUTHOR_LIMITS.number||Math.abs(field.max)>AUTHOR_LIMITS.number||typeof field.fraction!=='boolean'||field.step!==null&&field.step!==undefined&&(!Number.isFinite(field.step)||field.step<=0))throw authorError('author_schema_invalid');
    if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>AUTHOR_LIMITS.number||value<field.min||value>field.max||(!field.fraction&&!Number.isInteger(value)))throw authorError('author_value_invalid');
    if(field.step!==null&&field.step!==undefined){const n=(value-field.min)/field.step;if(!Number.isFinite(n)||Math.abs(n-Math.round(n))>1e-7)throw authorError('author_step_invalid');}
    return Object.is(value,-0)?0:value;
  }
  if(field.type==='color'){
    if(typeof value!=='string'||value.length>96||!/^\s*\d*\.?\d+(?:[eE][+-]?\d+)?\s+\d*\.?\d+(?:[eE][+-]?\d+)?\s+\d*\.?\d+(?:[eE][+-]?\d+)?\s*$/.test(value))throw authorError('author_color_invalid');
    const rgb=value.trim().split(/\s+/).map(Number);if(rgb.some(n=>!Number.isFinite(n)||n<0||n>1))throw authorError('author_color_invalid');return rgb.join(' ');
  }
  if(field.type==='textinput')return safeAuthorString(value);
  if(field.type==='combo'){
    if(!['string','boolean','number'].includes(typeof value)||typeof value==='number'&&(!Number.isFinite(value)||Math.abs(value)>AUTHOR_LIMITS.number))throw authorError('author_value_invalid');
    if(typeof value==='string')safeAuthorString(value,128);
    if(!Array.isArray(field.options)||!field.options.some(o=>Object.is(o.value,value)))throw authorError('author_option_invalid');return value;
  }
  throw authorError('author_field_unsupported');
}

function validateAuthorValues(schema,values,{partial=false}={}){
  if(!plain(values)||!Array.isArray(schema?.fields)||schema.fields.length>AUTHOR_LIMITS.fields)throw authorError('author_values_invalid');
  const fields=new Map(schema.fields.filter(f=>f.supported===true).map(f=>[f.key,f]));const keys=Object.keys(values);
  if(keys.length>AUTHOR_LIMITS.fields||!partial&&keys.length!==fields.size)throw authorError('author_values_invalid');
  const result=Object.create(null);
  for(const key of keys){if(!isAuthorKey(key)||!fields.has(key))throw authorError('author_key_invalid');result[key]=validateAuthorValue(fields.get(key),values[key]);}
  if(!partial&&[...fields.keys()].some(key=>!Object.hasOwn(result,key)))throw authorError('author_values_invalid');return result;
}

function authorDefaults(schema){const values=Object.create(null);for(const field of schema.fields??[])if(field.supported)values[field.key]=validateAuthorValue(field,field.defaultValue);return values;}

/** A preview only. P0 contains no executable/path or IO adapter. Location can never be omitted. */
function planAuthorProperties(schema,values,lifecycle){
  if(!isSceneId(schema?.wallpaperId)||!isAuthorFingerprint(schema?.fingerprint)||!lifecycle||lifecycle.activeSceneId!==schema.wallpaperId||lifecycle.cleanupPending||lifecycle.busy||!Number.isSafeInteger(lifecycle.generation)||lifecycle.generation<0)throw authorError('author_target_inactive');
  const location=validateLocation(lifecycle.location),validated=validateAuthorValues(schema,values,{partial:true});
  if(!Object.keys(validated).length)throw authorError('author_no_fields');
  const json=JSON.stringify(validated);if(json.length>AUTHOR_LIMITS.bodyBytes||json.includes(')~END')||json.includes('RAW~('))throw authorError('author_plan_invalid');
  return {planOnly:true,executed:false,wallpaperId:schema.wallpaperId,schemaFingerprint:schema.fingerprint,generation:lifecycle.generation,location,args:['-control','applyProperties','-properties',`RAW~(${json})~END`,'-location',location]};
}

/** Ephemeral per-wallpaper form state; response tickets and revisions prevent late A overwriting B. */
function createAuthorFormModel({maxDrafts=16}={}){
  if(!Number.isInteger(maxDrafts)||maxDrafts<1||maxDrafts>AUTHOR_LIMITS.drafts)throw authorError('author_limit_invalid');
  const drafts=new Map();let selectedId=null,sequence=0;
  const copy=value=>JSON.parse(JSON.stringify(value));
  return {
    select(id){if(!isSceneId(id))throw authorError('author_id_invalid');selectedId=id;sequence++;return this.ticket();},
    ticket(){sequence++;return {wallpaperId:selectedId,sequence};},
    accept(ticket,response){
      if(ticket?.sequence!==sequence||ticket.wallpaperId!==selectedId||response?.schema?.wallpaperId!==selectedId)return false;
      const {schema,draft}=response;if(schema.schemaVersion!==AUTHOR_SCHEMA_VERSION||!isAuthorFingerprint(schema.fingerprint)||!Number.isSafeInteger(draft?.revision)||draft.revision<0)throw authorError('author_response_invalid');
      const prior=drafts.get(selectedId);if(prior&&draft.revision<prior.draft.revision)return false;
      if(!prior&&drafts.size>=maxDrafts)throw authorError('author_draft_limit');
      let values=draft.stale?null:validateAuthorValues(schema,draft.values);const dirtyKeys=Array.isArray(draft.dirtyKeys)?draft.dirtyKeys:[];if(dirtyKeys.length>AUTHOR_LIMITS.fields||dirtyKeys.some(key=>!isAuthorKey(key)||!schema.fields.some(f=>f.supported&&f.key===key)))throw authorError('author_response_invalid');
      let pending={},stale=draft.stale===true;
      if(prior&&response.mutation!=='reset'){
        if(Object.keys(prior.pending).length&&(stale||prior.schema.fingerprint!==schema.fingerprint)){pending=copy(prior.pending);stale=true;values=null;}
        else if(values!==null){for(const[key,value]of Object.entries(prior.pending))if(!Object.is(values[key],value)){pending[key]=validateAuthorValue(schema.fields.find(f=>f.key===key),value);values[key]=value;}}
      }
      drafts.set(selectedId,{schema:copy(schema),draft:{revision:draft.revision,stale,values:values===null?null:copy(values),dirtyKeys:[...dirtyKeys]},pending});return true;
    },
    edit(patch){const current=drafts.get(selectedId);if(!current||current.draft.stale)throw authorError('author_schema_stale');const values=validateAuthorValues(current.schema,patch,{partial:true});current.draft.values={...current.draft.values,...values};current.pending={...current.pending,...values};sequence++;return this.snapshot();},
    request(){const current=drafts.get(selectedId);if(!current||current.draft.stale)throw authorError('author_schema_stale');if(!Object.keys(current.pending).length)throw authorError('author_no_changes');return{wallpaperId:selectedId,schemaFingerprint:current.schema.fingerprint,expectedRevision:current.draft.revision,values:copy(current.pending)};},
    planRequest(){const current=drafts.get(selectedId);if(!current||current.draft.stale||Object.keys(current.pending).length)throw authorError('author_schema_stale');return{wallpaperId:selectedId,schemaFingerprint:current.schema.fingerprint,expectedRevision:current.draft.revision};},
    resetRequest(){const current=drafts.get(selectedId);if(!current)throw authorError('author_schema_stale');return{wallpaperId:selectedId,schemaFingerprint:current.schema.fingerprint,expectedRevision:current.draft.revision,action:'reset'};},
    snapshot(){const current=drafts.get(selectedId);return current?copy({wallpaperId:selectedId,...current}):null;},
    clear(){drafts.clear();selectedId=null;sequence++;},
  };
}


// One DOM form for the docked React mount and the standalone window. No HTML from authors.
// Palette/type inherit the existing appearance panel; sections explain the selected wallpaper.
function createAuthorPanel({root,request,documentObj=root?.ownerDocument,timeoutMs=4000}={}) {
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

return {createAuthorPanel,validateAuthorValue};
    })();
    /* WM_AUTHOR_PANEL_END */

    /* WM_FRAME_PROTOCOL */
      const HEADER_BYTES = 24;
      const MAX_FRAME_BYTES = 8 * 1024 * 1024;

      class WM_FRAME_DECODER {
        constructor(onFrame) { this.onFrame = onFrame; this.pending = new Uint8Array(0); }
        push(chunk) {
          if (!(chunk instanceof Uint8Array)) throw new TypeError('Expected byte buffer');
          if (chunk.byteLength > 32 * 1024 * 1024) throw new Error('Oversized input chunk');
          let bytes = chunk;
          if (this.pending.byteLength) {
            bytes = new Uint8Array(this.pending.byteLength + chunk.byteLength);
            bytes.set(this.pending); bytes.set(chunk, this.pending.byteLength);
          }
          let offset = 0;
          while (bytes.byteLength - offset >= HEADER_BYTES) {
            const view = new DataView(bytes.buffer, bytes.byteOffset + offset, HEADER_BYTES);
            if (view.getUint32(0, false) !== 0x57484c31) throw new Error('Invalid WHL1 frame magic');
            const length = view.getUint32(8, true);
            const width = view.getUint16(20, true), height = view.getUint16(22, true);
            const capturedAt = Number(view.getBigInt64(12, true));
            if (!length || length > MAX_FRAME_BYTES || !width || !height || width > 16384 || height > 16384 || !Number.isSafeInteger(capturedAt) || capturedAt <= 0)
              throw new Error('Invalid frame bounds');
            if (bytes.byteLength - offset < HEADER_BYTES + length) break;
            const packet = bytes.subarray(offset, offset + HEADER_BYTES + length);
            this.onFrame({ sequence: view.getUint32(4, true), capturedAt, width, height,
              packet, jpeg: packet.subarray(HEADER_BYTES) });
            offset += HEADER_BYTES + length;
          }
          this.pending = bytes.slice(offset);
        }
        finish() { if (this.pending.byteLength) throw new Error('Truncated frame stream'); }
      }
      /* WM_FRAME_PROTOCOL_END */

    const THEME_ID = "whale-mist";
    const ABYSS_THEME_ID = "whale-abyss";
    const ACTIVE_CLASS = "dsh-whale-mist-active";
    const ABYSS_ACTIVE_CLASS = "dsh-whale-abyss-active";
    const THEME_IDS = Object.freeze({ mist: THEME_ID, abyss: ABYSS_THEME_ID });
    const MANAGED_THEME_IDS = new Set(Object.values(THEME_IDS));
    const STYLE_ID = "dsh-whale-mist/theme.css";
    // Keep the v1 key: new fields are additive and normalizeSettings fills
    // defaults, so existing theme choices survive the upgrade.
    const STORAGE_KEY = "dsh-whale-mist.appearance.v1";
    const DEFAULT_SETTINGS = Object.freeze({
      theme: "abyss",
      palette: "ocean",
      accentMode: "theme",
      accentColor: "#8c72f2",
      canvas: "soft",
      sidebar: "balanced",
      glass: "standard",
      textContrast: "standard",
      background: "none",
      motion: "focus",
      weScene: "lucy",
      weMode: "preview",
      weAutoStart: false,
      weAgeRatings: "Everyone",
      // Per-region backgrounds: which areas may cover the wallpaper with their own colour. Both
      // default to off, so the visual result stays exactly what the previous release shipped.
      opaqueSidebar: false,
      opaqueChat: false,
      chatBackdrop: 0,
      brightness: 70,
      mask: 45,
      blur: 0,
      surface: 82
    });
    const ALLOWED_SETTINGS = Object.freeze({
      theme: Object.freeze(["mist", "abyss"]),
      palette: Object.freeze(["ocean", "graphite", "violet", "jade"]),
      accentMode: Object.freeze(["theme", "custom"]),
      canvas: Object.freeze(["soft", "clear"]),
      sidebar: Object.freeze(["balanced", "deep"]),
      glass: Object.freeze(["standard", "restrained"]),
      textContrast: Object.freeze(["standard", "enhanced"]),
      background: Object.freeze(["none", "image", "video", "wallpaper"]),
      motion: Object.freeze(["focus", "always"]),
      /** `daily` is the daily-driver mode; `preview` is the supervised time-boxed one. */
      weMode: Object.freeze(["daily", "preview"])
    });
    /**
     * Strict 6-digit hex color format.
     */
    const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
    /**
     * Scene ids come from the Host whitelist; a stale stored value falls back to Lucy.
     *
     * This list is only the set of ids with a supervised acceptance behind them, so it decides what
     * may be called "verified". Every other id the Host can resolve is an experimental selection and
     * never part of it.
     */
    const VERIFIED_SCENE_IDS = Object.freeze(["lucy"]);
    /**
     * The shape of a catalogue id, mirrored from the Host rules so a stored selection survives a
     * reload before the list has loaded. This is only a syntax check: whether the item still exists
     * and is playable is decided by the Host, which is the only side allowed to look at files.
     */
    const CATALOG_ID_PATTERN = /^we-[0-9a-f]{24}$/;
    const isSceneId = (value) => value === "lucy" || (typeof value === "string" && CATALOG_ID_PATTERN.test(value));
    /**
     * The migration default, matching the Host (`DEFAULT_PLAYBACK_MODE = 'preview'`): an older
     * stored setting that predates the mode field stays a time-boxed preview until the user
     * explicitly picks the daily mode.
     */
    const DEFAULT_PLAYBACK_MODE = "preview";
    const RANGE_SETTINGS = Object.freeze({
      brightness: Object.freeze([20, 120]),
      mask: Object.freeze([0, 90]),
      blur: Object.freeze([0, 24]),
      surface: Object.freeze([40, 100]),
      chatBackdrop: Object.freeze([0, 100])
    });

    function clampRange(key, value) {
      const [min, max] = RANGE_SETTINGS[key];
      return typeof value === "number" && Number.isFinite(value)
        ? Math.round(Math.min(max, Math.max(min, value)))
        : DEFAULT_SETTINGS[key];
    }

    /**
     * Settings that are strictly boolean: anything that is not an explicit `true` reads as false, so
     * an older stored value (the field did not exist) and a corrupt one (a string or a number) both
     * land on the off state instead of switching a region on by accident.
     */
    const BOOLEAN_SETTINGS = Object.freeze(["weAutoStart", "opaqueSidebar", "opaqueChat"]);

    function isValidSetting(key, value) {
      if (key === "weScene") return isSceneId(value);
      if (key === "accentColor") return typeof value === "string" && HEX_COLOR_PATTERN.test(value);
      if (key === "weAgeRatings") {
        if (typeof value !== "string") return false;
        if (value.trim() === "") return true;
        const parts = value.split(",").map(s => s.trim()).filter(Boolean);
        return parts.length > 0 && parts.every(p => ["Everyone", "Questionable", "Mature"].includes(p));
      }
      if (Object.hasOwn(ALLOWED_SETTINGS, key)) return ALLOWED_SETTINGS[key].includes(value);
      if (BOOLEAN_SETTINGS.includes(key)) return typeof value === "boolean";
      return Object.hasOwn(RANGE_SETTINGS, key) && typeof value === "number" && Number.isFinite(value);
    }

    function normalizeSettings(value) {
      const source = value && typeof value === "object" ? value : {};
      let chatBackdrop;
      if (typeof source.chatBackdrop === "number" && Number.isFinite(source.chatBackdrop)) {
        chatBackdrop = clampRange("chatBackdrop", source.chatBackdrop);
      } else {
        chatBackdrop = source.opaqueChat === true ? 100 : 0;
      }
      const opaqueChat = chatBackdrop === 100;

      let accentColor = DEFAULT_SETTINGS.accentColor;
      let hasValidColor = false;
      if (typeof source.accentColor === "string" && HEX_COLOR_PATTERN.test(source.accentColor)) {
        accentColor = source.accentColor.toLowerCase();
        hasValidColor = true;
      }

      let accentMode = DEFAULT_SETTINGS.accentMode;
      if (source.accentMode === "custom") {
        // Fall back to theme mode if custom is claimed without a valid color
        accentMode = hasValidColor ? "custom" : "theme";
      } else if (source.accentMode === "theme") {
        accentMode = "theme";
      }

      let weAgeRatings = DEFAULT_SETTINGS.weAgeRatings;
      if (typeof source.weAgeRatings === "string") {
        const trimmed = source.weAgeRatings.trim();
        if (trimmed === "") {
          weAgeRatings = "";
        } else {
          const parts = trimmed.split(",").map(s => s.trim()).filter(Boolean);
          const allValid = parts.length > 0 && parts.every(p => ["Everyone", "Questionable", "Mature"].includes(p));
          if (allValid) {
            const unique = [...new Set(parts)].sort((a, b) => ["Everyone", "Questionable", "Mature"].indexOf(a) - ["Everyone", "Questionable", "Mature"].indexOf(b));
            weAgeRatings = unique.join(",");
          } else {
            weAgeRatings = DEFAULT_SETTINGS.weAgeRatings;
          }
        }
      }

      return {
        ...Object.fromEntries(Object.entries(ALLOWED_SETTINGS).filter(([k]) => k !== "accentMode").map(([key, allowed]) => [
          key,
          allowed.includes(source[key]) ? source[key] : DEFAULT_SETTINGS[key]
        ])),
        ...Object.fromEntries(Object.keys(RANGE_SETTINGS).filter((k) => k !== "chatBackdrop").map((key) => [key, clampRange(key, source[key])])),
        accentMode,
        accentColor,
        chatBackdrop,
        weAgeRatings,
        // A well-formed catalogue id is kept even before the list has loaded: normalizing it away
        // would silently replace the user's wallpaper with the sample. The Host still refuses an id
        // it cannot re-verify, so this keeps the choice without granting it.
        weScene: isSceneId(source.weScene) ? source.weScene : DEFAULT_SETTINGS.weScene,
        // Opt-in flags: only an explicit boolean true turns one on.
        ...Object.fromEntries(BOOLEAN_SETTINGS.filter((k) => k !== "opaqueChat").map((key) => [key, source[key] === true])),
        opaqueChat
      };
    }

    function readSettings(onRead) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const result = normalizeSettings(JSON.parse(raw ?? "null"));
        onRead?.({ missing: raw === null });
        return result;
      } catch {
        return { ...DEFAULT_SETTINGS };
      }
    }

    function persistSettings(settings) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch {}
    }

    const PRESETS_STORAGE_KEY = "dsh-whale-mist.wallpaper-appearance-presets.v1";
    const PRESET_PROPERTIES = Object.freeze(["brightness", "mask", "blur", "surface"]);

    function sanitizePresetEntry(raw) {
      if (!raw || typeof raw !== "object") return null;
      const entry = {};
      for (const key of PRESET_PROPERTIES) {
        if (typeof raw[key] !== "number" || !Number.isFinite(raw[key])) return null;
        entry[key] = clampRange(key, raw[key]);
      }
      return Object.freeze(entry);
    }

    function normalizePresets(raw) {
      if (!raw || typeof raw !== "object" || raw.version !== 1 || !raw.entries || typeof raw.entries !== "object") {
        return Object.freeze({ version: 1, entries: Object.freeze({}) });
      }
      const entries = {};
      for (const [key, value] of Object.entries(raw.entries)) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
        if (!isSceneId(key)) continue;
        const sanitized = sanitizePresetEntry(value);
        if (sanitized) entries[key] = sanitized;
      }
      return Object.freeze({ version: 1, entries: Object.freeze(entries) });
    }

    function readPresets() {
      try {
        const raw = JSON.parse(localStorage.getItem(PRESETS_STORAGE_KEY) ?? "null");
        return normalizePresets(raw);
      } catch {
        return Object.freeze({ version: 1, entries: Object.freeze({}) });
      }
    }

    function persistPresets(presets) {
      try {
        localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
        return true;
      } catch {
        return false;
      }
    }

    const PROJECTED_VARIABLES = Object.freeze({
      brightness: ["--wm-bg-brightness", (value) => String(value / 100)],
      mask: ["--wm-bg-mask", (value) => String(value / 100)],
      blur: ["--wm-bg-blur", (value) => `${value}px`],
      surface: ["--wm-ui-alpha", (value) => String(value / 100)],
      chatBackdrop: ["--wm-chat-alpha", (value) => String(value / 100)]
    });
    /** Region switches are projected as body attributes, one per region. */
    const PROJECTED_FLAGS = Object.freeze({
      opaqueSidebar: "wmOpaqueSidebar"
    });

    // Dark palettes layered on top of Whale Abyss. `ocean` is the registered
    // Abyss token set itself, so the default look stays byte-for-byte as before.
    const PALETTES = Object.freeze({
      graphite: Object.freeze({
        base: [11, 11, 13], primary: [16, 16, 19], l1: [22, 22, 26], l2: [31, 31, 36], l3: [38, 38, 44],
        sidebar: [18, 18, 21], sidebarDeep: [12, 12, 14], border: [140, 143, 154],
        accent: [127, 156, 199], citation: "#a9bfdf", button: "#5d79a3", buttonHover: "#7190bd",
        glow: [127, 156, 199, 0.07], glow2: [120, 124, 136, 0.08]
      }),
      violet: Object.freeze({
        base: [13, 9, 18], primary: [18, 13, 26], l1: [25, 18, 37], l2: [35, 25, 50], l3: [42, 31, 59],
        sidebar: [21, 15, 31], sidebarDeep: [14, 10, 21], border: [156, 134, 186],
        accent: [176, 124, 240], citation: "#c9a4ff", button: "#8853d0", buttonHover: "#9c6be0",
        glow: [176, 104, 232, 0.15], glow2: [214, 92, 168, 0.08]
      }),
      jade: Object.freeze({
        base: [7, 16, 13], primary: [10, 21, 18], l1: [14, 29, 24], l2: [20, 39, 33], l3: [26, 47, 40],
        sidebar: [12, 25, 21], sidebarDeep: [8, 17, 14], border: [122, 168, 152],
        accent: [86, 199, 157], citation: "#7fdcb6", button: "#2c8a6b", buttonHover: "#37a07e",
        glow: [72, 190, 146, 0.1], glow2: [64, 132, 151, 0.1]
      })
    });
    const PALETTE_SWATCHES = Object.freeze({
      ocean: ["#0b111d", "#8c72f2"],
      graphite: ["#16161a", "#7f9cc7"],
      violet: ["#19121f", "#b07cf0"],
      jade: ["#0e1d18", "#56c79d"]
    });

    const rgb = (color, alpha) => alpha === undefined
      ? `rgb(${color.join(" ")})`
      : `rgb(${color.join(" ")} / ${alpha})`;
    const mix = (a, b, weight = 0.5) => a.map((value, index) => Math.round(value * (1 - weight) + b[index] * weight));
    const scale = (color, factor) => color.map((value) => Math.round(value * factor));

    const CUSTOM_ACCENT_VARIABLES = Object.freeze([
      "--wm-custom-raw",
      "--wm-custom-btn-hover",
      "--wm-custom-btn-fg",
      "--wm-custom-ink",
      "--wm-custom-business-tertiary",
      "--wm-custom-btn-info-fill",
      "--wm-custom-btn-info-hover",
      "--wm-custom-ghost-active-fill",
      "--wm-custom-interactive-primary",
      "--wm-custom-interactive-hover",
      "--wm-custom-interactive-active",
      "--wm-custom-sidebar-nav-active"
    ]);

    function hexToRgb(hex) {
      const num = parseInt(hex.slice(1), 16);
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }
    function rgbToHex(rgbArray) {
      return "#" + rgbArray.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("");
    }
    function srgbToLinear(val255) {
      const v = val255 / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    function relativeLuminance(rgbArray) {
      return 0.2126 * srgbToLinear(rgbArray[0]) + 0.7152 * srgbToLinear(rgbArray[1]) + 0.0722 * srgbToLinear(rgbArray[2]);
    }
    function contrastRatio(rgb1, rgb2) {
      const l1 = relativeLuminance(rgb1);
      const l2 = relativeLuminance(rgb2);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }

    function deriveButtonForeground(rawRgb) {
      const ratioBlack = contrastRatio(rawRgb, [0, 0, 0]);
      const ratioWhite = contrastRatio(rawRgb, [255, 255, 255]);
      return ratioBlack >= ratioWhite ? "#000000" : "#ffffff";
    }

    function deriveButtonHover(rawRgb, fgHex) {
      const fgRgb = fgHex === "#000000" ? [0, 0, 0] : [255, 255, 255];
      const oppRgb = fgHex === "#000000" ? [255, 255, 255] : [0, 0, 0];
      const h1 = rawRgb.map((c, i) => Math.round(c * 0.88 + fgRgb[i] * 0.12));
      if (contrastRatio(h1, fgRgb) >= 4.5) {
        return rgbToHex(h1);
      }
      const h2 = rawRgb.map((c, i) => Math.round(c * 0.88 + oppRgb[i] * 0.12));
      return rgbToHex(h2);
    }

    function getReferenceSurfaces(theme, palette) {
      if (theme === "mist") {
        return [
          [239, 247, 254],
          [255, 255, 255],
          [230, 242, 251],
          [252, 254, 255],
          [228, 240, 249],
          [207, 229, 246]
        ];
      }
      const p = PALETTES[palette];
      if (p) {
        return [
          p.base,
          p.l1,
          p.l2,
          p.l3,
          p.sidebar,
          p.sidebarDeep
        ];
      }
      return [
        [8, 11, 20],
        [15, 23, 38],
        [23, 34, 54],
        [28, 40, 62],
        [15, 23, 38],
        [10, 16, 28]
      ];
    }

    function deriveInkColor(rawRgb, theme, palette) {
      const surfaces = getReferenceSurfaces(theme, palette);
      const satisfies = (rgbArray) => {
        for (let i = 0; i < surfaces.length; i++) {
          if (contrastRatio(rgbArray, surfaces[i]) < 4.5) return false;
        }
        return true;
      };
      if (satisfies(rawRgb)) {
        return rgbToHex(rawRgb);
      }
      const target = theme === "mist" ? [0, 0, 0] : [255, 255, 255];
      for (let k = 1; k <= 255; k++) {
        const factor = k / 255;
        const cand = [
          Math.round(rawRgb[0] * (1 - factor) + target[0] * factor),
          Math.round(rawRgb[1] * (1 - factor) + target[1] * factor),
          Math.round(rawRgb[2] * (1 - factor) + target[2] * factor)
        ];
        if (satisfies(cand)) {
          return rgbToHex(cand);
        }
      }
      return rgbToHex(target);
    }

    function deriveAccentValues(accentColor, theme, palette) {
      const rawRgb = hexToRgb(accentColor);
      const raw = accentColor.toLowerCase();
      const btnFg = deriveButtonForeground(rawRgb);
      const btnHover = deriveButtonHover(rawRgb, btnFg);
      const ink = deriveInkColor(rawRgb, theme, palette);
      return {
        raw,
        btnHover,
        btnFg,
        ink,
        businessTertiary: `rgba(${rawRgb.join(", ")}, 0.2)`,
        btnInfoFill: `rgba(${rawRgb.join(", ")}, 0.18)`,
        btnInfoHover: `rgba(${rawRgb.join(", ")}, 0.26)`,
        ghostActiveFill: `rgba(${rawRgb.join(", ")}, 0.2)`,
        interactivePrimary: `rgba(${rawRgb.join(", ")}, 0.16)`,
        interactiveHover: `rgba(${rawRgb.join(", ")}, 0.12)`,
        interactiveActive: `rgba(${rawRgb.join(", ")}, 0.2)`,
        sidebarNavActive: `rgba(${rawRgb.join(", ")}, 0.16)`
      };
    }

    function projectSettings(settings) {
      const body = document.body;
      body.dataset.wmTheme = settings.theme;
      body.dataset.wmPalette = settings.palette;
      body.dataset.wmCanvas = settings.canvas;
      body.dataset.wmSidebar = settings.sidebar;
      body.dataset.wmGlass = settings.glass;
      body.dataset.wmTextContrast = settings.textContrast;
      body.dataset.wmAccentMode = settings.accentMode;
      for (const [key, name] of Object.entries(PROJECTED_FLAGS)) {
        if (settings[key]) body.dataset[name] = "true";
        else delete body.dataset[name];
      }
      if (settings.chatBackdrop === 100) {
        body.dataset.wmOpaqueChat = "true";
        delete body.dataset.wmChatTint;
      } else if (settings.chatBackdrop > 0) {
        delete body.dataset.wmOpaqueChat;
        body.dataset.wmChatTint = "true";
      } else {
        delete body.dataset.wmOpaqueChat;
        delete body.dataset.wmChatTint;
      }
      for (const [key, [name, format]] of Object.entries(PROJECTED_VARIABLES)) {
        body.style.setProperty(name, format(settings[key]));
      }
      if (settings.accentMode === "custom") {
        const derived = deriveAccentValues(settings.accentColor, settings.theme, settings.palette);
        body.style.setProperty("--wm-custom-raw", derived.raw);
        body.style.setProperty("--wm-custom-btn-hover", derived.btnHover);
        body.style.setProperty("--wm-custom-btn-fg", derived.btnFg);
        body.style.setProperty("--wm-custom-ink", derived.ink);
        body.style.setProperty("--wm-custom-business-tertiary", derived.businessTertiary);
        body.style.setProperty("--wm-custom-btn-info-fill", derived.btnInfoFill);
        body.style.setProperty("--wm-custom-btn-info-hover", derived.btnInfoHover);
        body.style.setProperty("--wm-custom-ghost-active-fill", derived.ghostActiveFill);
        body.style.setProperty("--wm-custom-interactive-primary", derived.interactivePrimary);
        body.style.setProperty("--wm-custom-interactive-hover", derived.interactiveHover);
        body.style.setProperty("--wm-custom-interactive-active", derived.interactiveActive);
        body.style.setProperty("--wm-custom-sidebar-nav-active", derived.sidebarNavActive);
      } else {
        for (const prop of CUSTOM_ACCENT_VARIABLES) {
          body.style.removeProperty(prop);
        }
      }
    }

    function clearProjection() {
      const body = document.body;
      for (const key of ["wmTheme", "wmPalette", "wmCanvas", "wmSidebar", "wmGlass", "wmTextContrast", "wmAccentMode", "wmOpaqueChat", "wmChatTint"]) delete body.dataset[key];
      for (const name of Object.values(PROJECTED_FLAGS)) delete body.dataset[name];
      for (const [name] of Object.values(PROJECTED_VARIABLES)) body.style.removeProperty(name);
      for (const prop of CUSTOM_ACCENT_VARIABLES) body.style.removeProperty(prop);
    }

    function paletteCss(id, p) {
      const s = `body.${ABYSS_ACTIVE_CLASS}[data-wm-palette="${id}"]`;
      const mid = mix(p.l1, p.l2);
      const deepBase = scale(p.base, 0.86);
      return `
      ${s} {
        --wm-base-rgb: ${p.base.join(" ")};
        --wm-sidebar-rgb: ${p.sidebar.join(" ")};
        --wm-layer1-rgb: ${p.l1.join(" ")};
        --wm-layer2-rgb: ${p.l2.join(" ")};
        --wm-layer3-rgb: ${p.l3.join(" ")};
        --wm-accent-rgb: ${p.accent.join(" ")};
        --dsw-alias-bg-base: ${rgb(p.base)} !important;
        --dsw-alias-bg-primary: ${rgb(p.primary)} !important;
        --dsw-alias-bg-layer-1: ${rgb(p.l1, 0.94)} !important;
        --dsw-alias-bg-layer-2: ${rgb(p.l2, 0.92)} !important;
        --dsw-alias-bg-layer-3: ${rgb(p.l3, 0.96)} !important;
        --dsw-alias-bg-overlay: ${rgb(p.l2, 0.98)} !important;
        --dsw-alias-bg-module-platform: ${rgb(mid, 0.9)} !important;
        --dsw-alias-border-l2: ${rgb(p.border, 0.16)} !important;
        --dsw-alias-border-l2-darkmode-thin: ${rgb(p.border, 0.13)} !important;
        --dsw-alias-border-l3: ${rgb(p.border, 0.23)} !important;
        --dsw-alias-border-l4: ${rgb(p.border, 0.32)} !important;
        --dsw-alias-border-secondary: ${rgb(p.border, 0.18)} !important;
        --dsw-alias-line-secondary: ${rgb(p.border, 0.13)} !important;
        --dsw-alias-separator-primary: ${rgb(p.border, 0.12)} !important;
        --dsw-alias-brand-primary: ${rgb(p.accent)} !important;
        --dsw-alias-brand-primary-new-colorprimary-new-color: ${rgb(p.accent)} !important;
        --dsw-alias-button-primary-fill: ${p.button} !important;
        --dsw-alias-button-primary-hover: ${p.buttonHover} !important;
        --dsw-alias-button-info-fill: ${rgb(p.accent, 0.18)} !important;
        --dsw-alias-button-info-hover: ${rgb(p.accent, 0.26)} !important;
        --dsw-alias-button-elevated-fill: ${rgb(p.l3, 0.92)} !important;
        --dsw-alias-button-floating-fill: ${rgb(p.l2, 0.96)} !important;
        --dsw-alias-button-floating-hover: ${rgb(p.l3, 0.98)} !important;
        --dsw-alias-button-ghost-active-fill: ${rgb(p.accent, 0.2)} !important;
        --dsw-alias-interactive-bg-primary: ${rgb(p.accent, 0.16)} !important;
        --dsw-alias-interactive-bg-active: ${rgb(p.accent, 0.2)} !important;
        --dsw-alias-interactive-bg-hover-solid: ${rgb(mix(p.l2, p.l3))} !important;
        --dsw-alias-fill-l2: ${rgb(p.border, 0.16)} !important;
        --dsw-alias-scrollbar-bg-l2: ${rgb(p.border, 0.28)} !important;
        --dsw-alias-scrollbar-hover-l2: ${rgb(p.border, 0.42)} !important;
        --dsw-alias-markdown-citation: ${p.citation} !important;
        --dsw-alias-markdown-code-block: ${rgb(scale(p.primary, 0.92), 0.94)} !important;
        --dsw-alias-markdown-code-block-banner: ${rgb(mid, 0.98)} !important;
        --dsw-alias-state-business-primary: ${p.citation} !important;
        --dsw-alias-state-business-tertiary: ${rgb(p.accent, 0.2)} !important;
        --dsw-specific-sidebar-fill: ${rgb(p.sidebar, 0.94)} !important;
        --dsw-specific-sidebar-nav-item-active: ${rgb(p.accent, 0.16)} !important;
        --dsw-specific-sidebar-nav-item-active-accent: ${rgb(p.accent)} !important;
        --dsw-specific-input-major: linear-gradient(180deg, ${rgb(p.l2)} 0%, ${rgb(mid)} 100%) !important;
        --dsw-specific-bubble: ${rgb(scale(p.accent, 0.5), 0.46)} !important;
        --dsw-specific-menu: ${rgb(mid, 0.98)} !important;
        --dsw-specific-selector: ${rgb(p.l3, 0.94)} !important;
        --dsw-specific-tip: ${rgb(p.l2, 0.96)} !important;
        background:
          radial-gradient(60rem 38rem at 82% -14%, ${rgb(p.glow.slice(0, 3), p.glow[3])} 0%, transparent 66%),
          radial-gradient(46rem 34rem at -12% 78%, ${rgb(p.glow2.slice(0, 3), p.glow2[3])} 0%, transparent 72%),
          linear-gradient(145deg, ${rgb(p.primary)} 0%, ${rgb(p.base)} 52%, ${rgb(deepBase)} 100%);
      }

      ${s}::before {
        background: linear-gradient(108deg, ${rgb(p.border, 0.025)}, transparent 38%, ${rgb(p.accent, 0.035)});
      }

      ${s}[data-wm-canvas="clear"] {
        --dsw-alias-bg-base: ${rgb(p.base)} !important;
        --dsw-alias-bg-layer-1: ${rgb(p.l1)} !important;
        --dsw-alias-bg-layer-2: ${rgb(p.l2)} !important;
        background:
          radial-gradient(58rem 36rem at 84% -16%, ${rgb(p.glow.slice(0, 3), p.glow[3] * 0.7)} 0%, transparent 68%),
          linear-gradient(145deg, ${rgb(mix(p.primary, p.l1, 0.2))} 0%, ${rgb(p.base)} 58%, ${rgb(deepBase)} 100%);
      }

      ${s}[data-wm-sidebar="deep"] {
        --wm-sidebar-rgb: ${p.sidebarDeep.join(" ")};
        --dsw-specific-sidebar-fill: ${rgb(p.sidebarDeep, 0.98)} !important;
        --dsw-specific-sidebar-nav-item-active: ${rgb(p.accent, 0.18)} !important;
      }

      ${s}[data-wm-glass="restrained"] {
        --dsw-alias-bg-layer-1: ${rgb(p.l1, 0.985)} !important;
        --dsw-alias-bg-layer-2: ${rgb(p.l2, 0.985)} !important;
        --dsw-alias-bg-layer-3: ${rgb(p.l3, 0.99)} !important;
        --dsw-alias-bg-overlay: ${rgb(p.l2)} !important;
        --dsw-specific-menu: ${rgb(mid)} !important;
        --dsw-specific-selector: ${rgb(p.l3)} !important;
        --dsw-mask-blur: blur(12px) saturate(106%) !important;
      }

      ${s} .wm-session-status {
        background: ${rgb(mid, 0.9)};
      }

      @media (prefers-reduced-transparency: reduce) {
        ${s},
        ${s}[data-wm-glass] {
          --dsw-alias-bg-layer-1: ${rgb(p.l1)} !important;
          --dsw-alias-bg-layer-2: ${rgb(p.l2)} !important;
          --dsw-alias-bg-overlay: ${rgb(p.l2)} !important;
          --dsw-specific-sidebar-fill: ${rgb(p.l1)} !important;
          --dsw-specific-input-major: ${rgb(p.l2)} !important;
          --dsw-specific-menu: ${rgb(mid)} !important;
          --dsw-mask-blur: none !important;
        }
      }

      @media (prefers-contrast: more) {
        ${s} {
          --dsw-alias-border-l2: ${rgb(p.border, 0.38)} !important;
          --dsw-alias-border-l3: ${rgb(p.border, 0.52)} !important;
          --dsw-alias-bg-layer-1: ${rgb(p.l1, 0.99)} !important;
        }
      }
      `;
    }

    // User-picked wallpapers live in this origin's IndexedDB. The plugin never
    // receives a filesystem path and the Host exposes no file route, so a
    // stored Blob is the only thing the background layer can ever read.
    const MEDIA_DB = "dsh-whale-mist.media";
    const MEDIA_STORE = "backgrounds";
    const MEDIA_LIMITS = Object.freeze({ image: 64 * 1024 * 1024, video: 1024 * 1024 * 1024 });

    function openMediaDb() {
      return new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") {
          reject(new Error("IndexedDB unavailable"));
          return;
        }
        const request = indexedDB.open(MEDIA_DB, 1);
        let blocked = false;
        request.onupgradeneeded = () => request.result.createObjectStore(MEDIA_STORE);
        request.onsuccess = () => {
          if (blocked) { request.result.close(); return; }
          request.result.onversionchange = () => request.result.close();
          resolve(request.result);
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () => { blocked = true; reject(new Error("IndexedDB blocked")); };
      });
    }

    async function mediaTransaction(mode, run) {
      const db = await openMediaDb();
      try {
        return await new Promise((resolve, reject) => {
          const transaction = db.transaction(MEDIA_STORE, mode);
          const request = run(transaction.objectStore(MEDIA_STORE));
          let result;
          request.onsuccess = () => { result = request.result; };
          transaction.oncomplete = () => resolve(result);
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
        });
      } finally {
        db.close();
      }
    }

    const readMedia = (kind) => mediaTransaction("readonly", (store) => store.get(kind));
    const writeMedia = (kind, record) => mediaTransaction("readwrite", (store) => store.put(record, kind));
    const deleteMedia = (kind) => mediaTransaction("readwrite", (store) => store.delete(kind));

    // Native local media edits retain separate DB keys, with bounded open and transaction.
    // A timed-out write keeps its physical writer lease until a terminal DB event.
    function changeMediaRecord(kind, record, { signal, isCurrent, timeoutMs, onSettled }) {
      return new Promise((resolve, reject) => {
        let request, db, transaction, done = false, terminal = false, timer;
        const current = () => { try { return !signal.aborted && isCurrent() === true; } catch { return false; } };
        const settle = () => { if (terminal) return; terminal = true; db?.close(); onSettled(); };
        const finish = (error, value) => {
          if (done) return; done = true; window.clearTimeout(timer); signal.removeEventListener("abort", cancel);
          error ? reject(error) : resolve(value);
        };
        const stop = error => {
          try { transaction?.abort(); } catch {}
          if (!transaction) settle();
          finish(Error(error));
        };
        const cancel = () => stop(`${kind}-cancelled`);
        timer = window.setTimeout(cancel, timeoutMs);
        signal.addEventListener("abort", cancel, { once: true });
        if (!current()) { cancel(); return; }
        try {
          request = indexedDB.open(MEDIA_DB, 1);
          request.onupgradeneeded = () => {
            if (done || !current()) { try { request.transaction.abort(); } catch {} return; }
            request.result.createObjectStore(MEDIA_STORE);
          };
          request.onblocked = request.onerror = () => { settle(); finish(Error(`${kind}-storage`)); };
          request.onsuccess = () => {
            db = request.result;
            if (done || !current()) { db.close(); settle(); finish(Error(`${kind}-cancelled`)); return; }
            db.onversionchange = () => { cancel(); db.close(); };
            try {
              transaction = db.transaction(MEDIA_STORE, record === undefined ? "readonly" : "readwrite");
              const store = transaction.objectStore(MEDIA_STORE), read = store.get(kind);
              let actual;
              transaction.oncomplete = () => { settle(); finish(null, actual); };
              transaction.onerror = transaction.onabort = () => { settle(); finish(Error(`${kind}-storage`)); };
              read.onsuccess = () => {
                if (!current()) { cancel(); return; }
                actual = record === undefined ? read.result : record;
                if (record !== undefined) {
                  try { record === null ? store.delete(kind) : store.put(record, kind); }
                  catch { stop(`${kind}-storage`); }
                }
              };
            } catch { settle(); finish(Error(`${kind}-storage`)); }
          };
        } catch { settle(); finish(Error(`${kind}-storage`)); }
      });
    }

    function validLocalMedia(kind, file) {
      return Object.hasOwn(MEDIA_LIMITS, kind) && file instanceof Blob && file.size > 0 && file.size <= MEDIA_LIMITS[kind]
        && (kind === "image" ? /^image\/(?:png|jpeg|webp|gif|bmp|avif)$/.test(file.type) : /^video\/(?:mp4|webm)$/.test(file.type));
    }

    function describeMedia(record) {
      return record && record.blob instanceof Blob
        ? { name: String(record.name || ""), size: record.blob.size, type: record.blob.type }
        : null;
    }

    /**
     * Wallpaper Engine preview transport.
     *
     * The Host owns the native window and the capture process; this side only sends
     * constrained actions (`start` / `stop` / `restart` plus a scene id) and reads the
     * authenticated frame stream. It never sends a path, a command or a window handle.
     */
    function createWallpaperEngine({ fetchImpl = (...args) => fetch(...args), now = () => Date.now(), monotonicNow, firstFrameTimeoutMs, idleTimeoutMs, retryDelayMs, hostStatusTimeoutMs } = {}) {
      const monoNow = typeof monotonicNow === "function"
        ? monotonicNow
        : (typeof performance !== "undefined" && typeof performance.now === "function" ? () => performance.now() : now);
      firstFrameTimeoutMs = firstFrameTimeoutMs ?? 20000;
      idleTimeoutMs = idleTimeoutMs ?? 8000;
      retryDelayMs = retryDelayMs ?? 400;
      hostStatusTimeoutMs = hostStatusTimeoutMs ?? 4000;
      const listeners = new Set();
      const statusListeners = new Set();
      const frameListeners = new Set();
      // Subscriptions of the layer: a stall (not a terminal state) hides the last frame
      // while the client keeps trying to recover.
      const stallListeners = new Set();
      const libraryListeners = new Set();
      let hideStalledFrames = false;
      let running = false;
      let busy = false;
      let disposed = false;
      let abort = null;
      let pollTimer = null;
      let status = Object.freeze({ state: "idle", error: "", host: null, generation: 0, cleanupPending: false });
      let stopRevision = 0;
      let activeStopId = 0;
      let activeStopGeneration = 0;
      let librarySnapshot = null;
      let libraryRevision = 0;
      let libraryRefreshing = false;
      let startedAt = 0;
      let lastFrameAt = 0;

      function createRunContext(gen) {
        return {
          generation: gen,
          metrics: { received: 0, rendered: 0, dropped: 0, sourceSequence: 0, decodeErrors: 0 },
          startedAt: 0,
          lastFrameAt: 0,
          hideStalledFrames: false,
          latencySum: 0,
          latencyMax: 0,
          waitRafCount: 0,
          waitRafSumMs: 0,
          waitRafMaxMs: 0,
          waitTimeoutCount: 0,
          waitTimeoutSumMs: 0,
          waitTimeoutMaxMs: 0,
          waitCancelledCount: 0,
          decodeSuccessCount: 0,
          decodeSuccessSumMs: 0,
          decodeSuccessMaxMs: 0,
          decodeFailCount: 0,
          decodeFailSumMs: 0,
          decodeFailMaxMs: 0,
          discardHiddenCount: 0,
          discardStaleCount: 0,
          syncCount: 0,
          syncSumMs: 0,
          syncMaxMs: 0,
          syncErrorCount: 0,
          drawCount: 0,
          drawSumMs: 0,
          drawMaxMs: 0,
          drawErrorCount: 0,
          dropDecodingCount: 0,
          dropSyncCount: 0,
          dropWaitingCallbackCount: 0,
          dropOtherCount: 0,
          painting: false,
          paintPhase: "idle",
          currentSchedule: null,
          latest: null,
        };
      }

      let activeRun = createRunContext(0);

      // Every start/stop/switch gets a new generation. Responses, decoded frames and
      // stream callbacks from an older generation can never change the current state,
      // so a late start reply cannot revive a run the user already stopped.
      let generation = 0;
      let lastCleanup = null;

      // Observations only: existing Host replies do not prove that every request has
      // drained. Keep all actual command calls (including stale-run compensation) in
      // one engine ledger. Nothing here authorizes changing the background preference.
      const closeStateListeners = new Set();
      const commandPending = new Map();
      let commandSequence = 0;
      let commandRevision = 0;
      let commandUncertain = false;
      let lastCommand = null;
      let closedObservation = null;
      let closeSnapshot = null;
      let closeSnapshotKey = "";
      const hostCloseListeners = new Set();
      let hostReadSequence = 0;
      let hostReadOwner = null;
      let acceptedHostClose = null;
      let hostCloseSnapshot = Object.freeze({ state: "unread", requestId: 0, host: null,
        error: null, sameRound: false, bothQuiescent: false, canCommit: false });
      let writeAdmission = null;
      let fenceOwner = null;
      let fenceRequest = null;
      let fenceEpoch = 0;
      let fenceSequence = 0;
      const fenceListeners = new Set();
      let fenceSnapshot = Object.freeze({ version: 1, state: "unprepared", requestId: 0,
        host: null, attempt: 0, sameRound: false, canCommit: false, error: null });
      const readCloseSnapshot = () => {
        const host = status.host;
        const active = running || busy || !["idle", "stopped"].includes(status.state)
          || host?.active === true || host?.activeSceneId != null || host?.session != null;
        const closedObserved = !disposed && !commandUncertain && !active
          && commandPending.size === 0 && !status.cleanupPending
          && activeStopId === 0 && activeStopGeneration === 0
          && closedObservation?.generation === generation;
        const state = disposed ? "disposed" : commandPending.size ? "pending"
          : commandUncertain ? "unknown" : closedObserved ? "closed-observed"
          : active && ["starting", "connecting", "playing", "waiting", "reconnecting"].includes(status.state) ? "active" : "unverified";
        const key = JSON.stringify([commandRevision, generation, state, closedObserved]);
        if (key !== closeSnapshotKey) {
          closeSnapshotKey = key;
          closeSnapshot = Object.freeze({
            version: 1, revision: commandRevision, generation, state,
            pendingCount: commandPending.size,
            pending: Object.freeze([...commandPending.values()]),
            uncertain: commandUncertain, lastCommand, closedObserved,
            canCommit: false, reason: "host-proof-unavailable",
          });
        }
        return closeSnapshot;
      };
      const publishCloseState = () => {
        const previous = closeSnapshot;
        const next = readCloseSnapshot();
        if (next !== previous) for (const listener of closeStateListeners) {
          try { listener(next); } catch {}
        }
        checkHostCloseValidity();
        checkFenceValidity();
      };

      function publishHostClose(state, job, host = null, error = null) {
        const localIdle = !disposed && !running && !busy && !commandUncertain && commandPending.size === 0
          && ["idle", "stopped"].includes(status.state) && !status.cleanupPending
          && activeStopId === 0 && activeStopGeneration === 0
          && status.host?.active !== true && status.host?.activeSceneId == null && status.host?.session == null;
        hostCloseSnapshot = Object.freeze({ state, requestId: job?.id ?? hostReadSequence, host, error,
          sameRound: state === "ready", bothQuiescent: state === "ready" && localIdle && host.quiescent,
          canCommit: false });
        for (const listener of hostCloseListeners) { try { listener(hostCloseSnapshot); } catch {} }
        return hostCloseSnapshot;
      }
      function hostCloseCurrent(job) {
        try { return !disposed && job.generation === generation && job.revision === commandRevision
          && job.status === status && job.isCurrent() === true; } catch { return false; }
      }
      function checkHostCloseValidity() {
        if (hostReadOwner && !hostCloseCurrent(hostReadOwner)) {
          hostReadOwner.cancel(disposed ? "host-read-disposed" : "host-read-stale");
        }
      }
      function getHostCloseSnapshot() { checkHostCloseValidity(); return hostCloseSnapshot; }

      function parseHostCloseState(raw) {
        const invalid = () => { throw new Error("host-read-invalid"); };
        const integer = (value, min = 0) => Number.isSafeInteger(value) && value >= min;
        const fields = ["version", "hostInstanceId", "revision", "generation", "cancelGeneration", "lifecycle",
          "state", "session", "pendingCount", "pending", "pendingTruncated", "ownership", "uncertain", "quiescent", "scope", "canCommit"];
        if (!raw || typeof raw !== "object" || Array.isArray(raw)
          || Object.keys(raw).length !== fields.length || !fields.every(key => Object.prototype.hasOwnProperty.call(raw, key))) invalid();
        if (raw.version !== 1 || typeof raw.hostInstanceId !== "string"
          || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(raw.hostInstanceId)
          || !integer(raw.revision) || !integer(raw.generation) || !integer(raw.cancelGeneration)
          || raw.cancelGeneration > raw.generation || !integer(raw.pendingCount)
          || !["active", "disposed"].includes(raw.lifecycle)
          || !["absent", "active", "closed", "unconfirmed", "unknown", "pending", "disposed"].includes(raw.state)
          || !["absent", "active", "closed", "unconfirmed", "unknown"].includes(raw.session)
          || ![null, "start", "stop"].includes(raw.ownership)
          || typeof raw.uncertain !== "boolean" || typeof raw.quiescent !== "boolean"
          || typeof raw.pendingTruncated !== "boolean" || raw.scope !== "arrived-operations" || raw.canCommit !== false
          || !Array.isArray(raw.pending) || raw.pending.length !== Math.min(16, raw.pendingCount)
          || raw.pendingTruncated !== (raw.pendingCount > 16)) invalid();
        let previousId = 0;
        const pending = raw.pending.map(item => {
          if (!item || typeof item !== "object" || Array.isArray(item)
            || Object.keys(item).length !== 3 || !["id", "kind", "generation"].every(key => Object.prototype.hasOwnProperty.call(item, key))
            || !integer(item.id, 1) || item.id <= previousId || !["start", "stop", "close"].includes(item.kind)
            || !integer(item.generation) || item.generation > raw.generation) invalid();
          previousId = item.id;
          return Object.freeze({ id: item.id, kind: item.kind, generation: item.generation });
        });
        if (raw.ownership !== null && (raw.pendingCount === 0
          || (!raw.pendingTruncated && !pending.some(item => item.kind === raw.ownership)))) invalid();
        if (raw.session === "unknown" && !raw.uncertain) invalid();
        const occupied = raw.pendingCount > 0 || raw.ownership !== null;
        const quiet = raw.lifecycle === "active" && !occupied && !raw.uncertain && ["absent", "closed"].includes(raw.session);
        const expected = raw.lifecycle === "disposed" ? "disposed" : occupied ? "pending" : raw.uncertain ? "unknown"
          : raw.session === "absent" ? raw.state : raw.session;
        if (raw.quiescent !== quiet || raw.state !== expected
          || (raw.lifecycle === "active" && !occupied && !raw.uncertain && raw.session === "absent" && !["absent", "closed"].includes(raw.state))) invalid();
        return Object.freeze({ ...Object.fromEntries(fields.map(key => [key, raw[key]])), pending: Object.freeze(pending) });
      }

      async function readHostCloseState(options = {}) {
        const early = error => Object.freeze({ ok: false, error, snapshot: getHostCloseSnapshot() });
        if (disposed) return early("host-read-disposed");
        if (!options || typeof options !== "object" || Array.isArray(options)) return early("host-read-invalid-options");
        let signal, timeoutMs, isCurrent;
        try {
          ({ signal, timeoutMs, isCurrent = () => true } = options);
          if ((timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) || typeof isCurrent !== "function"
            || (signal != null && (typeof signal.aborted !== "boolean" || typeof signal.addEventListener !== "function" || typeof signal.removeEventListener !== "function"))) return early("host-read-invalid-options");
        } catch { return early("host-read-invalid-options"); }
        if (typeof AbortController !== "function" || typeof TextDecoder !== "function") return early("host-read-unavailable");
        hostReadOwner?.cancel("host-read-superseded");
        const controller = new AbortController();
        const job = { id: ++hostReadSequence, generation, revision: commandRevision, status, isCurrent,
          pending: true, cancelled: null, cancelBody: null, timer: null };
        let rejectCancellation;
        const cancelled = new Promise((_, reject) => { rejectCancellation = reject; });
        cancelled.catch(() => {}); // Cancellation can occur during listener setup, before the race is attached.
        job.cancel = code => {
          if (job.cancelled) return;
          job.cancelled = code;
          controller.abort();
          job.cancelBody?.();
          if (job.pending) rejectCancellation(new Error(code));
          if (hostReadOwner === job) {
            hostReadOwner = null;
            publishHostClose(code === "host-read-disposed" ? "disposed" : code === "host-read-stale" ? "stale"
              : code === "host-read-aborted" ? "cancelled" : code === "host-read-superseded" ? "superseded" : "failed", job, null, code);
          }
        };
        hostReadOwner = job;
        const onAbort = () => job.cancel("host-read-aborted");
        const limit = Math.max(1, Math.min(4000, Number.isFinite(hostStatusTimeoutMs) && hostStatusTimeoutMs > 0 ? hostStatusTimeoutMs : 4000, timeoutMs ?? 4000));
        const read = async () => {
          if (job.cancelled) throw new Error(job.cancelled);
          const response = await fetchImpl("/whale-wallpaper/close-state", { method: "GET", cache: "no-store", signal: controller.signal });
          const cancelResponse = () => { try { Promise.resolve(response.body?.cancel()).catch(() => {}); } catch {} };
          if (job.cancelled) { cancelResponse(); throw new Error(job.cancelled); }
          if (response.ok !== true) { cancelResponse(); throw new Error([404, 405].includes(response.status) ? "host-read-unsupported" : "host-read-http"); }
          if (!response.body?.getReader) throw new Error("host-read-invalid");
          const reader = response.body.getReader();
          const cancelBody = () => { try { Promise.resolve(reader.cancel()).catch(() => {}); } catch {} };
          job.cancelBody = cancelBody;
          let bytes = 0, chunks = 0, text = "", complete = false;
          try {
            const decoder = new TextDecoder("utf-8", { fatal: true });
            while (true) {
              const chunk = await reader.read();
              if (job.cancelled) throw new Error(job.cancelled);
              if (chunk.done) break;
              if (++chunks > 8192) throw new Error("host-read-invalid");
              bytes += chunk.value.byteLength;
              if (bytes > 8192) throw new Error("host-read-invalid");
              text += decoder.decode(chunk.value, { stream: true });
            }
            text += decoder.decode();
            const host = parseHostCloseState(JSON.parse(text));
            complete = true;
            return host;
          } catch { throw new Error(job.cancelled ?? "host-read-invalid"); }
          finally { if (!complete && !job.cancelled) cancelBody(); job.cancelBody = null; try { reader.releaseLock(); } catch {} }
        };
        try {
          job.timer = window.setTimeout(() => job.cancel("host-read-timeout"), limit);
          try { if (signal) signal.addEventListener("abort", onAbort, { once: true }); }
          catch { throw new Error("host-read-invalid-options"); }
          publishHostClose("pending", job);
          if (signal?.aborted) onAbort();
          checkHostCloseValidity();
          const host = await Promise.race([read(), cancelled]);
          if (!hostCloseCurrent(job)) job.cancel(disposed ? "host-read-disposed" : "host-read-stale");
          if (job.cancelled) throw new Error(job.cancelled);
          if (acceptedHostClose) {
            const old = acceptedHostClose;
            if (host.hostInstanceId !== old.hostInstanceId) throw new Error("host-read-changed");
            if (host.revision < old.revision || host.generation < old.generation || host.cancelGeneration < old.cancelGeneration
              || (host.revision === old.revision && JSON.stringify(host) !== JSON.stringify(old))
              || (old.lifecycle === "disposed" && host.lifecycle !== "disposed")) throw new Error("host-read-regressed");
          }
          acceptedHostClose = host;
          const snapshot = publishHostClose("ready", job, host);
          // An observer may synchronously change the source or issue a command.
          if (!hostCloseCurrent(job)) job.cancel(disposed ? "host-read-disposed" : "host-read-stale");
          if (job.cancelled) throw new Error(job.cancelled);
          return Object.freeze({ ok: true, snapshot });
        } catch (error) {
          const known = ["host-read-timeout", "host-read-aborted", "host-read-superseded", "host-read-stale", "host-read-disposed", "host-read-invalid", "host-read-invalid-options", "host-read-http", "host-read-unsupported", "host-read-changed", "host-read-regressed"];
          const code = job.cancelled ?? (known.includes(error?.message) ? error.message : "host-read-failed");
          if (hostReadOwner === job) { hostReadOwner = null; publishHostClose("failed", job, null, code); }
          const snapshot = hostCloseSnapshot.requestId === job.id ? hostCloseSnapshot
            : Object.freeze({ state: "superseded", requestId: job.id, host: null, error: code, sameRound: false, bothQuiescent: false, canCommit: false });
          return Object.freeze({ ok: false, error: code, snapshot });
        } finally {
          job.pending = false;
          window.clearTimeout(job.timer);
          try { if (signal) signal.removeEventListener("abort", onAbort); } catch {}
        }
      }

      function fenceCurrent(job) {
        try { return !disposed && !job.cancelled && !job.signal?.aborted && job.isCurrent() === true
          && (!job.stamp || (job.stamp.generation === generation && job.stamp.epoch === fenceEpoch
            && (job.updatingStatus || job.stamp.status === status))); } catch { return false; }
      }
      function publishFence(state, job, host = null, error = null) {
        fenceSnapshot = Object.freeze({ version: 1, state, requestId: job?.id ?? fenceSequence,
          host, attempt: job?.packet?.attempt ?? 0, sameRound: ["ready", "released", "unconfirmed", "pending"].includes(state)
            && !!job && fenceCurrent(job), canCommit: false, error });
        for (const listener of fenceListeners) { try { listener(fenceSnapshot); } catch {} }
        return fenceSnapshot;
      }
      function checkFenceValidity() {
        if (fenceRequest && !fenceCurrent(fenceRequest)) fenceRequest.cancel(disposed ? "fence-disposed" : "fence-stale");
        else if (fenceOwner && fenceSnapshot.requestId === fenceOwner.id && !fenceCurrent(fenceOwner)
          && !["stale", "disposed", "unknown", "failed"].includes(fenceSnapshot.state)) {
          publishFence(disposed ? "disposed" : "stale", fenceOwner, null, disposed ? "fence-disposed" : "fence-stale");
        }
      }
      function verifyFenceHost(host) {
        if (!acceptedHostClose) return;
        const old = acceptedHostClose;
        if (host.hostInstanceId !== old.hostInstanceId) throw Error("fence-host-changed");
        if (host.revision < old.revision || host.generation < old.generation || host.cancelGeneration < old.cancelGeneration
          || (host.revision === old.revision && JSON.stringify(host) !== JSON.stringify(old))
          || (old.lifecycle === "disposed" && host.lifecycle !== "disposed")) throw Error("fence-host-regressed");
      }
      function parseFenceReply(raw, action, job) {
        const bad = () => { throw Error("fence-invalid"); };
        const shape = (value, fields) => value && typeof value === "object" && !Array.isArray(value)
          && Object.keys(value).length === fields.length && fields.every(key => Object.prototype.hasOwnProperty.call(value, key));
        const uuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
        if (!shape(raw, action === "activate" ? ["ok", "admission", "snapshot"] : ["ok", "snapshot"]) || raw.ok !== true) bad();
        const s = raw.snapshot;
        if (!shape(s, ["version", "hostInstanceId", "fenceId", "requestId", "attempt", "state", "close", "canCommit"])
          || s.version !== 1 || !uuid(s.hostInstanceId) || !uuid(s.fenceId) || !uuid(s.requestId)
          || s.canCommit !== false || !Number.isSafeInteger(s.attempt) || s.attempt < 1
          || !["pending", "ready", "unconfirmed", "unknown", "released", "disposed"].includes(s.state)
          || s.hostInstanceId !== job.body.hostInstanceId || s.requestId !== job.body.requestId
          || (job.ticket && s.fenceId !== job.ticket) || (job.packet && s.attempt < job.packet.attempt)
          || (action === "prepare" && s.attempt !== 1)
          || (action === "retry" && s.attempt !== job.packet.attempt + 1)
          || (action !== "retry" && job.packet && s.attempt !== job.packet.attempt)) bad();
        let host;
        try { host = parseHostCloseState(s.close); } catch { bad(); }
        if (s.hostInstanceId !== host.hostInstanceId || (s.state === "disposed") !== (host.lifecycle === "disposed")
          || (s.state === "ready" && !host.quiescent)
          || (action === "activate" ? s.state !== "released" || !uuid(raw.admission) : action !== "inspect" && s.state === "released")
          || (job.released && s.state !== "released" && s.state !== "disposed")) bad();
        verifyFenceHost(host);
        return Object.freeze({ snapshot: Object.freeze({ ...s, close: host }), admission: raw.admission ?? null });
      }
      async function sendFenceRequest(action, body, job) {
        const physical = async () => {
          if (!fenceCurrent(job)) throw Error(job.cancelled ?? "fence-stale");
          job.writeSent = action !== "inspect";
          if (action === "prepare") job.installed = true; // An aborted write may still reach the Host.
          const response = await fetchImpl(`/whale-wallpaper/close-fence/${action}`, { method: "POST", cache: "no-store",
            headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: job.abort.signal });
          const cancelResponse = () => { try { Promise.resolve(response.body?.cancel()).catch(() => {}); } catch {} };
          if (job.cancelled) { cancelResponse(); throw Error(job.cancelled); }
          if (!response.body?.getReader) { cancelResponse(); throw Error("fence-invalid"); }
          const reader = response.body.getReader();
          const cancelBody = () => { try { Promise.resolve(reader.cancel()).catch(() => {}); } catch {} };
          job.cancelBody = cancelBody;
          let bytes = 0, chunks = 0, text = "", complete = false;
          try {
            const decoder = new TextDecoder("utf-8", { fatal: true });
            while (true) {
              const part = await reader.read();
              if (job.cancelled) throw Error(job.cancelled);
              if (part.done) break;
              if (++chunks > 8192 || !(part.value instanceof Uint8Array) || (bytes += part.value.byteLength) > 8192) throw Error("fence-invalid");
              text += decoder.decode(part.value, { stream: true });
            }
            text += decoder.decode();
            if (response.ok !== true) {
              // Only a structurally valid conflict is known not to have accepted this action.
              const refused = JSON.parse(text);
              if (response.ok === false && response.status === 409 && refused?.ok === false && Object.keys(refused).length === 2
                && ["invalid", "disposed", "host", "conflict", "owned", "stale", "owner", "not-retryable", "not-ready"].some(code => refused.error === `close-fence-${code}`)) {
                job.acknowledged = true; complete = true;
                if (action === "prepare") job.installed = false;
                return { response, payload: { ok: false, error: "fence-rejected" } };
              }
              throw Error([404, 405].includes(response.status) ? "fence-unsupported" : "fence-http");
            }
            const packet = parseFenceReply(JSON.parse(text), action, job);
            if (!fenceCurrent(job)) throw Error(job.cancelled ?? "fence-stale");
            job.acknowledged = true; complete = true;
            return { response, payload: packet };
          } finally {
            if (!complete) cancelBody();
            job.cancelBody = null;
            try { reader.releaseLock(); } catch {}
          }
        };
        return Promise.race([physical(), job.cancellation]);
      }
      async function runFenceAction(action, options = {}) {
        const early = error => Object.freeze({ ok: false, error, snapshot: fenceSnapshot });
        if (disposed) return early("fence-disposed");
        if (fenceRequest || commandPending.size || busy || activeStopId || activeStopGeneration) return early("fence-busy");
        if (action !== "inspect" && commandUncertain) return early("fence-write-unknown");
        let signal, timeoutMs, isCurrent;
        try {
          if (!options || typeof options !== "object" || Array.isArray(options)) return early("fence-invalid-options");
          ({ signal, timeoutMs, isCurrent = () => true } = options);
          if (typeof isCurrent !== "function" || (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs <= 0))
            || (signal != null && (typeof signal.aborted !== "boolean" || typeof signal.addEventListener !== "function" || typeof signal.removeEventListener !== "function"))) return early("fence-invalid-options");
          if (signal?.aborted) return early("fence-aborted");
          if (isCurrent() !== true) return early("fence-stale");
        } catch { return early("fence-invalid-options"); }
        if (typeof AbortController !== "function" || typeof TextDecoder !== "function") return early("fence-unavailable");
        if (action === "prepare") {
          if (fenceOwner?.installed && !fenceOwner.released) return early("fence-owned");
          if (status.cleanupPending || !["idle", "stopped", "playing", "waiting", "connecting", "reconnecting"].includes(status.state)) return early("fence-state");
          if (typeof window.crypto?.randomUUID !== "function") return early("fence-unavailable");
        } else {
          checkFenceValidity();
          if (!fenceOwner?.ticket) return early("fence-unprepared");
          if (action === "retry" && fenceOwner.packet?.state !== "unconfirmed") return early("fence-not-retryable");
          if (action === "activate" && (fenceSnapshot.state !== "ready" || fenceOwner.consumed || !fenceCurrent(fenceOwner)
            || running || status.cleanupPending || !["idle", "stopped"].includes(status.state))) return early("fence-not-ready");
        }
        const previous = fenceOwner;
        const job = { id: ++fenceSequence, action, signal, isCurrent, abort: new AbortController(),
          stamp: { generation, epoch: fenceEpoch, status }, pending: true, cancelled: null, cancelBody: null,
          body: action === "prepare" ? null : previous.body, ticket: action === "prepare" ? null : previous.ticket,
          packet: action === "prepare" ? null : previous.packet, released: action !== "prepare" && previous.released,
          installed: action !== "prepare" && previous.installed, writeSent: false, acknowledged: false };
        let rejectCancellation;
        job.cancellation = new Promise((_, reject) => { rejectCancellation = reject; });
        job.cancellation.catch(() => {});
        job.cancel = code => {
          if (job.cancelled) return;
          job.cancelled = code; job.abort.abort(); job.cancelBody?.(); rejectCancellation(Error(code));
        };
        fenceRequest = job;
        const onAbort = () => job.cancel("fence-aborted");
        const limit = Math.max(1, Math.min(4000, timeoutMs ?? 4000,
          Number.isFinite(hostStatusTimeoutMs) && hostStatusTimeoutMs > 0 ? hostStatusTimeoutMs : 4000));
        const work = async () => {
          if (action === "prepare") {
            const result = await readHostCloseState({ signal: job.abort.signal, timeoutMs: limit, isCurrent: () => fenceCurrent(job) });
            if (!result.ok) throw Error(job.cancelled ?? "fence-host-read");
            if (!fenceCurrent(job)) throw Error("fence-stale");
            if (result.snapshot.host.lifecycle !== "active") throw Error("fence-host-disposed");
            job.body = { hostInstanceId: result.snapshot.host.hostInstanceId, revision: result.snapshot.host.revision,
              requestId: window.crypto.randomUUID() };
            // Admit exactly our own increment, never a reentrant stop/start performed by a listener.
            job.stamp = { generation: generation + 1, epoch: fenceEpoch + 1, status };
            job.updatingStatus = true;
            fenceOwner = job;
            try { invalidate(); endLocalRun("background-close", generation); }
            finally { job.updatingStatus = false; job.stamp.status = status; }
          } else fenceOwner = job;
          if (!fenceCurrent(job)) throw Error(job.cancelled ?? "fence-stale");
          publishFence("pending", job);
          if (!fenceCurrent(job)) throw Error(job.cancelled ?? "fence-stale");
          const body = action === "prepare" ? job.body : { hostInstanceId: job.body.hostInstanceId, fenceId: job.ticket,
            ...(action === "retry" ? { attempt: job.packet.attempt } : action === "activate" ? { revision: job.packet.close.revision } : {}) };
          const send = () => sendFenceRequest(action, body, job);
          const outcome = action === "inspect" ? await send()
            : await command(`close-fence/${action}`, body, { execute: send, fenceJob: job });
          if (!fenceCurrent(job)) throw Error(job.cancelled ?? "fence-stale");
          if (outcome.response?.ok === false || outcome.ok === false) throw Error("fence-rejected");
          const packet = outcome.payload;
          job.packet = packet.snapshot; job.ticket = packet.snapshot.fenceId;
          acceptedHostClose = packet.snapshot.close;
          if (action === "activate") { writeAdmission = packet.admission; job.released = true; }
          else if (packet.snapshot.state === "ready" || packet.snapshot.state === "unconfirmed" || packet.snapshot.state === "unknown") {
            job.updatingStatus = true;
            try {
              emitStatus({ state: packet.snapshot.state === "ready" ? "stopped" : "cleanup-failed",
                error: packet.snapshot.state === "ready" ? "" : "fence-cleanup-unconfirmed", cleanupPending: false,
                ...(packet.snapshot.state === "ready" ? { host: status.host ? { ...status.host, active: false,
                  activeSceneId: null, session: null, failed: false, cleanupPending: false } : null } : {}) });
            } finally { job.updatingStatus = false; job.stamp = { generation, epoch: job.stamp.epoch, status }; }
          }
          if (!fenceCurrent(job)) throw Error(job.cancelled ?? "fence-stale");
          const snapshot = publishFence(commandUncertain ? "unknown" : packet.snapshot.state, job, packet.snapshot.close);
          if (!fenceCurrent(job)) throw Error(job.cancelled ?? "fence-stale");
          return Object.freeze({ ok: true, snapshot });
        };
        let timer;
        try {
          timer = window.setTimeout(() => job.cancel("fence-timeout"), limit);
          try { signal?.addEventListener("abort", onAbort, { once: true }); } catch { throw Error("fence-invalid-options"); }
          if (signal?.aborted) onAbort();
          if (!fenceCurrent(job)) throw Error(job.cancelled ?? "fence-stale");
          return await Promise.race([work(), job.cancellation]);
        } catch (error) {
          if (job.writeSent && !job.acknowledged) commandUncertain = true;
          const known = ["fence-stale", "fence-aborted", "fence-timeout", "fence-disposed", "fence-invalid-options",
            "fence-invalid", "fence-http", "fence-unsupported", "fence-rejected", "fence-host-read", "fence-host-disposed", "fence-host-changed", "fence-host-regressed"];
          const code = job.cancelled ?? (known.includes(error?.message) ? error.message : "fence-failed");
          if (fenceRequest === job) publishFence(disposed ? "disposed" : commandUncertain ? "unknown"
            : code === "fence-stale" ? "stale" : "failed", job, null, code);
          return Object.freeze({ ok: false, error: code, snapshot: fenceSnapshot });
        } finally {
          job.pending = false; window.clearTimeout(timer);
          try { signal?.removeEventListener("abort", onAbort); } catch {}
          if (fenceRequest === job) fenceRequest = null;
        }
      }

      const emitStatus = (patch) => {
        status = Object.freeze({ ...status, ...patch });
        statusListeners.forEach(listener => listener(status));
        publishCloseState();
      };
      const emitFrame = (bitmap, frame) => frameListeners.forEach(listener => listener(bitmap, frame));
      const notifyStop = (reason) => listeners.forEach(listener => listener(reason));
      const notifyStalled = () => stallListeners.forEach(listener => listener());

      const snapshot = () => {
        const r = activeRun;
        return Object.freeze({
          received: r.metrics.received,
          rendered: r.metrics.rendered,
          dropped: r.metrics.dropped,
          sourceSequence: r.metrics.sourceSequence,
          decodeErrors: r.metrics.decodeErrors,
          seconds: r.startedAt ? Math.max(0, (now() - r.startedAt) / 1000) : 0,
          meanLatencyMs: r.metrics.rendered ? r.latencySum / r.metrics.rendered : 0,
          maxLatencyMs: r.latencyMax,
          hidden: Number(document.hidden),
          waitRafCount: r.waitRafCount,
          waitRafSumMs: Number(r.waitRafSumMs.toFixed(3)),
          waitRafMaxMs: Number(r.waitRafMaxMs.toFixed(3)),
          waitTimeoutCount: r.waitTimeoutCount,
          waitTimeoutSumMs: Number(r.waitTimeoutSumMs.toFixed(3)),
          waitTimeoutMaxMs: Number(r.waitTimeoutMaxMs.toFixed(3)),
          waitCancelledCount: r.waitCancelledCount,
          decodeSuccessCount: r.decodeSuccessCount,
          decodeSuccessSumMs: Number(r.decodeSuccessSumMs.toFixed(3)),
          decodeSuccessMaxMs: Number(r.decodeSuccessMaxMs.toFixed(3)),
          decodeFailCount: r.decodeFailCount,
          decodeFailSumMs: Number(r.decodeFailSumMs.toFixed(3)),
          decodeFailMaxMs: Number(r.decodeFailMaxMs.toFixed(3)),
          discardHiddenCount: r.discardHiddenCount,
          discardStaleCount: r.discardStaleCount,
          syncCount: r.syncCount,
          syncSumMs: Number(r.syncSumMs.toFixed(3)),
          syncMaxMs: Number(r.syncMaxMs.toFixed(3)),
          syncErrorCount: r.syncErrorCount,
          drawCount: r.drawCount,
          drawSumMs: Number(r.drawSumMs.toFixed(3)),
          drawMaxMs: Number(r.drawMaxMs.toFixed(3)),
          drawErrorCount: r.drawErrorCount,
          dropDecodingCount: r.dropDecodingCount,
          dropSyncCount: r.dropSyncCount,
          dropWaitingCallbackCount: r.dropWaitingCallbackCount,
          dropOtherCount: r.dropOtherCount,
        });
      };

      const reportMetrics = () => {
        if (!running) return;
        fetchImpl("/whale-wallpaper/metrics", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify(snapshot()), keepalive: true }).catch(() => {});
      };

      const recordDraw = (frameGeneration, ok, durationMs) => {
        if (!running || frameGeneration !== activeRun.generation) return;
        if (ok) {
          activeRun.drawCount++;
          activeRun.drawSumMs += durationMs;
          activeRun.drawMaxMs = Math.max(activeRun.drawMaxMs, durationMs);
        } else {
          activeRun.drawErrorCount++;
        }
      };

      const cancelSchedule = (sch) => {
        if (!sch || sch.cancelled || sch.completed) return;
        sch.cancelled = true;
        if (sch.rafId !== null) {
          cancelAnimationFrame(sch.rafId);
          sch.rafId = null;
        }
        if (sch.timeoutId !== null) {
          window.clearTimeout(sch.timeoutId);
          sch.timeoutId = null;
        }
      };

      const paint = async (run) => {
        if (!running || run !== activeRun || run.painting || !run.latest || document.hidden) return;
        run.painting = true;
        run.paintPhase = "decoding";
        const frame = run.latest;
        run.latest = null;
        let bitmap = null;
        let decodeErr = null;
        const decodeStart = monoNow();
        try {
          bitmap = await createImageBitmap(new Blob([frame.jpeg], { type: "image/jpeg" }));
        } catch (err) {
          decodeErr = err;
        }

        try {
          if (run !== activeRun) {
            // A new run has started: clean up old bitmap and do not mutate activeRun
            bitmap?.close?.();
            bitmap = null;
            return;
          }

          if (decodeErr) {
            run.metrics.decodeErrors++;
            run.decodeFailCount++;
            const decodeFailMs = Math.max(0, monoNow() - decodeStart);
            run.decodeFailSumMs += decodeFailMs;
            run.decodeFailMaxMs = Math.max(run.decodeFailMaxMs, decodeFailMs);
            return;
          }

          const decodeMs = Math.max(0, monoNow() - decodeStart);
          run.decodeSuccessCount++;
          run.decodeSuccessSumMs += decodeMs;
          run.decodeSuccessMaxMs = Math.max(run.decodeSuccessMaxMs, decodeMs);

          if (!running) {
            run.discardStaleCount++;
            bitmap?.close?.();
            bitmap = null;
            return;
          }

          if (document.hidden) {
            run.discardHiddenCount++;
            bitmap?.close?.();
            bitmap = null;
            return;
          }

          run.paintPhase = "sync";
          run.metrics.rendered++;
          run.metrics.sourceSequence = frame.sequence;
          const latency = Math.max(0, now() - frame.capturedAt);
          run.latencySum += latency;
          run.latencyMax = Math.max(run.latencyMax, latency);

          const syncStart = monoNow();
          try {
            emitFrame(bitmap, { ...frame, generation: run.generation });
            emitStatus({ rendered: run.metrics.rendered, decodeErrors: run.metrics.decodeErrors, state: "playing", error: "" });
            bitmap = null; // ownership moved to subscriber ONLY on successful notification
          } catch {
            run.syncErrorCount++;
          } finally {
            const syncMs = Math.max(0, monoNow() - syncStart);
            run.syncCount++;
            run.syncSumMs += syncMs;
            run.syncMaxMs = Math.max(run.syncMaxMs, syncMs);
          }
        } finally {
          bitmap?.close?.();
          run.painting = false;
          run.paintPhase = "idle";
          if (run === activeRun && running && !document.hidden && run.latest) {
            schedulePaint(run);
          }
        }
      };

      // requestAnimationFrame keeps painting aligned with the display, but it does not
      // fire in a hidden or non-composited page (and may hand back 0). The timeout
      // backstop guarantees an already running preview still paints instead of stalling.
      const schedulePaint = (run) => {
        if (!running || run !== activeRun || run.currentSchedule || run.painting) return;
        const schedule = {
          generation: run.generation,
          startTime: monoNow(),
          cancelled: false,
          completed: false,
          rafId: null,
          timeoutId: null,
        };
        run.currentSchedule = schedule;

        const onFire = (source) => {
          if (schedule.cancelled || schedule.completed) return;
          schedule.completed = true;
          if (schedule.rafId !== null) {
            cancelAnimationFrame(schedule.rafId);
            schedule.rafId = null;
          }
          if (schedule.timeoutId !== null) {
            window.clearTimeout(schedule.timeoutId);
            schedule.timeoutId = null;
          }
          if (run.currentSchedule === schedule) {
            run.currentSchedule = null;
          }
          if (!running || run !== activeRun) return;

          const waitMs = Math.max(0, monoNow() - schedule.startTime);
          if (source === "timeout") {
            run.waitTimeoutCount++;
            run.waitTimeoutSumMs += waitMs;
            run.waitTimeoutMaxMs = Math.max(run.waitTimeoutMaxMs, waitMs);
          } else {
            run.waitRafCount++;
            run.waitRafSumMs += waitMs;
            run.waitRafMaxMs = Math.max(run.waitRafMaxMs, waitMs);
          }
          if (run.latest) paint(run);
        };

        schedule.rafId = requestAnimationFrame(() => onFire("raf"));
        schedule.timeoutId = window.setTimeout(() => onFire("timeout"), 250);
      };

      const accept = (runGeneration, frame) => {
        if (!running || runGeneration !== activeRun.generation) return;
        const r = activeRun;
        r.metrics.received++;
        r.lastFrameAt = now();
        lastFrameAt = r.lastFrameAt;
        if (r.latest) {
          r.metrics.dropped++;
          if (r.painting) {
            if (r.paintPhase === "decoding") {
              r.dropDecodingCount++;
            } else if (r.paintPhase === "sync") {
              r.dropSyncCount++;
            } else {
              r.dropOtherCount++;
            }
          } else if (r.currentSchedule && !r.currentSchedule.cancelled && !r.currentSchedule.completed) {
            r.dropWaitingCallbackCount++;
          } else {
            r.dropOtherCount++;
          }
        }
        r.latest = { ...frame, jpeg: frame.jpeg.slice() };
        if (!r.painting && !r.currentSchedule && !document.hidden) schedulePaint(r);
      };

      /**
       * Read frames with two independent bounds, both measured on the client clock so a
       * stalled clock-based check and the deadline agree:
       *  - `idleTimeoutMs` without a frame: the run stops delivering, withdraws the stale
       *    picture and ends as a failure (the Host is then asked to clean up);
       *  - `deadline` for the whole first-frame window: an open connection that never
       *    produces a frame ends the same way instead of waiting forever.
       * Both are enforced by a timer, never by `reader.read`, because an open connection
       * that sends nothing would hang that promise indefinitely.
       */
      async function runStream(runGeneration) {
        // Two bounds, both enforced by the timer below and never by `reader.read`, because an
        // open connection that sends nothing would hang that promise forever:
        //  - silence longer than `idleTimeoutMs` ends the run (the capture stopped, the window
        //    is gone or the machine slept: the Host is asked to clean up);
        //  - `firstFrameTimeoutMs` bounds the wait for the first frame even if short answers
        //    (503 while the capture is being prepared) keep the connection busy.
        // A stream that keeps delivering frames is never overdue, so a healthy preview may
        // run for as long as the Host allows it.
        let attempts = 0;
        let haveFrame = false;
        const startedAt = now();
        while (running && runGeneration === generation) {
          attempts += 1;
          let response;
          try {
            response = await fetchImpl("/whale-wallpaper/stream", { signal: abort?.signal, cache: "no-store" });
          } catch (error) {
            if (!running || runGeneration !== generation) return { ending: "stopped" };
            if (!haveFrame && now() - startedAt > firstFrameTimeoutMs) return { ending: "first-frame-timeout", error: "first-frame-timeout" };
            emitStatus({ state: haveFrame ? "waiting" : "connecting", error: "", attempts });
            await new Promise(resolve => window.setTimeout(resolve, retryDelayMs));
            continue;
          }
          if (!response.ok || !response.body) {
            if (!running || runGeneration !== generation) return { ending: "stopped" };
            if (!haveFrame && now() - startedAt > firstFrameTimeoutMs) return { ending: "first-frame-timeout", error: "first-frame-timeout" };
            emitStatus({ state: haveFrame ? "waiting" : "connecting", error: "", attempts });
            await new Promise(resolve => window.setTimeout(resolve, retryDelayMs));
            continue;
          }
          const decoder = new WM_FRAME_DECODER(frame => { haveFrame = true; accept(runGeneration, frame); });
          const reader = response.body.getReader();
          let stallOutcome = null;
          let watchdog = 0;
          const onAbort = () => {
            if (stallOutcome) return;
            if (watchdog) { window.clearInterval(watchdog); watchdog = 0; }
            // The wait may have ended the run; do not let a pending read keep it open.
            reader.cancel?.().catch(() => {});
          };
          abort?.signal.addEventListener("abort", onAbort, { once: true });
          watchdog = window.setInterval(() => {
            if (stallOutcome) return;
            if (!running || runGeneration !== generation) { window.clearInterval(watchdog); watchdog = 0; return; }
            const idle = now() - lastFrameAt;
            const firstFrameOverdue = !haveFrame && now() - startedAt > firstFrameTimeoutMs;
            if (idle < idleTimeoutMs && !firstFrameOverdue) return;
            stallOutcome = firstFrameOverdue
              ? { ending: "first-frame-timeout", error: "first-frame-timeout" }
              : { ending: "no-frames", error: "no-frames" };
            window.clearInterval(watchdog); watchdog = 0;
            emitStatus({ state: "waiting", error: "" });
            hideStalledFrames = true;
            notifyStalled();
            abort?.abort();
            reader.cancel?.().catch(() => {});
          }, Math.max(250, Math.min(1000, Math.floor(idleTimeoutMs / 4))));
          try {
            while (running && runGeneration === generation) {
              const { value, done } = await reader.read();
              if (done) break;
              decoder.push(value);
            }
            if (running && runGeneration === generation && !stallOutcome) decoder.finish();
          } catch (error) {
            if (!running || runGeneration !== generation) return { ending: "stopped" };
            if (!stallOutcome) return { ending: "stream-error", error: String(error?.message || "stream-failed") };
          } finally {
            if (watchdog) { window.clearInterval(watchdog); watchdog = 0; }
            abort?.signal.removeEventListener("abort", onAbort);
            reader.releaseLock?.();
          }
          if (!running || runGeneration !== generation) return { ending: "stopped" };
          // Silence longer than the idle bound is terminal: a preview that stopped delivering
          // frames is over, and the caller closes the Host resources for it.
          if (stallOutcome) return stallOutcome;
          // The stream ended while the run is still active: the preview hit its time limit
          // or the capture stopped. Report it and let the layer drop the last frame.
          return { ending: "stream-end" };
        }
        return { ending: "stopped" };
      }

      /** Every run reports only its own frames, latency and source sequence. */
      const resetRunMetrics = () => {
        activeRun = createRunContext(generation);
        activeRun.startedAt = startedAt || now();
        activeRun.lastFrameAt = lastFrameAt || now();
        hideStalledFrames = false;
      };

      async function connect(runGeneration) {
        abort = new AbortController();
        // This engine object lives for the whole page, so the counters must be cleared for
        // each new run; otherwise the UI shows the previous run's totals with this run's
        // seconds, which makes the frame rate look far too high. Only the generation that
        // really started is allowed to reset anything.
        if (runGeneration === generation) { resetRunMetrics(); emitStatus({ rendered: 0, decodeErrors: 0 }); }
        emitStatus({ state: "connecting", error: "" });
        pollTimer = window.setInterval(() => {
          if (!running || runGeneration !== generation) return;
          reportMetrics();
          const seconds = snapshot().seconds;
          if (hideStalledFrames || activeRun.hideStalledFrames) {
            hideStalledFrames = false;
            activeRun.hideStalledFrames = false;
            return;
          }
          const fresh = now() - (activeRun.lastFrameAt || lastFrameAt) < idleTimeoutMs;
          // A preview that stopped delivering frames stops presenting the last one: the
          // ordinary theme comes back while the client keeps trying to recover.
          emitStatus(fresh
            ? { state: "playing", error: "", rendered: activeRun.metrics.rendered, decodeErrors: activeRun.metrics.decodeErrors, seconds }
            : { state: "waiting", error: "", rendered: activeRun.metrics.rendered, decodeErrors: activeRun.metrics.decodeErrors, seconds });
        }, 500);
        const outcome = await runStream(runGeneration);
        window.clearInterval(pollTimer); pollTimer = null;
        if (!running || runGeneration !== generation || outcome.ending === "stopped") return;
        running = false; busy = false;
        const message = outcome.ending === "stream-end" ? "" : String(outcome.error || outcome.ending);
        const failed = outcome.ending !== "stream-end";
        emitStatus({ state: failed ? "error" : "stopped", error: message,
          rendered: activeRun.metrics.rendered, decodeErrors: activeRun.metrics.decodeErrors });
        notifyStop(failed ? "failed" : "ended");
        // A failed run must not leave its Host resources behind; the close result is
        // reported so an unproven cleanup is visible instead of being swallowed.
        if (failed) await stop("failed", { bump: false });
      }

      async function command(action, body = {}, { compensating = false, admission = writeAdmission, execute = null, fenceJob = null } = {}) {
        if (!fenceJob) { fenceEpoch++; checkFenceValidity(); }
        const token = Object.freeze({ id: ++commandSequence, action, generation, compensating });
        commandPending.set(token.id, token);
        closedObservation = null;
        commandRevision++;
        publishCloseState();
        let outcome = "unknown";
        try {
          let response, payload;
          let malformed = false;
          if (execute) ({ response, payload } = await execute());
          else {
            response = await fetchImpl(`/whale-wallpaper/${action}`, { method: "POST",
              headers: { "content-type": "application/json", ...(admission ? { "x-whale-wallpaper-admission": admission } : {}) }, body: JSON.stringify(body) });
            payload = await response.json().catch(() => { malformed = true; return {}; });
          }
          const valid = !malformed && payload !== null && typeof payload === "object" && !Array.isArray(payload);
          if (valid && typeof response.ok === "boolean") {
            if (action !== "stop") outcome = response.ok ? "accepted" : "rejected";
            else if (!response.ok || payload.cleanup?.closed === false) outcome = "unconfirmed";
            else if (payload.cleanup?.closed !== true) outcome = "no-proof";
            else outcome = (payload.active !== undefined && payload.active !== false)
              || payload.activeSceneId != null || payload.session != null
              || (payload.pending !== undefined && payload.pending !== false)
              || (payload.failed !== undefined && payload.failed !== false)
              || (payload.cleanupPending !== undefined && payload.cleanupPending !== false)
              ? "unconfirmed" : "closed";
          }
          // Preserve the existing command result and compatibility handling. Strict
          // observations must not turn a missing current cleanup into lastCleanup proof.
          return { ok: response.ok, payload };
        } finally {
          commandPending.delete(token.id);
          lastCommand = Object.freeze({ ...token, outcome });
          if (outcome === "unknown") commandUncertain = true;
          closedObservation = outcome === "closed" && !compensating && !disposed && !commandUncertain
            && commandSequence === token.id && token.generation === generation && commandPending.size === 0
            ? Object.freeze({ generation, commandId: token.id }) : null;
          commandRevision++;
          publishCloseState();
        }
      }

      /**
       * Read the bounded wallpaper list. Only the id, the title (plain text), the type, the
       * availability and a short reason reach this side; the Host never sends a path.
       * `refresh: true` asks the Host to rescan; everything else is a cached read and never
       * starts, stops or rescans anything.
       */
      async function readLibrary({ refresh = false, ensure = false, signal = null } = {}) {
        // Closing an ensure/cache reader must not publish its late reply or abort failure.
        const reqId = ++libraryRevision;
        if (refresh) {
          libraryRefreshing = true;
          if (librarySnapshot) {
            librarySnapshot = Object.freeze({ ...librarySnapshot, loading: true });
          } else {
            librarySnapshot = Object.freeze({ items: [], state: "loading", loaded: false, loading: true, error: null });
          }
          for (const listener of libraryListeners) {
            try { listener(librarySnapshot); } catch {}
          }
        }
        try {
          const path = refresh ? "/whale-wallpaper/library/refresh" : ensure ? "/whale-wallpaper/library?ensure=1" : "/whale-wallpaper/library";
          const response = await fetchImpl(path,
            { method: refresh ? "POST" : "GET", cache: "no-store", ...(signal ? { signal } : {}) });
          const payload = await response.json().catch(() => null);
          const items = Array.isArray(payload?.items) ? payload.items.map(cleanLibraryItem).filter(Boolean) : [];
          const result = {
            ok: response.ok,
            items,
            state: typeof payload?.state === "string" ? payload.state : (response.ok ? "ready" : "failed"),
            loaded: payload?.loaded === true,
            ensureScan: payload?.ensureScan === true,
            truncated: payload?.truncated === true,
            scannedAt: typeof payload?.scannedAt === "string" ? payload.scannedAt : null,
            error: typeof payload?.error === "string" ? payload.error : (response.ok ? "" : `library-${response.status}`),
            rootsConfigured: Number.isInteger(payload?.rootsConfigured) ? payload.rootsConfigured : 0,
            rootsAvailable: Number.isInteger(payload?.rootsAvailable) ? payload.rootsAvailable : 0,
            rootWarnings: Array.isArray(payload?.rootWarnings) ? payload.rootWarnings.map(entry => String(entry?.reason ?? "")).filter(Boolean) : [],
          };
          if (reqId === libraryRevision && !(signal?.aborted && !refresh)) {
            libraryRefreshing = false;
            librarySnapshot = Object.freeze(result);
            for (const listener of libraryListeners) {
              try { listener(librarySnapshot); } catch {}
            }
          }
          return result;
        } catch (error) {
          if (reqId === libraryRevision && !(signal?.aborted && !refresh)) {
            libraryRefreshing = false;
            librarySnapshot = Object.freeze({
              ok: false,
              items: librarySnapshot?.items || [],
              state: "failed",
              loaded: Boolean(librarySnapshot?.loaded),
              loading: false,
              truncated: false,
              error: error.message || "library_fetch_failed",
              rootsConfigured: 0,
              rootsAvailable: 0,
              rootWarnings: [],
            });
            for (const listener of libraryListeners) {
              try { listener(librarySnapshot); } catch {}
            }
          }
          throw error;
        }
      }

      /** Keep only the fields the UI is allowed to show, and never treat a title as markup. */
      function cleanLibraryItem(raw) {
        if (!raw || typeof raw !== "object") return null;
        if (!isSceneId(raw.id)) return null;
        return {
          id: raw.id,
          title: typeof raw.title === "string" ? raw.title.slice(0, 200) : raw.id,
          type: ["scene", "video", "web", "unknown"].includes(raw.type) ? raw.type : "unknown",
          available: raw.available === true,
          contentRating: ["Everyone", "Questionable", "Mature"].includes(raw.contentRating) ? raw.contentRating : (raw.id === "lucy" ? "Everyone" : "unknown"),
          // Anything the Host did not mark as verified stays experimental, whatever the field says.
          playbackVerified: raw.playbackVerified === true && raw.id === "lucy",
          reason: typeof raw.reason === "string" ? raw.reason : null,
          previewRef: raw.previewRef && typeof raw.previewRef === "object" ? {
            wallpaperId: raw.previewRef.wallpaperId || raw.id,
            kind: raw.previewRef.kind || "preview",
          } : { wallpaperId: raw.id, kind: "preview" },
        };
      }

      const invalidate = () => {
        generation += 1;
        fenceEpoch++;
        closedObservation = null;
        publishCloseState();
        return generation;
      };

      const endLocalRun = (reason, stopGeneration, keptState = null, keptError = "") => {
        running = false; busy = false;
        abort?.abort(); abort = null;
        window.clearInterval(pollTimer); pollTimer = null;
        if (activeRun.currentSchedule) {
          cancelSchedule(activeRun.currentSchedule);
          activeRun.currentSchedule = null;
          activeRun.waitCancelledCount++;
        }
        activeRun.latest = null;
        // The ended run keeps no live timing: a later run measures its own elapsed time
        // instead of inheriting the stopped one's total.
        startedAt = 0;
        activeRun.startedAt = 0;
        hideStalledFrames = false;
        emitStatus({ state: keptState ?? (reason === "user" ? "stopped" : "idle"), error: keptError, generation: stopGeneration, seconds: 0, cleanupPending: true });
        // The layer is dropped right away; a close that cannot be proven is reported
        // afterwards so the UI can say so instead of pretending the run stopped cleanly.
        notifyStop(reason);
      };

      const stop = (reason = "user", { bump = true } = {}) => {
        // A user stop uses a new generation so a late start reply cannot revive the run.
        // The internal close that follows a terminal failure keeps the generation: that run
        // is already over, and bumping it would erase the failure the user must see.
        const stopId = ++stopRevision;
        activeStopId = stopId;
        const stopGeneration = bump ? invalidate() : generation;
        activeStopGeneration = stopGeneration;
        const keptError = reason === "failed" ? status.error : "";
        const keptState = reason === "failed" && ["error", "cleanup-failed"].includes(status.state) ? status.state : null;
        endLocalRun(reason, stopGeneration, keptState, keptError);
        return command("stop").then(({ ok, payload }) => {
          const isCurrent = (activeStopId === stopId) && (generation === stopGeneration) && !disposed;
          if (!isCurrent) return status;
          activeStopId = 0;
          activeStopGeneration = 0;
          lastCleanup = payload?.cleanup ?? payload?.lastCleanup ?? null;
          const proven = ok && lastCleanup?.closed !== false;
          if (!proven) {
            const detail = payload?.error || lastCleanup?.error || `cleanup not confirmed (${lastCleanup?.outcome ?? "unknown"})`;
            emitStatus({ state: "cleanup-failed", error: String(detail), host: payload, cleanupPending: false });
          } else {
            emitStatus({ state: keptState ?? (reason === "user" ? "stopped" : "idle"), error: keptError, host: payload, cleanupPending: false });
          }
          return status;
        }).catch(error => {
          const isCurrent = (activeStopId === stopId) && (generation === stopGeneration) && !disposed;
          if (!isCurrent) return status;
          activeStopId = 0;
          activeStopGeneration = 0;
          emitStatus({ state: "cleanup-failed", error: String(error?.message || "stop-failed"), cleanupPending: false });
          return status;
        });
      };

      return {
        // The backdrop layer subscribes with { onFrame, onStop }; a plain function is
        // accepted too, so a test or a future consumer can watch frames only.
        subscribe(listener) {
          const frameListener = typeof listener === "function" ? listener : listener?.onFrame;
          if (typeof frameListener !== "function") throw new TypeError("wallpaper subscriber needs an onFrame function");
          const stopListener = typeof listener?.onStop === "function" ? listener.onStop : null;
          const stallListener = typeof listener?.onStall === "function" ? listener.onStall : null;
          frameListeners.add(frameListener);
          if (stopListener) listeners.add(stopListener);
          if (stallListener) stallListeners.add(stallListener);
          return () => {
            frameListeners.delete(frameListener);
            if (stopListener) listeners.delete(stopListener);
            if (stallListener) stallListeners.delete(stallListener);
          };
        },
        subscribeStatus(listener) { statusListeners.add(listener); listener(status); return () => statusListeners.delete(listener); },
        getStatus: () => status,
        getCloseSnapshot: readCloseSnapshot,
        getHostCloseSnapshot,
        readHostCloseState,
        getCloseFenceSnapshot() { checkFenceValidity(); return fenceSnapshot; },
        consumeCloseFence(expected) {
          checkFenceValidity();
          if (!expected || expected !== fenceSnapshot || expected.state !== "ready" || !expected.sameRound
            || !fenceOwner || fenceOwner.consumed || fenceOwner.released || !fenceCurrent(fenceOwner)
            || fenceRequest || commandPending.size || commandUncertain || disposed || busy || running
            || status.cleanupPending || activeStopId || activeStopGeneration || !["idle", "stopped"].includes(status.state)
            || !fenceOwner.packet?.close.quiescent || fenceOwner.packet.close !== acceptedHostClose) return false;
          // Synchronous, no publication/callback/IO gap between validation and consuming authority.
          fenceOwner.consumed = true;
          return true;
        },
        prepareCloseFence: options => runFenceAction("prepare", options),
        inspectCloseFence: options => runFenceAction("inspect", options),
        retryCloseFence: options => runFenceAction("retry", options),
        activateCloseFence: options => runFenceAction("activate", options),
        // Admission is private. A stale public snapshot is never an enable permission.
        canEnableBackgroundSource: () => !disposed && !fenceRequest && !commandPending.size && !commandUncertain
          && !busy && !running && !status.cleanupPending && !activeStopId && !activeStopGeneration
          && ["idle", "stopped"].includes(status.state) && status.host?.active !== true
          && status.host?.activeSceneId == null && status.host?.session == null
          && (!fenceOwner || (fenceOwner.released && typeof writeAdmission === "string")),
        subscribeCloseFence(listener) {
          if (disposed) return () => {};
          fenceListeners.add(listener);
          return () => fenceListeners.delete(listener);
        },
        subscribeHostCloseState(listener) {
          if (disposed) return () => {};
          hostCloseListeners.add(listener);
          return () => hostCloseListeners.delete(listener);
        },
        subscribeCloseState(listener) {
          if (disposed) return () => {};
          closeStateListeners.add(listener);
          return () => closeStateListeners.delete(listener);
        },
        running: () => running,
        /**
         * Reads the host status with a bounded wait.
         *
         * Readiness must mean "the host answered successfully AND said it can run": an HTTP
         * error body (503 while the service is still starting) or a 200 with a malformed
         * payload is NOT ready. Without a timeout a single hanging fetch would keep the
         * automatic start waiting forever, so the whole read is bounded and cancellable.
         */
        async loadHostStatus({ timeoutMs, signal = null } = {}) {
          const boundedMs = timeoutMs ?? hostStatusTimeoutMs;
          const controller = typeof AbortController === "function" ? new AbortController() : null;
          const onAbort = () => controller?.abort();
          if (signal) {
            if (signal.aborted) return null;
            signal.addEventListener("abort", onAbort, { once: true });
          }
          let timer = 0;
          try {
            const read = async () => {
              const response = await fetchImpl("/whale-wallpaper/status", { cache: "no-store", signal: controller?.signal });
              if (!response.ok) throw new Error(`host-status-${response.status}`);
              const payload = await response.json().catch(() => null);
              // The availability answer must be a real boolean; anything else is not a ready host.
              if (!payload || typeof payload.available !== "boolean") throw new Error("host-status-invalid");
              return payload;
            };
            let payload;
            if (controller) {
              // Bounds the fetch AND the body read: either can hang on its own.
              const timeout = new Promise((_, reject) => {
                timer = window.setTimeout(() => { controller.abort(); reject(new Error("host-status-timeout")); }, boundedMs);
              });
              payload = await Promise.race([read(), timeout]);
            } else {
              payload = await read();
            }
            emitStatus({ host: payload, error: "", previewError: "" });
            return payload;
          } catch (error) {
            emitStatus({ host: null, error: String(error?.message || "unavailable") });
            return null;
          } finally {
            if (timer) window.clearTimeout(timer);
            if (signal) signal.removeEventListener("abort", onAbort);
          }
        },
        async start(scene = "lucy", mode = DEFAULT_PLAYBACK_MODE) {
          if (disposed || busy || (fenceOwner && !fenceOwner.released)) return status;
          const runAdmission = writeAdmission;
          activeStopId = 0;
          activeStopGeneration = 0;
          busy = true;
          const runGeneration = invalidate();
          emitStatus({ state: "starting", error: "", generation: runGeneration, cleanupPending: false });
          try {
            const { ok, payload } = await command("start", { scene, mode }, { admission: runAdmission });
            // A stop, a source switch or an unload during the request invalidates this run;
            // the late reply must not resurrect it.
            if (disposed || runGeneration !== generation) {
              if (ok) await command("stop", {}, { compensating: true, admission: runAdmission }).catch(() => {});
              return status;
            }
            if (!ok) throw new Error(payload?.error || "start-failed");
            running = true; busy = false;
            startedAt = now(); lastFrameAt = now();
            activeRun = createRunContext(runGeneration);
            activeRun.startedAt = startedAt;
            activeRun.lastFrameAt = lastFrameAt;
            emitStatus({ host: payload, rendered: 0, decodeErrors: 0, mode });
            connect(runGeneration);
            return status;
          } catch (error) {
            if (runGeneration !== generation) return status;
            busy = false; running = false;
            emitStatus({ state: "error", error: String(error?.message || "start-failed") });
            return status;
          }
        },
        async restart(scene = "lucy", mode = DEFAULT_PLAYBACK_MODE) {
          if (disposed || busy || (fenceOwner && !fenceOwner.released)) return status;
          const runAdmission = writeAdmission;
          activeStopId = 0;
          activeStopGeneration = 0;
          busy = true;
          const restartGeneration = invalidate();
          emitStatus({ state: "starting", error: "", generation: restartGeneration, cleanupPending: false });
          try {
            const { ok, payload } = await command("restart", { scene, mode }, { admission: runAdmission });
            if (disposed || restartGeneration !== generation) {
              if (ok) await command("stop", {}, { compensating: true, admission: runAdmission }).catch(() => {});
              return status;
            }
            if (!ok) throw new Error(payload?.error || "restart-failed");
            running = true; busy = false;
            startedAt = now(); lastFrameAt = now();
            activeRun = createRunContext(restartGeneration);
            activeRun.startedAt = startedAt;
            activeRun.lastFrameAt = lastFrameAt;
            emitStatus({ host: payload, rendered: 0, decodeErrors: 0, mode });
            connect(restartGeneration);
            return status;
          } catch (error) {
            // A failed restart stays failed and says why; it does not enter a fake connected state.
            if (restartGeneration !== generation) return status;
            busy = false; running = false;
            emitStatus({ state: "error", error: String(error?.message || "restart-failed") });
            return status;
          }
        },
        stop,
        snapshot,
        readLibrary,
        hasPendingCleanup: () => Boolean(status.cleanupPending || activeStopId !== 0 || activeStopGeneration !== 0),
        getLibrarySnapshot: () => librarySnapshot,
        setLibrarySnapshot: (s) => {
          if (libraryRefreshing) return;
          if (s && s.loaded && s.state === "ready" && !s.loading) {
            libraryRevision++;
            librarySnapshot = Object.freeze({
              ...s,
              items: Array.isArray(s.items) ? s.items.map(cleanLibraryItem).filter(Boolean) : []
            });
          } else {
            librarySnapshot = null;
          }
          for (const listener of libraryListeners) {
            try { listener(librarySnapshot); } catch {}
          }
        },
        subscribeLibrary(listener) {
          libraryListeners.add(listener);
          return () => libraryListeners.delete(listener);
        },
        /** Last close result reported by the Host, or null when nothing was closed yet. */
        lastCleanup: () => lastCleanup,
        dispose() {
          disposed = true;
          activeStopId = 0;
          activeStopGeneration = 0;
          invalidate();
          closeStateListeners.clear();
          hostReadOwner?.cancel("host-read-disposed");
          publishHostClose("disposed", null, null, "host-read-disposed");
          hostCloseListeners.clear();
          fenceRequest?.cancel("fence-disposed");
          publishFence("disposed", fenceOwner, null, "fence-disposed");
          fenceListeners.clear();
          running = false; busy = false;
          abort?.abort(); abort = null;
          window.clearInterval(pollTimer); pollTimer = null;
          if (activeRun.currentSchedule) {
            cancelSchedule(activeRun.currentSchedule);
            activeRun.currentSchedule = null;
            activeRun.waitCancelledCount++;
          }
          frameListeners.clear(); statusListeners.clear(); listeners.clear(); stallListeners.clear();
          activeRun.latest = null;
        },
        recordDraw,
        monotonicNow: monoNow,
        acceptFrame: (frame) => accept(activeRun.generation, frame),
      };
    }

    function createBackdrop(engine) {
      const listeners = new Set();
      const versions = { image: 0, video: 0 };
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      let state = Object.freeze({ status: "off", error: "", media: Object.freeze({ image: null, video: null }) });
      let settings = { ...DEFAULT_SETTINGS };
      let themeActive = false;
      let running = false;
      let mountedKey = "";
      let loadId = 0;
      let layer = null;
      let video = null;
      let objectUrl = null;
      let pendingLoad = null;
      const pendingImports = new Set();
      let mediaWriter = null;
      // Wallpaper Engine preview layer. It is a canvas painted from the authenticated
      // frame stream, so the existing brightness/mask/blur/surface variables apply to it
      // exactly like they do to an image or video, and it never captures pointer events.
      let wallpaperLayer = null;
      let wallpaperPainted = false;
      let wallpaperError = "";

      const releaseMedia = (element) => {
        if (!element) return;
        if (element.tagName === "VIDEO") element.pause();
        element.removeAttribute("src");
        if (element.tagName === "VIDEO") element.load();
      };

      const emit = (patch) => {
        if (!running) return;
        state = Object.freeze({ ...state, ...patch });
        listeners.forEach((listener) => listener());
      };

      const shouldPlay = () => !document.hidden && !reducedMotion.matches &&
        (settings.motion === "always" || document.hasFocus());
      const updatePlayback = () => {
        if (!video) return;
        if (shouldPlay()) video.play().catch(() => {});
        else video.pause();
      };

      // A sticky composer shares the scrollport with a potentially very tall view. A clip measured
      // from that moving view cannot keep up with compositor scrolling. On the recognized host use
      // a stationary native message viewport and dock the existing seat outside its clipping block;
      // keep the measured sibling clip only as a fallback. No opaque cover or React node move.
      const HISTORY_CLIP = "--wm-history-clip-bottom";
      const HISTORY_ATTRIBUTE = "data-wm-history-clip";
      const clippedViews = new Map();
      const historyPorts = new Map();
      const PORT_ATTRIBUTE = "data-wm-message-port";
      const SEAT_ATTRIBUTE = "data-wm-fixed-composer";
      const PORT_PROPERTIES = ["--wm-port-reserve"];
      const SEAT_PROPERTIES = ["--wm-port-width", "--wm-port-left"];
      const rememberPortNode = (node, attribute, properties) => ({
        node, attribute, previous: node.getAttribute(attribute),
        properties: properties.map(name => ({ name, value: node.style.getPropertyValue(name), priority: node.style.getPropertyPriority(name) })),
      });
      const restorePortNode = ({ node, attribute, previous, properties }) => {
        if (previous === null) node.removeAttribute(attribute);
        else node.setAttribute(attribute, previous);
        for (const { name, value, priority } of properties) {
          if (value) node.style.setProperty(name, value, priority);
          else node.style.removeProperty(name);
        }
      };
      const setPortProperty = (node, name, value) => {
        if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
      };
      const atHistoryEnd = scroll => scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop <= 1;
      const restoreHistoryPort = (scroll, state) => {
        const atEnd = scroll.isConnected && atHistoryEnd(scroll);
        restorePortNode(state.scroll);
        restorePortNode(state.seat);
        historyPorts.delete(scroll);
        if (atEnd) scroll.scrollTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
      };
      // The host already supplies a positioned body and a message/seat sibling structure. Keep those
      // nodes: the seat's containing block is the body outside the scrollport, so the native scroll
      // clip only contains messages. Its bottom edge stays on the card's top even during compositor
      // scrolling. No opaque cover, wheel handler, or per-scroll moving clip is needed for this edge.
      const prepareHistoryPort = (scroll, content, seat, card) => {
        if (getComputedStyle(content).position !== "relative") return false;
        let state = historyPorts.get(scroll);
        if (state && state.seat.node !== seat) { restoreHistoryPort(scroll, state); state = null; }
        if (!state) {
          state = { scroll: rememberPortNode(scroll, PORT_ATTRIBUTE, PORT_PROPERTIES), seat: rememberPortNode(seat, SEAT_ATTRIBUTE, SEAT_PROPERTIES) };
          historyPorts.set(scroll, state);
        }
        const atEnd = atHistoryEnd(scroll);
        const bodyRect = content.getBoundingClientRect();
        const scrollRect = scroll.getBoundingClientRect();
        const width = `${scroll.clientWidth}px`;
        const left = `${scrollRect.left + scroll.clientLeft - bodyRect.left - content.clientLeft}px`;
        scroll.setAttribute(PORT_ATTRIBUTE, "");
        seat.setAttribute(SEAT_ATTRIBUTE, "");
        setPortProperty(seat, "--wm-port-width", width);
        setPortProperty(seat, "--wm-port-left", left);
        // Read after docking: growing drafts and toolbar/attachment changes affect the card's top.
        const reserve = `${Math.max(0, bodyRect.bottom - content.clientTop - card.getBoundingClientRect().top)}px`;
        setPortProperty(scroll, "--wm-port-reserve", reserve);
        if (atEnd) scroll.scrollTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
        return true;
      };
      let historyResize = null;
      let historyMutation = null;
      let historyFrame = null;
      let historyTracking = false;
      let historyObserved = new Set();
      const restoreHistoryView = (view, previous) => {
        if (previous.value) view.style.setProperty(HISTORY_CLIP, previous.value, previous.priority);
        else view.style.removeProperty(HISTORY_CLIP);
        if (previous.attribute === null) view.removeAttribute(HISTORY_ATTRIBUTE);
        else view.setAttribute(HISTORY_ATTRIBUTE, previous.attribute);
        clippedViews.delete(view);
      };
      const measureHistory = () => {
        historyFrame = null;
        if (!historyTracking) return;
        const found = new Set();
        const ports = new Set();
        const observed = new Set();
        const scrollElements = typeof document.querySelectorAll === "function" ? document.querySelectorAll("[data-conversation-scroll]") : [];
        for (const scroll of scrollElements) {
          const content = scroll.closest("[data-conversation-content]");
          if (content?.dataset.contentPhase !== "active") continue;
          const seat = scroll.querySelector(":scope > [data-composer-seat]");
          const card = seat?.querySelector(".RlGAzG_card");
          if (!card || !card.getClientRects().length) continue;
          if (prepareHistoryPort(scroll, content, seat, card)) ports.add(scroll);
          const cardTop = card.getBoundingClientRect().top;
          observed.add(content); observed.add(scroll); observed.add(seat); observed.add(card);
          for (const view of scroll.querySelectorAll(":scope > .Dc7zOa_viewArea, :scope > [data-slot='conversation.session'] > .Dc7zOa_viewArea")) {
            if (!view.getClientRects().length) continue;
            found.add(view); observed.add(view);
            if (!clippedViews.has(view)) clippedViews.set(view, {
              value: view.style.getPropertyValue(HISTORY_CLIP),
              priority: view.style.getPropertyPriority(HISTORY_CLIP),
              attribute: view.getAttribute(HISTORY_ATTRIBUTE),
            });
            applyHistoryClip(view, cardTop);
            if (!view.hasAttribute(HISTORY_ATTRIBUTE)) view.setAttribute(HISTORY_ATTRIBUTE, "");
          }
        }
        for (const [view, previous] of clippedViews) if (!found.has(view)) restoreHistoryView(view, previous);
        for (const [scroll, state] of historyPorts) if (!ports.has(scroll)) restoreHistoryPort(scroll, state);
        if (historyResize) {
          for (const target of historyObserved) if (!observed.has(target)) historyResize.unobserve(target);
          for (const target of observed) if (!historyObserved.has(target)) historyResize.observe(target);
        }
        historyObserved = observed;
      };
      // The inset is measured from the view's own border box: `bottom` removes the last `bottom` pixels
      // of that box, so the visible part ends where the card begins. Rounding outward hides subpixel
      // text at the boundary rather than leaving a sliver.
      //
      // This remains a fallback for hosts without the recognized positioned body. On the supported
      // host the native message scrollport is the visible boundary, independent of this moving inset.
      function applyHistoryClip(view, cardTop) {
        const rect = view.getBoundingClientRect();
        const bottom = Math.ceil(Math.max(0, Math.min(rect.height, rect.bottom - cardTop)));
        const value = `${bottom}px`;
        if (view.style.getPropertyValue(HISTORY_CLIP) !== value) view.style.setProperty(HISTORY_CLIP, value);
      }
      // Updating the inset only on the next animation frame left it describing the previous scroll
      // position. Recomputing it here, where the scroll event has already been delivered, reduces that
      // lag at the callback. Whether a frame that reaches the screen can still show text near the card
      // is decided by the painted-frame check, not by this comment: the geometry improvement observed
      // here is not a guarantee about what the compositor presents.
      const updateHistoryClip = () => {
        if (!historyTracking || clippedViews.size === 0) return;
        for (const view of clippedViews.keys()) {
          if (!view.getClientRects().length) continue;
          const scroll = view.closest("[data-conversation-scroll]");
          if (historyPorts.has(scroll)) continue;
          const card = scroll?.querySelector("[data-composer-seat] .RlGAzG_card");
          if (!card || !card.getClientRects().length) continue;
          applyHistoryClip(view, card.getBoundingClientRect().top);
        }
      };
      const queueHistoryMeasure = () => {
        if (historyTracking && historyFrame === null) historyFrame = requestAnimationFrame(measureHistory);
      };
      const onHistoryScroll = () => {
        updateHistoryClip();
        queueHistoryMeasure();
      };
      const startHistoryTracking = () => {
        if (historyTracking) return; // Wallpaper frames must not rebuild observers every frame.
        historyTracking = true;
        if (typeof ResizeObserver === "function") historyResize = new ResizeObserver(queueHistoryMeasure);
        if (typeof MutationObserver === "function") {
          historyMutation = new MutationObserver(queueHistoryMeasure);
          historyMutation.observe(document.getElementById("root") || document.body, {
            childList: true, subtree: true, attributes: true, attributeFilter: ["data-content-phase"],
          });
        }
        document.addEventListener("scroll", onHistoryScroll, true);
        window.addEventListener("resize", queueHistoryMeasure);
        measureHistory();
      };
      function stopHistoryTracking() {
        historyTracking = false;
        historyResize?.disconnect(); historyResize = null;
        historyMutation?.disconnect(); historyMutation = null;
        if (historyFrame !== null) cancelAnimationFrame(historyFrame);
        historyFrame = null;
        document.removeEventListener("scroll", onHistoryScroll, true);
        window.removeEventListener("resize", queueHistoryMeasure);
        for (const [view, previous] of clippedViews) restoreHistoryView(view, previous);
        for (const [scroll, state] of historyPorts) restoreHistoryPort(scroll, state);
        historyObserved.clear();
      }

      const unmount = () => {
        loadId += 1;
        pendingLoad?.abort();
        pendingLoad = null;
        mountedKey = "";
        stopHistoryTracking();
        delete document.body.dataset.wmBackdrop;
        if (layer) releaseMedia(layer.querySelector(".wm-backdrop-media"));
        video = null;
        layer?.remove();
        layer = null;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      };

      const unmountWallpaper = () => {
        stopHistoryTracking();
        wallpaperLayer?.remove();
        wallpaperLayer = null;
        wallpaperPainted = false;
        wallpaperError = "";
        if (document.body.dataset.wmBackdrop === "wallpaper") delete document.body.dataset.wmBackdrop;
      };

      /** Keeps the layer but stops presenting a stale frame (used while waiting to recover). */
      const hideWallpaper = () => {
        if (!wallpaperLayer) return;
        wallpaperPainted = false;
        wallpaperLayer.hidden = true;
        if (document.body.dataset.wmBackdrop === "wallpaper") delete document.body.dataset.wmBackdrop;
      };

      const paintWallpaper = (bitmap, frame) => {
        // A frame is never dropped just because the layer is missing: as long as this source
        // is still the selected one, the layer is (re)created here. A stop removes it, so a
        // new run would otherwise paint into nothing until some unrelated setting change.
        if (!wallpaperLayer && running && settings.background === "wallpaper" && themeActive) mountWallpaper();
        if (!wallpaperLayer || !running) { bitmap.close?.(); return; }
        const canvas = wallpaperLayer.querySelector(".wm-backdrop-media");
        if (!canvas) { bitmap.close?.(); return; }
        if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
          canvas.width = bitmap.width; canvas.height = bitmap.height;
        }
        const mono = engine?.monotonicNow ?? (typeof performance !== "undefined" && typeof performance.now === "function" ? () => performance.now() : () => Date.now());
        const drawStart = mono();
        let drawSuccess = false;
        try {
          canvas.getContext("2d", { alpha: false }).drawImage(bitmap, 0, 0);
          drawSuccess = true;
        } catch {
          drawSuccess = false;
        } finally {
          const drawMs = Math.max(0, mono() - drawStart);
          engine?.recordDraw?.(frame?.generation, drawSuccess, drawMs);
        }
        bitmap.close?.();
        if (drawSuccess) {
          // The layer becomes visible and the UI becomes transparent only together with a
          // real frame, so a loading or stalled preview never leaves the chat see-through.
          wallpaperPainted = true;
          wallpaperLayer.hidden = false;
          document.body.dataset.wmBackdrop = "wallpaper";
          startHistoryTracking();
          wallpaperLayer.dataset.wmSequence = String(frame.sequence);
        }
      };

      const mountWallpaper = () => {
        if (wallpaperLayer) return wallpaperLayer;
        const next = document.createElement("div");
        next.id = "wm-backdrop";
        next.setAttribute("aria-hidden", "true");
        next.dataset.wmKind = "wallpaper";
        next.hidden = true;
        const canvas = document.createElement("canvas");
        canvas.className = "wm-backdrop-media";
        const shade = document.createElement("div");
        shade.className = "wm-backdrop-mask";
        next.append(canvas, shade);
        document.body.prepend(next);
        wallpaperLayer = next;
        // The status channel carries the terminal cases: the preview time limit, a closed
        // stream, a stalled source and errors. The last painted frame is withdrawn and the
        // opaque theme is restored, so nothing stays frozen behind the chat.
        engine?.subscribe({
          onFrame: paintWallpaper,
          onStop: () => unmountWallpaper(),
          // A stall is not a terminal state: keep the layer, stop presenting the stale frame,
          // and let the next real frame bring the picture back.
          onStall: () => hideWallpaper(),
          onStatus: (patch) => {
            const nextError = patch.error ?? wallpaperError;
            if (nextError !== wallpaperError) { wallpaperError = nextError; emit({ error: nextError }); }
            if (["stopped", "error", "cleanup-failed", "idle"].includes(patch.state)) unmountWallpaper();
            else if (patch.state === "waiting") hideWallpaper();
          },
        });
        return next;
      };

      const createMedia = (kind, url, signal, timeoutMs = 20000) => new Promise((resolve, reject) => {
        const element = document.createElement(kind === "image" ? "img" : "video");
        let finished = false;
        const timer = window.setTimeout(() => finish(new Error("decode")), timeoutMs);
        const abort = () => finish(new DOMException("Media load cancelled", "AbortError"));
        const done = () => finish();
        const fail = () => finish(new Error("decode"));
        function finish(error) {
          if (finished) return;
          finished = true;
          window.clearTimeout(timer);
          signal.removeEventListener("abort", abort);
          element.removeEventListener("loadeddata", done);
          element.removeEventListener("error", fail);
          if (error) { releaseMedia(element); reject(error); }
          else resolve(element);
        }
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) { abort(); return; }
        if (kind === "image") {
          element.alt = "";
          element.decoding = "async";
          element.src = url;
          element.decode().then(done, fail);
          return;
        }
        element.muted = true;
        element.defaultMuted = true;
        element.loop = true;
        element.playsInline = true;
        element.preload = "auto";
        element.disablePictureInPicture = true;
        element.setAttribute("muted", "");
        element.addEventListener("loadeddata", done);
        element.addEventListener("error", fail);
        element.src = url;
      });

      const load = async (kind, key) => {
        pendingLoad?.abort();
        const abort = new AbortController();
        pendingLoad = abort;
        const id = ++loadId;
        mountedKey = key;
        emit({ status: "loading", error: "" });
        let record;
        try {
          record = await readMedia(kind);
        } catch {
          if (id === loadId) {
            unmount(); mountedKey = key;
            emit({ status: "error", error: "storage" });
          }
          return;
        }
        if (id !== loadId) return;
        if (!record || !(record.blob instanceof Blob)) {
          unmount();
          mountedKey = key;
          emit({ status: "missing", error: "" });
          return;
        }
        const url = URL.createObjectURL(record.blob);
        let element;
        try {
          element = await createMedia(kind, url, abort.signal);
        } catch {
          URL.revokeObjectURL(url);
          if (id !== loadId) return;
          unmount();
          mountedKey = key;
          emit({ status: "error", error: kind === "video" ? "video-decode" : "image-decode" });
          return;
        }
        if (id !== loadId) {
          releaseMedia(element);
          URL.revokeObjectURL(url);
          return;
        }
        const previousUrl = objectUrl;
        const nextLayer = document.createElement("div");
        nextLayer.id = "wm-backdrop";
        nextLayer.setAttribute("aria-hidden", "true");
        nextLayer.dataset.wmKind = kind;
        element.className = "wm-backdrop-media";
        const shade = document.createElement("div");
        shade.className = "wm-backdrop-mask";
        nextLayer.append(element, shade);
        element.addEventListener("error", () => {
          if (layer !== nextLayer) return;
          unmount(); mountedKey = key;
          emit({ status: "error", error: `${kind}-decode` });
        });
        if (layer) releaseMedia(layer.querySelector(".wm-backdrop-media"));
        layer?.remove();
        document.body.prepend(nextLayer);
        layer = nextLayer;
        video = kind === "video" ? element : null;
        objectUrl = url;
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        document.body.dataset.wmBackdrop = kind;
        startHistoryTracking();
        updatePlayback();
        emit({ status: "ready", error: "" });
      };

      const reconcile = () => {
        if (!running) return;
        const kind = settings.background;
        // Only one background may be active: whichever kind is selected owns the layer.
        if (kind !== "wallpaper" && wallpaperLayer) unmountWallpaper();
        if (kind !== "wallpaper" && engine?.running()) engine.stop("background-changed");
        if (kind === "none" || !themeActive) {
          if (mountedKey) unmount();
          if (state.status !== "off") emit({ status: "off", error: "" });
          return;
        }
        if (kind === "wallpaper") {
          if (mountedKey) unmount();
          mountWallpaper();
          emit({ status: "ready", error: wallpaperError });
          return;
        }
        const key = `${kind}:${versions[kind]}`;
        if (key !== mountedKey) load(kind, key);
        else updatePlayback();
      };

      const refreshInfo = async () => {
        try {
          const [imageRecord, videoRecord] = await Promise.all([readMedia("image"), readMedia("video")]);
          emit({ media: Object.freeze({ image: describeMedia(imageRecord), video: describeMedia(videoRecord) }) });
        } catch {
          emit({ error: "storage" });
        }
      };

      return {
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        getSnapshot: () => state,
        mediaRevisionCurrent: (kind, revision) => running && !mediaWriter && versions[kind] === revision,
        imageRevisionCurrent: revision => running && !mediaWriter && versions.image === revision,
        start(initialSettings, initialThemeActive) {
          running = true;
          settings = initialSettings;
          themeActive = initialThemeActive;
          document.addEventListener("visibilitychange", updatePlayback);
          window.addEventListener("focus", updatePlayback);
          window.addEventListener("blur", updatePlayback);
          reducedMotion.addEventListener("change", updatePlayback);
          refreshInfo();
          reconcile();
        },
        stop() {
          running = false;
          for (const abort of pendingImports) abort.abort();
          pendingImports.clear();
          document.removeEventListener("visibilitychange", updatePlayback);
          window.removeEventListener("focus", updatePlayback);
          window.removeEventListener("blur", updatePlayback);
          reducedMotion.removeEventListener("change", updatePlayback);
          unmount();
          unmountWallpaper();
          objectUrl = null;
          state = Object.freeze({ ...state, status: "off", error: "" });
        },
        update(nextSettings, nextThemeActive = themeActive) {
          settings = nextSettings;
          themeActive = nextThemeActive;
          reconcile();
        },
        async changeLocalMedia(kind, action, file, { signal, isCurrent, timeoutMs }) {
          if (!running || !Object.hasOwn(MEDIA_LIMITS, kind) || mediaWriter || !["replace", "use", "remove"].includes(action)) return { ok: false, error: `${kind}-busy` };
          if (action === "replace" && !validLocalMedia(kind, file)) return { ok: false, error: `${kind}-file-invalid` };
          const owner = {}, abort = new AbortController(), end = performance.now() + timeoutMs;
          mediaWriter = owner; pendingImports.add(abort);
          let transactionPending = false, url = null, mediaSaved = false;
          const current = () => { try { return running && !abort.signal.aborted && !signal.aborted && isCurrent() === true && performance.now() < end; } catch { return false; } };
          const onAbort = () => abort.abort(); signal.addEventListener("abort", onAbort, { once: true });
          const release = () => { if (mediaWriter === owner) mediaWriter = null; };
          const io = async record => {
            transactionPending = true;
            return await changeMediaRecord(kind, record, { signal: abort.signal, isCurrent: current, timeoutMs: Math.max(1, end - performance.now()), onSettled: () => { transactionPending = false; owner.release?.(); } });
          };
          try {
            if (!current()) return { ok: false, error: `${kind}-cancelled` };
            let record = action === "replace" ? { blob: file, name: file.name || "", savedAt: Date.now() } : null;
            if (action === "use") {
              record = await io(undefined);
            }
            if (action !== "remove") {
              if (!(record?.blob instanceof Blob)) return { ok: false, error: `${kind}-missing` };
              if (!validLocalMedia(kind, record.blob)) return { ok: false, error: `${kind}-file-invalid` };
              url = URL.createObjectURL(record.blob);
              const checked = await createMedia(kind, url, abort.signal, Math.max(1, end - performance.now()));
              releaseMedia(checked); URL.revokeObjectURL(url); url = null;
            }
            if (!current()) return { ok: false, error: `${kind}-cancelled` };
            if (action !== "use") {
              // Keep the lane across decode, DB mutation, and presentation invalidation.
              if (mediaWriter !== owner) return { ok: false, error: `${kind}-busy` };
              await io(record);
              mediaSaved = true;
              versions[kind]++;
              emit({ media: Object.freeze({ ...state.media, [kind]: describeMedia(record) }) });
              reconcile();
            } else emit({ media: Object.freeze({ ...state.media, [kind]: describeMedia(record) }) });
            return { ok: true, mediaSaved: action !== "use", revision: versions[kind], current: current() };
          } catch (error) {
            return { ok: false, mediaSaved, error: abort.signal.aborted || !current() ? `${kind}-cancelled` : error.message === `${kind}-storage` ? `${kind}-storage` : `${kind}-decode` };
          } finally {
            if (url) URL.revokeObjectURL(url);
            pendingImports.delete(abort); signal.removeEventListener("abort", onAbort);
            if (!transactionPending) release();
            // A late terminal event may only release this owner's lane, never commit source.
            else {
              const old = owner; owner.release = () => { if (mediaWriter === old) mediaWriter = null; };
            }
          }
        },
        async store(kind, file) {
          if (!running || !Object.hasOwn(MEDIA_LIMITS, kind) || !(file instanceof Blob)) return false;
          if (!file.type.startsWith(`${kind}/`)) {
            emit({ status: "error", error: "type" });
            return false;
          }
          if (file.size > MEDIA_LIMITS[kind]) {
            emit({ status: "error", error: "size" });
            return false;
          }
          if (mediaWriter) return false;
          const owner = {}; mediaWriter = owner;
          try {
          emit({ status: "saving", error: "" });
          // Validate first so an unreadable replacement cannot destroy the saved wallpaper.
          const abort = new AbortController();
          pendingImports.add(abort);
          const checkUrl = URL.createObjectURL(file);
          try {
            const checked = await createMedia(kind, checkUrl, abort.signal);
            releaseMedia(checked);
          } catch (error) {
            if (running && error.name !== "AbortError") emit({ status: "error", error: `${kind}-decode` });
            return false;
          } finally {
            pendingImports.delete(abort);
            URL.revokeObjectURL(checkUrl);
          }
          if (!running) return false;
          try {
            await writeMedia(kind, { blob: file, name: file.name || "", savedAt: Date.now() });
          } catch (error) {
            emit({ status: "error", error: error?.name === "QuotaExceededError" ? "quota" : "storage" });
            return false;
          }
          versions[kind] += 1;
          await refreshInfo();
          if (!running) return false;
          if (state.status === "saving") emit({ status: "off" });
          reconcile();
          return true;
          } finally { if (mediaWriter === owner) mediaWriter = null; }
        },
        async remove(kind) {
          if (!running || !Object.hasOwn(MEDIA_LIMITS, kind)) return;
          if (mediaWriter) return;
          const owner = {}; mediaWriter = owner;
          try {
          try {
            await deleteMedia(kind);
          } catch {
            emit({ status: "error", error: "storage" });
            return;
          }
          versions[kind] += 1;
          await refreshInfo();
          reconcile();
          } finally { if (mediaWriter === owner) mediaWriter = null; }
        }
      };
    }

    function selectedThemeId(settings) {
      return THEME_IDS[settings.theme] ?? ABYSS_THEME_ID;
    }

    function createBooleanSignal(initialValue = false) {
      let value = initialValue;
      const listeners = new Set();
      return Object.freeze({
        getSnapshot: () => value,
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        set: (nextValue) => {
          if (value === nextValue) return;
          value = nextValue;
          listeners.forEach((listener) => listener());
        }
      });
    }

    const theme = Object.freeze({
      id: THEME_ID,
      colorScheme: "light",
      tokens: Object.freeze({
        "--dsw-alias-bg-base": "rgba(239, 247, 254, 0.78)",
        "--dsw-alias-bg-primary": "rgba(247, 251, 255, 0.7)",
        "--dsw-alias-bg-layer-1": "rgba(255, 255, 255, 0.62)",
        "--dsw-alias-bg-layer-2": "rgba(230, 242, 251, 0.7)",
        "--dsw-alias-bg-layer-3": "rgba(252, 254, 255, 0.78)",
        "--dsw-alias-bg-overlay": "rgba(248, 252, 255, 0.86)",
        "--dsw-alias-bg-mask-1": "rgba(11, 44, 67, 0.16)",
        "--dsw-alias-bg-module-platform": "rgba(218, 235, 249, 0.58)",

        "--dsw-alias-border-l1": "rgba(255, 255, 255, 0.78)",
        "--dsw-alias-border-l2": "rgba(54, 101, 136, 0.16)",
        "--dsw-alias-border-l2-darkmode-thin": "rgba(54, 101, 136, 0.18)",
        "--dsw-alias-border-l3": "rgba(54, 101, 136, 0.23)",
        "--dsw-alias-border-l4": "rgba(36, 77, 107, 0.32)",
        "--dsw-alias-border-secondary": "rgba(54, 101, 136, 0.18)",
        "--dsw-alias-border-inverted": "rgba(255, 255, 255, 0.72)",
        "--dsw-alias-line-secondary": "rgba(54, 101, 136, 0.14)",
        "--dsw-alias-separator-primary": "rgba(54, 101, 136, 0.13)",

        "--dsw-alias-label-primary": "#153047",
        "--dsw-alias-label-primary-bluish": "#163b57",
        "--dsw-alias-label-primary-foreground": "#0a263d",
        "--dsw-alias-label-secondary": "#62798c",
        "--dsw-alias-label-tertiary": "#8094a5",
        "--dsw-alias-label-quaternary": "#9aabba",
        "--dsw-alias-label-caption": "#6f879a",
        "--dsw-alias-label-dimmed": "#8da0af",
        "--dsw-alias-label-primary-dimmed": "#7890a2",
        "--dsw-alias-label-inverse": "#f8fcff",
        "--dsw-alias-label-error": "#b14754",

        "--dsw-alias-brand-primary": "#1468a8",
        "--dsw-alias-brand-primary-new-colorprimary-new-color": "#1468a8",
        "--dsw-alias-button-primary-fill": "#1468a8",
        "--dsw-alias-button-primary-hover": "#0f5e97",
        "--dsw-alias-button-info-fill": "rgba(20, 104, 168, 0.12)",
        "--dsw-alias-button-info-hover": "rgba(20, 104, 168, 0.18)",
        "--dsw-alias-button-elevated-fill": "rgba(255, 255, 255, 0.58)",
        "--dsw-alias-button-floating-fill": "rgba(252, 254, 255, 0.74)",
        "--dsw-alias-button-floating-hover": "rgba(255, 255, 255, 0.9)",
        "--dsw-alias-button-ghost-active-fill": "rgba(33, 128, 193, 0.15)",

        "--dsw-alias-interactive-bg-primary": "rgba(33, 128, 193, 0.12)",
        "--dsw-alias-interactive-bg-hover": "rgba(33, 128, 193, 0.09)",
        "--dsw-alias-interactive-bg-active": "rgba(33, 128, 193, 0.15)",
        "--dsw-alias-interactive-bg-hover-solid": "#e6f2fb",
        "--dsw-alias-interactive-bg-hover-danger": "rgba(184, 72, 84, 0.1)",
        "--dsw-alias-fill-l2": "rgba(89, 133, 165, 0.14)",
        "--dsw-alias-fill-tsp-secondary": "rgba(255, 255, 255, 0.44)",

        "--dsw-alias-scrollbar-bg-l2": "rgba(62, 105, 136, 0.2)",
        "--dsw-alias-scrollbar-hover-l2": "rgba(48, 90, 121, 0.32)",
        "--dsw-alias-markdown-citation": "#1468a8",
        "--dsw-alias-markdown-code-block": "rgba(223, 237, 248, 0.72)",
        "--dsw-alias-markdown-code-block-banner": "rgba(213, 231, 245, 0.84)",

        "--dsw-alias-state-business-primary": "#1468a8",
        "--dsw-alias-state-business-tertiary": "rgba(20, 104, 168, 0.13)",
        "--dsw-alias-state-success-primary": "#2b8164",
        "--dsw-alias-state-success-tertiary": "rgba(43, 129, 100, 0.12)",
        "--dsw-alias-state-warn-primary": "#a96a22",
        "--dsw-alias-state-warn-secondary": "#bd7e35",
        "--dsw-alias-state-warn-tertiary": "rgba(169, 106, 34, 0.12)",
        "--dsw-alias-state-warn-label": "#87541b",
        "--dsw-alias-state-error-primary": "#b14754",
        "--dsw-alias-state-error-secondary": "#c35a66",

        "--dsw-font-family": "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
        "--dsw-font-mono": "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
        "--dsw-mask-blur": "blur(24px) saturate(132%)",
        "--dsw-shadow-lv1": "0 1px 2px rgba(36, 76, 106, 0.06), 0 5px 16px rgba(45, 91, 124, 0.06)",
        "--dsw-shadow-lv2": "0 1px 2px rgba(36, 76, 106, 0.07), 0 15px 40px rgba(45, 91, 124, 0.11)",
        "--dsw-shadow-lv3": "0 3px 8px rgba(36, 76, 106, 0.08), 0 28px 70px rgba(45, 91, 124, 0.16)",

        "--dsw-specific-sidebar-fill": "rgba(220, 237, 250, 0.76)",
        "--dsw-specific-sidebar-nav-item-active": "rgba(255, 255, 255, 0.64)",
        "--dsw-specific-sidebar-nav-item-active-accent": "#4aa4dd",
        "--dsw-specific-sidebar-nav-item-hover": "rgba(255, 255, 255, 0.46)",
        "--dsw-specific-input-major": "linear-gradient(180deg, #fbfdff 0%, #f4f9fd 100%)",
        "--dsw-specific-bubble": "rgba(210, 233, 250, 0.68)",
        "--dsw-specific-menu": "rgba(249, 252, 255, 0.88)",
        "--dsw-specific-selector": "rgba(255, 255, 255, 0.66)",
        "--dsw-specific-tip": "rgba(238, 247, 254, 0.9)"
      })
    });

    const abyssTheme = Object.freeze({
      id: ABYSS_THEME_ID,
      colorScheme: "dark",
      tokens: Object.freeze({
        "--dsw-alias-bg-base": "#080b14",
        "--dsw-alias-bg-primary": "#0b111d",
        "--dsw-alias-bg-layer-1": "rgba(15, 23, 38, 0.94)",
        "--dsw-alias-bg-layer-2": "rgba(23, 34, 54, 0.92)",
        "--dsw-alias-bg-layer-3": "rgba(28, 40, 62, 0.96)",
        "--dsw-alias-bg-overlay": "rgba(23, 34, 54, 0.98)",
        "--dsw-alias-bg-mask-1": "rgba(2, 5, 12, 0.68)",
        "--dsw-alias-bg-module-platform": "rgba(20, 30, 48, 0.9)",

        "--dsw-alias-border-l1": "rgba(231, 236, 245, 0.06)",
        "--dsw-alias-border-l2": "rgba(125, 145, 177, 0.16)",
        "--dsw-alias-border-l2-darkmode-thin": "rgba(125, 145, 177, 0.13)",
        "--dsw-alias-border-l3": "rgba(125, 145, 177, 0.23)",
        "--dsw-alias-border-l4": "rgba(151, 168, 194, 0.32)",
        "--dsw-alias-border-secondary": "rgba(125, 145, 177, 0.18)",
        "--dsw-alias-border-inverted": "rgba(231, 236, 245, 0.14)",
        "--dsw-alias-line-secondary": "rgba(125, 145, 177, 0.13)",
        "--dsw-alias-separator-primary": "rgba(125, 145, 177, 0.12)",

        "--dsw-alias-label-primary": "#e7ecf5",
        "--dsw-alias-label-primary-bluish": "#dce5f5",
        "--dsw-alias-label-primary-foreground": "#080b14",
        "--dsw-alias-label-secondary": "#a7b2c5",
        "--dsw-alias-label-tertiary": "#7f8da5",
        "--dsw-alias-label-quaternary": "#647188",
        "--dsw-alias-label-caption": "#8f9db3",
        "--dsw-alias-label-dimmed": "#657188",
        "--dsw-alias-label-primary-dimmed": "#b5bfd0",
        "--dsw-alias-label-inverse": "#080b14",
        "--dsw-alias-label-error": "#ff8795",

        "--dsw-alias-brand-primary": "#8c72f2",
        "--dsw-alias-brand-primary-new-colorprimary-new-color": "#8c72f2",
        "--dsw-alias-button-primary-fill": "#7d63de",
        "--dsw-alias-button-primary-hover": "#9078ed",
        "--dsw-alias-button-info-fill": "rgba(140, 114, 242, 0.18)",
        "--dsw-alias-button-info-hover": "rgba(140, 114, 242, 0.26)",
        "--dsw-alias-button-elevated-fill": "rgba(31, 44, 68, 0.92)",
        "--dsw-alias-button-floating-fill": "rgba(24, 35, 56, 0.96)",
        "--dsw-alias-button-floating-hover": "rgba(36, 49, 74, 0.98)",
        "--dsw-alias-button-ghost-active-fill": "rgba(140, 114, 242, 0.2)",

        "--dsw-alias-interactive-bg-primary": "rgba(140, 114, 242, 0.16)",
        "--dsw-alias-interactive-bg-hover": "rgba(231, 236, 245, 0.07)",
        "--dsw-alias-interactive-bg-active": "rgba(140, 114, 242, 0.2)",
        "--dsw-alias-interactive-bg-hover-solid": "#1b2940",
        "--dsw-alias-interactive-bg-hover-danger": "rgba(255, 91, 111, 0.14)",
        "--dsw-alias-fill-l2": "rgba(125, 145, 177, 0.16)",
        "--dsw-alias-fill-tsp-secondary": "rgba(231, 236, 245, 0.08)",

        "--dsw-alias-scrollbar-bg-l2": "rgba(111, 128, 157, 0.28)",
        "--dsw-alias-scrollbar-hover-l2": "rgba(151, 168, 194, 0.42)",
        "--dsw-alias-markdown-citation": "#a992ff",
        "--dsw-alias-markdown-code-block": "rgba(10, 16, 28, 0.94)",
        "--dsw-alias-markdown-code-block-banner": "rgba(19, 29, 47, 0.98)",

        "--dsw-alias-state-business-primary": "#9a82f5",
        "--dsw-alias-state-business-tertiary": "rgba(140, 114, 242, 0.2)",
        "--dsw-alias-state-success-primary": "#64cda2",
        "--dsw-alias-state-success-tertiary": "rgba(72, 177, 136, 0.16)",
        "--dsw-alias-state-warn-primary": "#e3a85d",
        "--dsw-alias-state-warn-secondary": "#efbb78",
        "--dsw-alias-state-warn-tertiary": "rgba(227, 168, 93, 0.16)",
        "--dsw-alias-state-warn-label": "#efbb78",
        "--dsw-alias-state-error-primary": "#ff7185",
        "--dsw-alias-state-error-secondary": "#ff8fa0",

        "--dsw-font-family": "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
        "--dsw-font-mono": "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
        "--dsw-mask-blur": "blur(22px) saturate(118%)",
        "--dsw-shadow-lv1": "0 1px 2px rgba(0, 0, 0, 0.3), 0 8px 22px rgba(1, 4, 12, 0.24)",
        "--dsw-shadow-lv2": "0 2px 5px rgba(0, 0, 0, 0.34), 0 18px 46px rgba(1, 4, 12, 0.38)",
        "--dsw-shadow-lv3": "0 5px 12px rgba(0, 0, 0, 0.38), 0 32px 78px rgba(1, 4, 12, 0.5)",

        "--dsw-specific-sidebar-fill": "rgba(15, 23, 38, 0.94)",
        "--dsw-specific-sidebar-nav-item-active": "rgba(140, 114, 242, 0.16)",
        "--dsw-specific-sidebar-nav-item-active-accent": "#8c72f2",
        "--dsw-specific-sidebar-nav-item-hover": "rgba(231, 236, 245, 0.06)",
        "--dsw-specific-input-major": "linear-gradient(180deg, #172236 0%, #121b2c 100%)",
        "--dsw-specific-bubble": "rgba(72, 56, 119, 0.46)",
        "--dsw-specific-menu": "rgba(19, 29, 47, 0.98)",
        "--dsw-specific-selector": "rgba(28, 40, 62, 0.94)",
        "--dsw-specific-tip": "rgba(23, 34, 54, 0.96)"
      })
    });

    function WhaleAppearanceSettings({ controller }) {
      const h = React.createElement;
      const [settings, setSettings] = React.useState(() => controller.read());
      const mediaState = React.useSyncExternalStore(controller.media.subscribe, controller.media.getSnapshot);
      const wallpaperStatus = React.useSyncExternalStore(controller.wallpaper.subscribeStatus, controller.wallpaper.getStatus);
      const [busy, setBusy] = React.useState(false);
      const [previewBusy, setPreviewBusy] = React.useState(false);
      // A control-level failure (the action itself refusing to run) is shown in the status
      // row, so the buttons can be used again without hiding what went wrong.
      const [previewActionError, setPreviewActionError] = React.useState("");
      // The bounded wallpaper list. It is read on demand (the settings panel opening) and on an
      // explicit refresh; a status poll, a frame or a re-render never scans the library.
      const [library, setLibrary] = React.useState(() => {
        const existing = typeof controller?.wallpaper?.getLibrarySnapshot === "function"
          ? controller.wallpaper.getLibrarySnapshot()
          : null;
        return existing ?? { items: [], state: "idle", loaded: false, loading: false, truncated: false, error: "", scannedAt: null, rootWarnings: [] };
      });
      const presetsState = React.useSyncExternalStore(controller.presets.subscribe, controller.presets.getSnapshot);
      const [presetActionError, setPresetActionError] = React.useState("");
      const libraryRequest = React.useRef(0);
      const libraryAbort = React.useRef(null);
      const mounted = React.useRef(true);
      React.useEffect(() => () => {
        mounted.current = false;
        libraryAbort.current?.abort?.();
      }, []);
      const loadLibrary = React.useCallback(async (refresh = false) => {
        const request = ++libraryRequest.current;
        libraryAbort.current?.abort?.();
        const controllerForRead = typeof AbortController === "function" ? new AbortController() : null;
        libraryAbort.current = controllerForRead;
        setLibrary(current => ({ ...current, loading: true }));
        try {
          // Opening the area asks for a list, not just a cache peek: `ensure` lets the Host perform
          // the first bounded scan. With a snapshot already present the Host answers from the cache,
          // so reopening the area does not walk the library again.
          const payload = await controller.wallpaper.readLibrary({ refresh, ensure: !refresh, signal: controllerForRead?.signal });
          // A late answer from a superseded read (or an unmounted panel) must not replace the
          // current list.
          if (!mounted.current || request !== libraryRequest.current) return;
          setLibrary({ ...payload, loading: false });
        } catch (error) {
          if (!mounted.current || request !== libraryRequest.current) return;
          setLibrary(current => ({ ...current, loading: false, state: "failed", error: String(error?.message || "library-failed") }));
        }
      }, [controller]);
      // On-demand load: opening the settings area loads the list once (scanning on the first open
      // and reading the cache afterwards); it never starts or stops playback.
      React.useEffect(() => { loadLibrary(false); }, [loadLibrary]);
      const inputs = React.useRef({});
      const chinese = (navigator.language || "").toLowerCase().startsWith("zh");
      const copy = chinese ? {
        title: "鲸系外观",
        badge: "Whale",
        description: "选择浅雾或深色配色，可设置图片或视频背景；输入卡片始终保持不透明。",
        reset: "恢复默认",
        readabilityTitle: "界面可读性",
        textContrast: "文字可读性",
        textContrastStandardHint: "保持主题原有文字，跟随系统高对比度",
        textContrastEnhancedHint: "提高正文、次要说明和普通工具行的区分，不改变状态含义",
        enhanced: "增强",
        chatBackdrop: "聊天底色强度",
        chatBackdropHint: "0%保留壁纸，100%使用主题实色；覆盖整个聊天列，与侧栏/卡片不透明度分开",
        theme: "主题",
        themeHint: "在鲸雾蓝与鲸渊深色之间切换",
        mist: "鲸雾",
        abyss: "鲸渊",
        palette: "深色配色",
        paletteHint: "鲸渊的主题底色；跟随主题时同时决定强调色",
        ocean: "深海",
        graphite: "石墨",
        violet: "暗紫",
        jade: "墨绿",
        accentMode: "强调色",
        accentTheme: "跟随主题",
        accentCustom: "自定义",
        accentHint: "按钮使用所选颜色；链接、高亮和焦点会随主题调整深浅以便识别。跟随主题恢复原配色",
        customAccent: "自定义颜色",
        customAccentHint: "仅使用 6 位十六进制色值；自动调整文字与焦点对比度",
        previewButton: "主按钮",
        previewLink: "链接",
        canvas: "背景层次",
        canvasHint: "控制主画布的雾感与边界清晰度",
        soft: "柔雾",
        clear: "清晰",
        sidebar: "侧栏层次",
        sidebarHint: "只改变侧栏与会话区的明度关系",
        balanced: "均衡",
        deep: "稍深",
        glass: "玻璃强度",
        glassHint: "影响浮层和菜单，不影响输入卡片",
        standard: "标准",
        restrained: "克制",
        wallpaper: "背景壁纸",
        background: "背景",
        backgroundHint: "文件保存在本机；恢复默认会关闭背景，但保留已选文件",
        none: "无",
        image: "图片",
        video: "视频",
        wallpaperEngine: "Wallpaper Engine（实验）",
        wallpaperEngineHint: "从本机已登记的壁纸里选择；只有 Lucy 经过实机验收，其它场景属于实验播放",
        scene: "壁纸列表",
        sceneHint: "只列出本机工坊里已登记的项目，点击选中；不可用项会说明原因",
        sceneRefresh: "刷新壁纸列表",
        sceneRefreshing: "正在扫描…",
        sceneEmpty: "没有登记到壁纸。确认工坊目录存在后刷新",
        sceneLoading: "正在读取列表…",
        sceneLoadFailed: "列表读取失败",
        sceneUnconfigured: "本机未配置壁纸库目录",
        sceneTruncated: "列表已达到扫描上限，只显示部分结果",
        sceneRootMissing: "配置的壁纸目录不可用",
        sceneVerified: "已验证样例",
        sceneExperimental: "未验证，实验播放",
        sceneUnavailable: "不可用",
        sceneReasonUnsupported: "本版本仅支持 scene、MP4 视频和本地 HTML 网页壁纸",
        sceneReasonUnknownType: "类型未知",
        sceneReasonMissing: "文件登记不完整",
        sceneReasonUnsafe: "路径不安全",
        sceneReasonOther: "不可播放",
        selectedItem: "本次选择",
        playingItem: "当前播放",
        notPlaying: "未播放",
        selectedUnavailable: "所选壁纸已不可用",
        selectedPending: "正在等待列表确认所选壁纸，确认前不能开始",
        autoStartSkipped: "未验证的壁纸不会自动播放，请手动点「开始播放」",
        playMode: "播放模式",
        modeDaily: "日常（持续播放）",
        modePreview: "预览（限时）",
        autoStart: "随 DSH 启动自动播放",
        autoStartHint: "只保存下一次启动的选择；本次仍需点「开始播放」",
        startPreview: "开始播放",
        stopPreview: "停止播放",
        restartPreview: "重新开始",
        previewIdle: "未开始。点击「开始播放」创建本轮源窗口",
        previewStarting: "正在创建源窗口…",
        previewConnecting: "已连接，等待第一帧…",
        previewWaiting: "画面暂时中断，等待恢复…",
        previewLimit: "预览上限",
        previewPlaying: "预览中",
        dailyPlaying: "持续播放中",
        runningFor: "已运行",
        framesThisRun: "本轮帧数",
        previewStopped: "已停止。停止或失效后源窗口已清理",
        previewCleanupFailed: "关闭未确认，源窗口可能仍在；可再次点击重试清理",
        retryCleanup: "重试清理",
        errorUnavailable: "Wallpaper Engine 播放当前不可用",
        errorHelper: "缺少打包的原生采集程序",
        errorScene: "本机缺少已验证的样例工程",
        errorPlatform: "此环境不支持 Wallpaper Engine 播放",
        errorHost: "官方 Windows Desktop 之外不启动播放",
        imageFile: "图片文件",
        videoFile: "视频文件",
        imageEmpty: "未选择 · 支持 JPG / PNG / WebP / GIF，≤ 64 MB",
        videoEmpty: "未选择 · 建议 H.264 MP4 或 WebM，≤ 1 GB，静音循环",
        choose: "选择",
        replace: "更换",
        remove: "移除",
        brightness: "背景亮度",
        brightnessHint: "100%保留原亮度，可继续提亮；最终效果还受遮罩和界面底色影响",
        mask: "遮罩",
        maskHint: "叠加主题底色；数值越大，主题底色覆盖越强，0%关闭这层遮罩",
        blur: "模糊",
        blurHint: "柔化壁纸细节，视频较大时会增加显卡负担",
        surface: "界面不透明度",
        surfaceHint: "侧栏与卡片；菜单和输入卡片保持不透明",
        regionTitle: "区域底色",
        opaqueSidebar: "左侧项目／会话栏使用不透明底色",
        opaqueSidebarHint: "勾选后用主题侧栏实色，未勾选沿用现有底色与界面不透明度",
        opaqueChat: "聊天区（含会话标题与标签栏）使用不透明底色",
        opaqueChatHint: "勾选后盖住整个右侧聊天列，包括会话标题与「对话／轨迹」标签栏；输入卡片与窗口顶条不受影响",
        motion: "视频播放",
        motionHint: "窗口最小化或隐藏时总是暂停",
        focus: "失焦暂停",
        always: "始终播放",
        status: {
          loading: "正在载入背景…",
          saving: "正在保存到本机…",
          missing: "尚未选择该类型的文件",
          storage: "本机存储不可用，背景未能读取或保存",
          quota: "本机存储空间不足，请换一个较小的文件",
          type: "文件类型不符",
          size: "文件超过大小上限",
          "image-decode": "这张图片无法解码",
          "video-decode": "视频无法播放，建议转为 H.264 MP4 或 WebM"
        },
        presetTitle: "壁纸外观预设",
        presetHint: "每张壁纸保存一份亮度、遮罩、模糊与不透明度；手动应用到当前外观，全局恢复默认不删除预设",
        presetSelectedTarget: "所选壁纸",
        presetPlayingTarget: "播放壁纸",
        presetSaved: "已保存预设",
        presetEmpty: "未保存预设",
        presetSave: "保存当前外观",
        presetApply: "应用已保存外观",
        presetDelete: "删除预设",
        presetMismatch: "请先停止当前播放或切换到所选壁纸",
        presetBusy: "播放状态切换中，预设暂不可用",
        presetStorageError: "本机存储不可用，无法保存预设"
      } : {
        title: "Whale appearance",
        badge: "Whale",
        description: "Choose mist or a dark palette, and optionally an image or video background. The composer stays opaque.",
        reset: "Reset",
        readabilityTitle: "Interface readability",
        textContrast: "Text readability",
        textContrastStandardHint: "Preserves original theme text and follows system high contrast",
        textContrastEnhancedHint: "Increases separation between body text, secondary notes, and normal tool rows without altering semantic states",
        enhanced: "Enhanced",
        chatBackdrop: "Chat backdrop opacity",
        chatBackdropHint: "0% preserves wallpaper, 100% uses solid theme color; covers the whole chat column, separate from sidebar/card opacity",
        theme: "Theme",
        themeHint: "Switch between Whale Mist and Whale Abyss",
        mist: "Mist",
        abyss: "Abyss",
        palette: "Dark palette",
        paletteHint: "Base color for Whale Abyss; also decides accent color when following theme",
        ocean: "Ocean",
        graphite: "Graphite",
        violet: "Violet",
        jade: "Jade",
        accentMode: "Accent color",
        accentTheme: "Follow theme",
        accentCustom: "Custom",
        accentHint: "Buttons use the selected color; links, highlights, and focus rings adapt to maintain readability across themes. Follow theme restores default colors.",
        customAccent: "Custom color",
        customAccentHint: "6-digit hex color only; text and focus contrast adjust automatically",
        previewButton: "Primary button",
        previewLink: "Link",
        canvas: "Canvas depth",
        canvasHint: "Controls mist and edge separation on the main canvas",
        soft: "Soft",
        clear: "Clear",
        sidebar: "Sidebar depth",
        sidebarHint: "Changes only the brightness relationship with conversation",
        balanced: "Balanced",
        deep: "Deeper",
        glass: "Glass strength",
        glassHint: "Affects overlays and menus, never the composer",
        standard: "Standard",
        restrained: "Restrained",
        wallpaper: "Wallpaper",
        background: "Background",
        backgroundHint: "Stored locally. Reset turns the background off and keeps your chosen files.",
        none: "None",
        image: "Image",
        video: "Video",
        wallpaperEngine: "Wallpaper Engine (experimental)",
        wallpaperEngineHint: "Pick from the wallpapers registered on this machine; only Lucy has a supervised acceptance, everything else is experimental",
        scene: "Wallpapers",
        sceneHint: "Lists the projects registered in the local workshop folder; click to select, unavailable items say why",
        sceneRefresh: "Refresh list",
        sceneRefreshing: "Scanning…",
        sceneEmpty: "No wallpaper registered. Check the workshop folder and refresh",
        sceneLoading: "Reading the list…",
        sceneLoadFailed: "The list could not be read",
        sceneUnconfigured: "No wallpaper library folder is configured",
        sceneTruncated: "The list hit the scan limit and shows only part of the result",
        sceneRootMissing: "A configured wallpaper folder is unavailable",
        sceneVerified: "Verified sample",
        sceneExperimental: "Unverified, experimental",
        sceneUnavailable: "Unavailable",
        sceneReasonUnsupported: "This version supports scenes, MP4 videos and local HTML web wallpapers only",
        sceneReasonUnknownType: "Unknown type",
        sceneReasonMissing: "Incomplete file registration",
        sceneReasonUnsafe: "Unsafe path",
        sceneReasonOther: "Not playable",
        selectedItem: "Next selection",
        playingItem: "Now playing",
        notPlaying: "Nothing",
        selectedUnavailable: "The selected wallpaper is no longer available",
        selectedPending: "Waiting for the list to confirm this wallpaper; it cannot start yet",
        autoStartSkipped: "Unverified wallpapers never start automatically; use Start playing",
        playMode: "Playback",
        modeDaily: "Daily (continuous)",
        modePreview: "Preview (time-boxed)",
        autoStart: "Start playing with DSH",
        autoStartHint: "Saves the choice for the next launch; this session still needs the play button",
        startPreview: "Start playing",
        stopPreview: "Stop playing",
        restartPreview: "Restart",
        previewIdle: "Not running. Start playing creates this round's source window",
        previewStarting: "Creating the source window…",
        previewConnecting: "Connected, waiting for the first frame…",
        previewWaiting: "Frames paused; waiting to recover…",
        previewLimit: "limit",
        previewPlaying: "Previewing",
        dailyPlaying: "Playing continuously",
        runningFor: "running for",
        framesThisRun: "frames this run",
        previewStopped: "Stopped. The source window was cleaned up",
        previewCleanupFailed: "Close not confirmed; the source window may still exist. Retry to clean it up",
        retryCleanup: "Retry cleanup",
        errorUnavailable: "The Wallpaper Engine playback is unavailable",
        errorHelper: "The packaged native capture helper is missing",
        errorScene: "The verified local sample is missing",
        errorPlatform: "This environment does not support Wallpaper Engine playback",
        errorHost: "Playback only starts inside the official Windows desktop",
        imageFile: "Image file",
        videoFile: "Video file",
        imageEmpty: "None · JPG / PNG / WebP / GIF, up to 64 MB",
        videoEmpty: "None · H.264 MP4 or WebM recommended, up to 1 GB, muted loop",
        choose: "Choose",
        replace: "Replace",
        remove: "Remove",
        brightness: "Brightness",
        brightnessHint: "100% preserves original brightness, higher values brighten further; final look is also affected by scrim and surface opacity",
        mask: "Scrim",
        maskHint: "Overlays the theme base colour; higher values cover more, 0% turns this scrim off",
        blur: "Blur",
        blurHint: "Softens detail; costs more GPU on large videos",
        surface: "Surface opacity",
        surfaceHint: "Sidebar and cards; menus and the composer stay opaque",
        regionTitle: "Region backgrounds",
        opaqueSidebar: "Give the project/session sidebar an opaque background",
        opaqueSidebarHint: "Uses the theme's sidebar colour; unchecked keeps the current fill and surface opacity",
        opaqueChat: "Give the chat area (session title and tabs included) an opaque background",
        opaqueChatHint: "Covers the whole right-hand column, including the session title and the conversation/trace tabs; the composer and the window title bar are unaffected",
        motion: "Video playback",
        motionHint: "Always pauses while minimized or hidden",
        focus: "Pause when unfocused",
        always: "Always play",
        status: {
          loading: "Loading background…",
          saving: "Saving locally…",
          missing: "No file chosen for this type yet",
          storage: "Local storage is unavailable",
          quota: "Not enough local storage; try a smaller file",
          type: "Unsupported file type",
          size: "File exceeds the size limit",
          "image-decode": "This image could not be decoded",
          "video-decode": "This video cannot play; try H.264 MP4 or WebM"
        },
        presetTitle: "Wallpaper appearance preset",
        presetHint: "Saves brightness, scrim, blur, and opacity per wallpaper; manually apply to current look; global reset preserves presets",
        presetSelectedTarget: "Selected wallpaper",
        presetPlayingTarget: "Playing wallpaper",
        presetSaved: "Preset saved",
        presetEmpty: "No preset saved",
        presetSave: "Save current look",
        presetApply: "Apply saved look",
        presetDelete: "Delete preset",
        presetMismatch: "Stop current playback or switch to the selected wallpaper first",
        presetBusy: "Playback in transition; presets temporarily unavailable",
        presetStorageError: "Local storage unavailable; cannot save preset"
      };

      const update = (key, value) => {
        setSettings(controller.set(key, value));
      };
      const reset = () => {
        setSettings(controller.reset());
      };
      const row = (key, label, hint, values) => h("div", {
        className: "wm-settings-row",
        key
      }, [
        h("div", { className: "wm-settings-copy", key: "copy" }, [
          h("div", { className: "wm-settings-label", key: "label" }, label),
          h("div", { className: "wm-settings-hint", key: "hint" }, hint)
        ]),
        h("div", {
          className: "wm-settings-segment",
          role: "group",
          "aria-label": label,
          key: "segment"
        }, values.map((value) => h("button", {
          type: "button",
          className: `wm-settings-option${settings[key] === value ? " is-selected" : ""}`,
          "aria-pressed": settings[key] === value,
          "data-wm-setting": key,
          "data-wm-value": value,
          onClick: () => update(key, value),
          key: value
        }, key === "palette" ? [
          h("span", { className: "wm-palette-swatch", "aria-hidden": "true", key: "swatch",
            style: { background: `linear-gradient(135deg, ${PALETTE_SWATCHES[value][0]} 50%, ${PALETTE_SWATCHES[value][1]} 50%)` } }),
          copy[value]
        ] : key === "accentMode" ? (value === "theme" ? copy.accentTheme : copy.accentCustom)
          : key === "background" && value === "wallpaper" ? copy.wallpaperEngine : copy[value])))
      ]);

      const customAccentRow = () => h("div", {
        className: "wm-settings-row wm-accent-custom-row",
        key: "accent-custom"
      }, [
        h("div", { className: "wm-settings-copy", key: "copy" }, [
          h("div", { className: "wm-settings-label", key: "label" }, copy.customAccent),
          h("div", { className: "wm-settings-hint", key: "hint" }, copy.customAccentHint)
        ]),
        h("div", { className: "wm-accent-controls", key: "controls" }, [
          h("input", {
            type: "color",
            className: "wm-accent-picker",
            key: "picker",
            value: settings.accentColor,
            "aria-label": copy.customAccent,
            "data-wm-setting": "accentColor",
            onChange: (event) => update("accentColor", event.currentTarget.value),
            onInput: (event) => update("accentColor", event.currentTarget.value)
          }),
          h("span", {
            className: "wm-accent-hex",
            key: "hex",
            "data-wm-accent-hex": settings.accentColor
          }, settings.accentColor),
          h("div", { className: "wm-accent-preview", key: "preview" }, [
            h("button", {
              type: "button",
              className: "wm-accent-preview-button",
              key: "preview-button",
              "data-wm-preview": "button",
              tabIndex: -1,
              style: {
                background: "var(--dsw-alias-button-primary-fill)",
                color: "var(--dsw-alias-label-primary-foreground)"
              }
            }, copy.previewButton),
            h("span", {
              className: "wm-accent-preview-link",
              key: "preview-link",
              "data-wm-preview": "link",
              style: {
                color: "var(--dsw-alias-link)"
              }
            }, copy.previewLink)
          ])
        ])
      ]);

      const range = (key) => h("label", { className: "wm-settings-row", key }, [
        h("span", { className: "wm-settings-copy", key: "copy" }, [
          h("span", { className: "wm-settings-label", key: "label" }, copy[key]),
          h("span", { className: "wm-settings-hint", key: "hint" }, copy[`${key}Hint`])
        ]),
        h("span", { className: "wm-range-control", key: "range" }, [
          h("input", { type: "range", min: RANGE_SETTINGS[key][0], max: RANGE_SETTINGS[key][1], step: 1,
            value: settings[key], "aria-label": copy[key], "data-wm-setting": key,
            onChange: (event) => update(key, Number(event.currentTarget.value)), key: "input" }),
          h("output", { key: "output" }, `${settings[key]}${key === "blur" ? "px" : "%"}`)
        ])
      ]);
      const mediaRow = (kind) => {
        const record = mediaState.media[kind];
        return h("div", { className: "wm-settings-row", key: `file-${kind}` }, [
          h("div", { className: "wm-settings-copy", key: "copy" }, [
            h("div", { className: "wm-settings-label", key: "label" }, copy[`${kind}File`]),
            h("div", { className: "wm-settings-hint wm-media-name", title: record?.name, key: "name" },
              record ? `${record.name} · ${(record.size / 1048576).toFixed(1)} MB` : copy[`${kind}Empty`])
          ]),
          h("div", { className: "wm-media-actions", key: "actions" }, [
            h("input", { type: "file", accept: `${kind}/*`, hidden: true, disabled: busy,
              "aria-label": copy[`${kind}File`], ref: (input) => { inputs.current[kind] = input; }, key: "file",
              onChange: async (event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (!file || busy) return;
                setBusy(true);
                try { setSettings(await controller.importMedia(kind, file)); }
                finally { setBusy(false); }
              } }),
            h("button", { type: "button", className: "wm-settings-option", disabled: busy, key: "choose",
              onClick: () => inputs.current[kind]?.click() }, copy[record ? "replace" : "choose"]),
            record && h("button", { type: "button", className: "wm-settings-option", disabled: busy, key: "remove",
              onClick: async () => { setBusy(true); try { await controller.media.remove(kind); } finally { setBusy(false); } }
            }, copy.remove)
          ])
        ]);
      };

      // Wallpaper Engine (experimental). The scene list is the Host whitelist; when the
      // Host, the packaged helper or the local sample is missing the row stays visible
      // and says why instead of silently doing nothing.
      const wallpaperUnavailable = (reason) => copy[`error${{ platform: "Platform", host: "Host", helper: "Helper", scene: "Scene" }[reason] ?? "Unavailable"}`];
      // Live values come from this client's own metrics; the Host snapshot is only used for
      // the configured limit and for the availability answer.
      const previewLimitSeconds = () => wallpaperStatus.host?.session?.seconds
        ?? wallpaperStatus.host?.previewSeconds?.default
        ?? 180;
      const previewClock = (seconds) => {
        const left = Math.max(0, Math.round(previewLimitSeconds() - seconds));
        return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
      };
      const previewStatusText = () => {
        if (wallpaperStatus.host && wallpaperStatus.host.available === false) return wallpaperUnavailable(wallpaperStatus.host.unavailableReason);
        // A failed close is the more actionable message: the old window may still exist, so
        // it must not be masked by the generic unavailable text.
        if (wallpaperStatus.state === "cleanup-failed") return `${copy.previewCleanupFailed}：${wallpaperStatus.error || ""}`;
        if (previewActionError) return `${copy.errorUnavailable}：${previewActionError}`;
        if (wallpaperStatus.error) return `${copy.errorUnavailable}：${wallpaperStatus.error}`;
        // Which mode this run is actually in decides the wording: a daily run has no limit,
        // so showing a preview countdown would be a false promise.
        const mode = wallpaperStatus.mode ?? settings.weMode;
        const daily = mode === "daily";
        const runningClock = (seconds) => {
          const total = Math.max(0, Math.floor(seconds));
          const hours = Math.floor(total / 3600);
          const minutes = Math.floor((total % 3600) / 60);
          const rest = total % 60;
          return hours > 0
            ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
            : `${minutes}:${String(rest).padStart(2, "0")}`;
        };
        switch (wallpaperStatus.state) {
          case "starting": return copy.previewStarting;
          case "connecting": return copy.previewConnecting;
          case "playing": {
            const rendered = wallpaperStatus.rendered ?? 0;
            const seconds = Math.max(1, wallpaperStatus.seconds ?? 1);
            const rate = `${(rendered / seconds).toFixed(1)} 帧/秒`;
            if (daily) {
              // No countdown and no rate claim: the honest numbers are how long this run has
              // been going and how many frames it has drawn.
              return `${copy.dailyPlaying} · ${copy.runningFor} ${runningClock(wallpaperStatus.seconds ?? 0)} · ${copy.framesThisRun} ${rendered}`;
            }
            return `${copy.previewPlaying} · ${rendered} 帧 · ${rate} · ${copy.previewLimit} ${previewClock(wallpaperStatus.seconds ?? 0)}`;
          }
          case "waiting": return `${copy.previewWaiting} · ${wallpaperStatus.rendered ?? 0} 帧`;
          case "stopped": return copy.previewStopped;
          case "cleanup-failed": return `${copy.previewCleanupFailed}：${wallpaperStatus.error || ""}`;
          default: return copy.previewIdle;
        }
      };
      const previewActive = ["starting", "connecting", "playing", "waiting"].includes(wallpaperStatus.state);
      const cleanupFailed = wallpaperStatus.state === "cleanup-failed";
      /**
       * Runs the constrained playback action behind the watched buttons.
       *
       * It only uses the public controller surface: the layer itself is (re)created by the
       * render path when the first frame arrives, so this component must not reach into the
       * backdrop's or the theme's closure state. Every step, including the busy guard, is
       * inside try/finally so a failure never leaves the buttons stuck as busy.
       */
      const runPreview = (action) => async () => {
        if (previewBusy) return;
        // The buttons are already disabled for an unusable selection; this is the second line of
        // defence, so a programmatic call cannot submit a switch the Host would refuse (which for a
        // restart would have closed the working picture first).
        if (!selectionUsable() && !(action === "stop")) {
          setPreviewActionError(copy.selectedUnavailable);
          return;
        }
        try {
          setPreviewBusy(true);
          setPreviewActionError("");
          await controller.wallpaper[action](settings.weScene, settings.weMode);
        } catch (error) {
          setPreviewActionError(String(error?.message || "playback-failed"));
        } finally { setPreviewBusy(false); }
      };
      // A short, plain-text reason for an item that cannot be started. The Host reports a machine
      // reason code; this side only turns it into wording and never renders it as markup.
      const sceneReasonText = (item) => {
        if (item.available) return "";
        const map = { playback_type_not_supported: copy.sceneReasonUnsupported, unknown_type: copy.sceneReasonUnknownType, unsafe_path: copy.sceneReasonUnsafe, unsafe_preview: copy.sceneReasonUnsafe };
        if (item.type && !["scene", "video", "web"].includes(item.type)) return map.playback_type_not_supported;
        return map[item.reason] ?? copy.sceneReasonOther;
      };
      const sceneItemTitle = (item) => {
        const parts = [item.title];
        if (item.playbackVerified) parts.push(`（${copy.sceneVerified}）`);
        else if (["scene", "video", "web"].includes(item.type) && item.available) parts.push(`（${copy.sceneExperimental}）`);
        if (!item.available) parts.push(`（${copy.sceneUnavailable}：${sceneReasonText(item)}）`);
        return parts.join(" ");
      };
      // The list is the Host's snapshot plus whatever the status payload already knows about the
      // verified sample, so a library that failed to load still shows the sample it can start.
      const knownItems = () => {
        const items = [...library.items];
        if (!items.some(item => item.id === "lucy")) {
          const verified = Array.isArray(wallpaperStatus.host?.scenes) ? wallpaperStatus.host.scenes.find(scene => scene.id === "lucy") : null;
          items.unshift({ id: "lucy", title: "Lucy", type: "scene", available: verified ? verified.available !== false : true, playbackVerified: true, reason: null });
        }
        return items;
      };
      const selectedItem = () => knownItems().find(item => item.id === settings.weScene) ?? null;
      /** True when the selection is the sample, which carries its own verified file. */
      const selectionIsSample = () => settings.weScene === "lucy";
      /**
       * The state of the current selection, as the buttons and the warning both need it.
       *
       *  - `verified`  the sample, or a catalogue entry the Host has confirmed available;
       *  - `pending`   a catalogue id the list has not confirmed yet (still loading, a failed read,
       *                an empty snapshot): NOT usable, because nothing has proved it exists, and not
       *                reported as deleted either;
       *  - `unusable`  the list was read and this entry is missing or listed unavailable;
       *  - `unknown`   no usable id at all (a corrupted stored value).
       *
       * An empty library is the normal result of "every subscription was removed" or "the library
       * drive is away", so a stored catalogue id in that state is waiting for confirmation, never a
       * wallpaper that may be started on the strength of a remembered id.
       */
      const selectionState = () => {
        if (!isSceneId(settings.weScene)) return "unknown";
        const item = selectedItem();
        if (selectionIsSample()) {
          // The sample is decided by its own file, as the Host reports it, independently of the
          // bounded library: a sample whose file is gone must block its own start.
          return item && item.available === false ? "unusable" : "verified";
        }
        if (item) return item.available === false ? "unusable" : "verified";
        // The entry is not in the list this client has: only a successful read can call it missing.
        if (library.loaded && library.state === "ready") return "unusable";
        return "pending";
      };
      const selectionUsable = () => selectionState() === "verified";
      const selectionKnownUnusable = () => selectionState() === "unusable";
      const selectionPending = () => selectionState() === "pending";
      // Which scene the live run is really capturing. The host answer wins; the selection is never
      // presented as if the picture had already switched.
      const playingSceneId = () => (previewActive ? wallpaperStatus.host?.activeSceneId ?? null : null);
      const playingItem = () => {
        const id = playingSceneId();
        return id ? knownItems().find(item => item.id === id) ?? { id, title: id, playbackVerified: false } : null;
      };
      const libraryStatusText = () => {
        if (library.loading) return copy.sceneLoading;
        if (library.state === "unconfigured") return copy.sceneUnconfigured;
        if (library.state === "failed") return `${copy.sceneLoadFailed}：${library.error || ""}`;
        if (Array.isArray(library.rootWarnings) && library.rootWarnings.length) return copy.sceneRootMissing;
        if (library.loaded && library.items.length === 0) return copy.sceneEmpty;
        return "";
      };
      const libraryList = () => h("div", { className: "wm-wallpaper-list", key: "list", role: "radiogroup", "aria-label": copy.scene },
        knownItems().map(item => h("button", {
          type: "button", key: item.id, role: "radio",
          className: "wm-wallpaper-item" + (item.id === settings.weScene ? " is-selected" : ""),
          "aria-checked": item.id === settings.weScene, "aria-disabled": !item.available,
          "data-wm-scene-item": item.id, "data-wm-scene-available": String(item.available),
          title: sceneItemTitle(item),
          // An unavailable item stays visible and explainable but cannot become the selection.
          onClick: () => { if (item.available) update("weScene", item.id); }
        }, [
          h("span", { className: "wm-wallpaper-item-title", key: "title" }, item.title),
          h("span", { className: "wm-wallpaper-item-meta", key: "meta" }, [
            h("span", { className: "wm-wallpaper-item-type", key: "type" }, item.type === "scene" ? "scene" : item.type),
            item.playbackVerified
              ? h("span", { className: "wm-wallpaper-item-badge is-verified", key: "badge" }, copy.sceneVerified)
              : h("span", { className: "wm-wallpaper-item-badge", key: "badge" }, item.available ? copy.sceneExperimental : copy.sceneUnavailable),
            item.available ? null : h("span", { className: "wm-wallpaper-item-reason", key: "reason" }, sceneReasonText(item))
          ])
        ])));
      const wallpaperRow = () => h("div", { className: "wm-settings-row wm-wallpaper-row", key: "wallpaper-engine" }, [
        // The description needs a full-width line of its own: in a narrow panel the old
        // two-column row squeezed this column to zero width and the text wrapped one
        // character per line. Title above, controls below, both able to wrap.
        h("div", { className: "wm-settings-copy wm-wallpaper-copy", key: "copy" }, [
          h("div", { className: "wm-settings-label", key: "label" }, copy.wallpaperEngine),
          h("div", { className: "wm-settings-hint", key: "hint" }, copy.wallpaperEngineHint)
        ]),
        // Fields and actions are two groups: the scene/mode fields describe the next run, the
        // buttons act on it. Keeping them apart is also what keeps the three buttons together
        // on one row and equally sized instead of leaving stop alone on a line of its own.
        h("div", { className: "wm-wallpaper-fields", key: "fields" }, [
          // The list is the field that describes the NEXT run: browsing, refreshing and selecting
          // never start, stop or switch anything.
          h("div", { className: "wm-inline-field wm-wallpaper-field wm-wallpaper-field-selection", key: "scene" }, [
            h("span", { className: "wm-inline-label", key: "label" }, copy.scene),
            h("div", { className: "wm-wallpaper-selection", key: "selection" }, [
              h("div", { className: "wm-wallpaper-selection-head", key: "head" }, [
                h("span", { className: "wm-wallpaper-selected", key: "selected", "data-wm-selected-scene": settings.weScene },
                  `${copy.selectedItem}：${selectedItem()?.title ?? settings.weScene}`),
                // Current picture and next selection are two separate statements.
                h("span", { className: "wm-wallpaper-playing", key: "playing", "data-wm-playing-scene": playingSceneId() ?? "" },
                  `${copy.playingItem}：${playingItem()?.title ?? copy.notPlaying}`),
                h("button", {
                  type: "button", className: "wm-wallpaper-refresh", key: "refresh",
                  "data-wm-action": "wallpaper-refresh", disabled: library.loading,
                  onClick: () => loadLibrary(true)
                }, library.loading ? copy.sceneRefreshing : copy.sceneRefresh)
              ]),
              libraryList(),
              libraryStatusText() ? h("p", { className: "wm-wallpaper-list-status", key: "status", role: "status" }, libraryStatusText()) : null,
              library.truncated ? h("p", { className: "wm-wallpaper-list-status", key: "truncated" }, copy.sceneTruncated) : null,
              // The selection survives a missing item, but the user is told instead of being
              // silently moved to another wallpaper.
              selectionKnownUnusable()
                ? h("p", { className: "wm-wallpaper-list-status is-warning", key: "unavailable" }, copy.selectedUnavailable)
                : null,
              // A stored catalogue id that no successful read has confirmed yet: that is "waiting",
              // not "deleted", and the start buttons stay disabled until it is confirmed.
              selectionPending()
                ? h("p", { className: "wm-wallpaper-list-status", key: "pending" }, copy.selectedPending)
                : null,
              // An unverified selection is experimental: it never starts by itself.
              selectedItem() && selectedItem().id !== "lucy" && selectedItem().available && settings.weAutoStart
                ? h("p", { className: "wm-wallpaper-list-status", key: "manual-only" }, copy.autoStartSkipped)
                : null
            ])
          ]),
          // The mode is stored for the next start; changing it never restarts the live run.
          h("label", { className: "wm-inline-field wm-wallpaper-field", key: "mode" }, [
            h("span", { className: "wm-inline-label", key: "label" }, copy.playMode),
            h("select", {
              "aria-label": copy.playMode, value: settings.weMode, key: "select",
              "data-wm-setting": "weMode",
              onChange: (event) => update("weMode", event.currentTarget.value)
            }, [
              h("option", { value: "daily", key: "daily" }, copy.modeDaily),
              h("option", { value: "preview", key: "preview" }, copy.modePreview)
            ])
          ])
        ]),
        h("div", { className: "wm-wallpaper-actions", key: "actions" }, [
          // Start and restart need a selection the Host has confirmed usable: submitting an
          // unavailable one is refused anyway, and a restart would close a working picture first.
          h("button", { type: "button", className: "wm-settings-option wm-wallpaper-button", key: "start",
            "data-wm-action": "wallpaper-start", disabled: previewBusy || previewActive || cleanupFailed || !selectionUsable(),
            onClick: runPreview("start") }, copy.startPreview),
          h("button", { type: "button", className: "wm-settings-option wm-wallpaper-button", key: "restart",
            "data-wm-action": "wallpaper-restart", disabled: previewBusy || cleanupFailed || !selectionUsable(),
            onClick: runPreview("restart") }, copy.restartPreview),
          // Stop and retry-cleanup stay independent of the list: loading, a failed refresh or an
          // unusable selection must never take the stop control away.
          h("button", { type: "button", className: "wm-settings-option wm-wallpaper-button", key: "stop",
            "data-wm-action": "wallpaper-stop", disabled: previewBusy || (!previewActive && !cleanupFailed),
            onClick: runPreview("stop") }, cleanupFailed ? copy.retryCleanup : copy.stopPreview)
        ])
      ]);
      // Opt-in for the next DSH start. It never starts or stops anything by itself, so
      // toggling it cannot end a run the user is watching. This row is NOT a wm-wallpaper-row:
      // it stays a two-column row (text left, box right). Sharing the stacked WE row class made
      // the browser stretch the checkbox to the panel width, because that class sets
      // `align-items: stretch` on the cross axis.
      const autoStartRow = () => h("label", {
        className: "wm-settings-row wm-wallpaper-auto-start",
        key: "wallpaper-auto-start", "data-wm-auto-start": String(settings.weAutoStart)
      }, [
        h("span", { className: "wm-settings-copy", key: "copy" }, [
          h("span", { className: "wm-settings-label", key: "label" }, copy.autoStart),
          h("span", { className: "wm-settings-hint", key: "hint" }, copy.autoStartHint)
        ]),
        h("input", {
          type: "checkbox", checked: settings.weAutoStart, key: "checkbox",
          "aria-label": copy.autoStart, "data-wm-setting": "weAutoStart",
          onChange: (event) => update("weAutoStart", event.currentTarget.checked)
        })
      ]);
      // One row per region the user may cover with its own colour. They are plain checkboxes: the
      // segmented control above is for exclusive choices, these two are independent on/off switches,
      // and either may be combined with the other.
      const regionRow = (key) => h("label", {
        className: "wm-settings-row wm-region-row",
        key: `region-${key}`, "data-wm-region": key
      }, [
        h("span", { className: "wm-settings-copy", key: "copy" }, [
          h("span", { className: "wm-settings-label", key: "label" }, copy[key]),
          h("span", { className: "wm-settings-hint", key: "hint" }, copy[`${key}Hint`])
        ]),
        h("input", {
          type: "checkbox", checked: settings[key] === true, key: "checkbox",
          "aria-label": copy[key], "data-wm-setting": key,
          onChange: (event) => update(key, event.currentTarget.checked)
        })
      ]);
      const wallpaperStatusRow = () => h("p", {
        className: "wm-settings-hint", role: "status", "aria-live": "polite", key: "wallpaper-status",
        "data-wm-wallpaper-state": wallpaperStatus.state
      }, previewStatusText());
      const wallpaperPresetsRow = () => {
        const targetResolution = controller.presets.resolveTarget();
        const targetId = targetResolution.ok ? targetResolution.targetId : null;
        const isPlaying = Boolean(targetResolution.ok && targetResolution.isPlaying);
        const targetItem = targetId ? (knownItems().find(item => item.id === targetId) ?? { id: targetId, title: targetId }) : null;
        const hasPreset = Boolean(targetId && presetsState.entries[targetId]);
        const usableInIdle = Boolean(targetResolution.ok && !isPlaying && selectionUsable());
        const canOperate = Boolean(targetResolution.ok && (isPlaying || usableInIdle));

        const canSave = canOperate;
        const canApply = canOperate && hasPreset;
        const canDelete = canOperate && hasPreset;

        let targetLine = "";
        let hintLine = presetActionError;

        if (targetResolution.ok) {
          const prefix = isPlaying ? copy.presetPlayingTarget : copy.presetSelectedTarget;
          const statusText = hasPreset ? copy.presetSaved : copy.presetEmpty;
          targetLine = `${prefix}：${targetItem?.title || targetId}（${statusText}）`;
          if (!hintLine) {
            if (!isPlaying) {
              if (selectionPending()) hintLine = copy.selectedPending;
              else if (selectionKnownUnusable()) hintLine = copy.selectedUnavailable;
              else hintLine = copy.presetHint;
            } else {
              hintLine = copy.presetHint;
            }
          }
        } else {
          if (targetResolution.error === "mismatch") {
            const activeTitle = (knownItems().find(i => i.id === targetResolution.activeId) ?? { title: targetResolution.activeId }).title;
            const selectedTitle = (knownItems().find(i => i.id === settings.weScene) ?? { title: settings.weScene }).title;
            targetLine = `${copy.presetPlayingTarget}：${activeTitle}（${copy.selectedItem}：${selectedTitle}）`;
            if (!hintLine) hintLine = copy.presetMismatch;
          } else if (targetResolution.error === "transition") {
            targetLine = `${copy.presetPlayingTarget}：…`;
            if (!hintLine) hintLine = copy.presetBusy;
          } else if (targetResolution.error === "cleanup-failed") {
            targetLine = `${copy.presetPlayingTarget}：…`;
            if (!hintLine) hintLine = copy.previewCleanupFailed;
          } else if (targetResolution.error === "error") {
            targetLine = "--";
            if (!hintLine) hintLine = copy.errorUnavailable;
          } else if (targetResolution.error === "scene-unconfirmed") {
            const selectedTitle = (knownItems().find(i => i.id === settings.weScene) ?? { title: settings.weScene }).title;
            targetLine = `${copy.presetSelectedTarget}：${selectedTitle}`;
            if (!hintLine) hintLine = copy.selectedPending;
          } else if (targetResolution.error === "scene-unavailable") {
            const selectedTitle = (knownItems().find(i => i.id === settings.weScene) ?? { title: settings.weScene }).title;
            targetLine = `${copy.presetSelectedTarget}：${selectedTitle}`;
            if (!hintLine) hintLine = copy.selectedUnavailable;
          } else {
            targetLine = "--";
            if (!hintLine) hintLine = copy.presetHint;
          }
        }

        return h("div", {
          className: "wm-settings-row wm-wallpaper-presets-row",
          key: "wallpaper-presets",
          "data-wm-presets-target": targetId || "",
          "data-wm-presets-has": String(hasPreset)
        }, [
          h("div", { className: "wm-settings-copy", key: "copy" }, [
            h("div", { className: "wm-settings-label", key: "label" }, copy.presetTitle),
            h("div", { className: "wm-wallpaper-preset-target", key: "target" }, targetLine),
            h("div", { className: "wm-settings-hint", key: "hint", role: "status", "aria-live": "polite" }, hintLine)
          ]),
          h("div", { className: "wm-wallpaper-preset-actions", key: "actions" }, [
            h("button", {
              type: "button",
              className: "wm-settings-reset wm-preset-button",
              key: "save",
              "data-wm-action": "preset-save",
              disabled: !canSave,
              onClick: () => {
                setPresetActionError("");
                const res = controller.presets.save();
                if (!res.ok) {
                  if (res.error === "storage-failed") setPresetActionError(copy.presetStorageError);
                  else if (res.error === "mismatch") setPresetActionError(copy.presetMismatch);
                  else if (res.error === "transition") setPresetActionError(copy.presetBusy);
                  else setPresetActionError(res.error);
                }
              }
            }, copy.presetSave),
            h("button", {
              type: "button",
              className: "wm-settings-reset wm-preset-button",
              key: "apply",
              "data-wm-action": "preset-apply",
              disabled: !canApply,
              onClick: () => {
                setPresetActionError("");
                const res = controller.presets.apply();
                if (res.ok) {
                  setSettings(controller.read());
                } else {
                  if (res.error === "mismatch") setPresetActionError(copy.presetMismatch);
                  else if (res.error === "transition") setPresetActionError(copy.presetBusy);
                  else setPresetActionError(res.error);
                }
              }
            }, copy.presetApply),
            h("button", {
              type: "button",
              className: "wm-settings-reset wm-preset-button",
              key: "delete",
              "data-wm-action": "preset-delete",
              disabled: !canDelete,
              onClick: () => {
                setPresetActionError("");
                const res = controller.presets.remove();
                if (!res.ok) {
                  if (res.error === "storage-failed") setPresetActionError(copy.presetStorageError);
                  else if (res.error === "mismatch") setPresetActionError(copy.presetMismatch);
                  else if (res.error === "transition") setPresetActionError(copy.presetBusy);
                  else setPresetActionError(res.error);
                }
              }
            }, copy.presetDelete)
          ])
        ]);
      };

      return h("section", {
        className: "wm-settings-group",
        "data-wm-settings": ""
      }, [
        h("div", { className: "wm-settings-head", key: "head" }, [
          h("div", { className: "wm-settings-heading", key: "heading" }, [
            h("span", { className: "wm-settings-title", key: "title" }, copy.title),
            h("span", { className: "wm-settings-badge", key: "badge" }, copy.badge)
          ]),
          h("button", {
            type: "button",
            className: "wm-settings-reset",
            onClick: reset,
            key: "reset"
          }, copy.reset)
        ]),
        h("p", { className: "wm-settings-description", key: "description" }, copy.description),
        row("theme", copy.theme, copy.themeHint, ALLOWED_SETTINGS.theme),
        settings.theme === "abyss" && row("palette", copy.palette, copy.paletteHint, ALLOWED_SETTINGS.palette),
        row("accentMode", copy.accentMode, copy.accentHint, ALLOWED_SETTINGS.accentMode),
        settings.accentMode === "custom" && customAccentRow(),
        row("canvas", copy.canvas, copy.canvasHint, ALLOWED_SETTINGS.canvas),
        row("sidebar", copy.sidebar, copy.sidebarHint, ALLOWED_SETTINGS.sidebar),
        row("glass", copy.glass, copy.glassHint, ALLOWED_SETTINGS.glass),
        h("h3", { className: "wm-settings-subtitle", key: "readability-title" }, copy.readabilityTitle),
        row("textContrast", copy.textContrast, settings.textContrast === "enhanced" ? copy.textContrastEnhancedHint : copy.textContrastStandardHint, ALLOWED_SETTINGS.textContrast),
        settings.background !== "none" && range("chatBackdrop"),
        h("h3", { className: "wm-settings-subtitle", key: "wallpaper-title" }, copy.wallpaper),
        row("background", copy.background, copy.backgroundHint, ALLOWED_SETTINGS.background),
        settings.background === "wallpaper" && wallpaperRow(),
        settings.background === "wallpaper" && autoStartRow(),
        settings.background === "wallpaper" && wallpaperStatusRow(),
        settings.background === "image" && mediaRow("image"),
        settings.background === "video" && mediaRow("video"),
        settings.background === "video" && row("motion", copy.motion, copy.motionHint, ALLOWED_SETTINGS.motion),
        settings.background !== "none" && range("brightness"),
        settings.background !== "none" && range("mask"),
        settings.background !== "none" && range("blur"),
        settings.background !== "none" && range("surface"),
        settings.background === "wallpaper" && wallpaperPresetsRow(),
        // Which regions may cover the background. The preference is kept even when no background is
        // selected, so switching back finds the same choice; nothing changes while it is inactive.
        settings.background !== "none" && h("h3", {
          className: "wm-settings-subtitle", key: "region-title" }, copy.regionTitle),
        settings.background !== "none" && regionRow("opaqueSidebar"),
        (settings.background === "image" || settings.background === "video") && h("p", {
          className: "wm-settings-hint", role: "status", "aria-live": "polite", key: "status" },
          copy.status[mediaState.error || mediaState.status] || "")
      ]);
    }

    function WhaleSessionStatus({ useSession, statusController }) {
      const h = React.createElement;
      const running = useSession((snapshot) => snapshot.running);
      // DSH <= 0.1.1 exposed approval prompts as `pending`; the 0.1.5
      // SessionSnapshot removed that field. Keep the legacy signal when present,
      // but never let a missing optional capability crash the whole header slot.
      const pendingCount = useSession((snapshot) => (
        Array.isArray(snapshot.pending) ? snapshot.pending.length : 0
      ));
      const removed = useSession((snapshot) => snapshot.removed);
      const themeActive = React.useSyncExternalStore(
        statusController.theme.subscribe,
        statusController.theme.getSnapshot,
        statusController.theme.getSnapshot
      );
      const [qaStatus, setQaStatus] = React.useState(null);
      const actualStatus = removed
        ? "idle"
        : pendingCount > 0
          ? "waiting"
          : running
            ? "running"
            : "idle";
      const liveStatus = qaStatus ?? actualStatus;
      const previousStatus = React.useRef(liveStatus);
      const [displayStatus, setDisplayStatus] = React.useState(liveStatus);
      const [leaving, setLeaving] = React.useState(false);

      React.useEffect(() => {
        // Private test signal. Keeping this listener inert until the custom
        // event arrives avoids depending on Harness' short-lived token URL:
        // its query string is cleared before delayed Session headers mount.
        const receivePreview = (event) => {
          const next = event.detail;
          setQaStatus(["idle", "running", "waiting"].includes(next) ? next : null);
        };
        window.addEventListener("dsh-whale-mist:qa-status", receivePreview);
        return () => window.removeEventListener("dsh-whale-mist:qa-status", receivePreview);
      }, []);

      React.useEffect(() => {
        const previous = previousStatus.current;
        previousStatus.current = liveStatus;
        let leaveTimer;
        let clearTimer;

        if (liveStatus !== "idle") {
          setLeaving(false);
          setDisplayStatus(liveStatus);
        } else if (previous === "running" || previous === "waiting") {
          setLeaving(false);
          setDisplayStatus("complete");
          leaveTimer = window.setTimeout(() => setLeaving(true), 1100);
          clearTimer = window.setTimeout(() => {
            setDisplayStatus("idle");
            setLeaving(false);
          }, 1340);
        } else {
          setDisplayStatus("idle");
          setLeaving(false);
        }

        return () => {
          window.clearTimeout(leaveTimer);
          window.clearTimeout(clearTimer);
        };
      }, [liveStatus]);

      if (!themeActive || displayStatus === "idle") return null;

      const chinese = (navigator.language || "").toLowerCase().startsWith("zh");
      const labels = chinese ? {
        running: "运行中",
        waiting: "等待确认",
        complete: "已完成"
      } : {
        running: "Running",
        waiting: "Waiting for you",
        complete: "Complete"
      };
      const label = labels[displayStatus];

      return h("div", {
        className: `wm-session-status wm-session-status-${displayStatus}${leaving ? " is-leaving" : ""}`,
        role: "status",
        "aria-live": "polite",
        "aria-atomic": "true",
        "aria-label": label,
        title: label,
        "data-wm-status": displayStatus
      }, [
        h("span", { className: "wm-status-mark", "aria-hidden": "true", key: "mark" },
          h(FishLogo, { size: 13, className: "wm-status-logo" })
        ),
        h("span", { className: "wm-status-label", key: "label" }, label)
      ]);
    }

    const css = `
      body.${ACTIVE_CLASS} {
        min-height: 100vh;
        background:
          radial-gradient(72rem 46rem at 78% -12%, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.18) 45%, transparent 68%),
          radial-gradient(42rem 32rem at -8% 72%, rgba(181, 222, 250, 0.38) 0%, transparent 70%),
          linear-gradient(145deg, #f4f9ff 0%, #edf6fe 48%, #e6f2fc 100%);
        color: var(--dsw-alias-label-primary);
        font-family: var(--dsw-font-family);
        font-optical-sizing: auto;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }

      body.${ACTIVE_CLASS}::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(108deg, rgba(255, 255, 255, 0.22), transparent 34%, rgba(119, 187, 230, 0.06));
      }

      body.${ACTIVE_CLASS}[data-wm-canvas="clear"] {
        --dsw-alias-bg-base: rgba(244, 250, 255, 0.9) !important;
        --dsw-alias-bg-layer-1: rgba(255, 255, 255, 0.78) !important;
        --dsw-alias-bg-layer-2: rgba(229, 241, 250, 0.82) !important;
        background:
          radial-gradient(68rem 40rem at 80% -10%, #ffffff 0%, rgba(255, 255, 255, 0.2) 48%, transparent 70%),
          linear-gradient(145deg, #f7fbff 0%, #eef7fe 52%, #e7f3fc 100%);
      }

      body.${ACTIVE_CLASS}[data-wm-sidebar="deep"] {
        --dsw-specific-sidebar-fill: rgba(207, 229, 246, 0.9) !important;
        --dsw-specific-sidebar-nav-item-active: rgba(255, 255, 255, 0.7) !important;
        --dsw-specific-sidebar-nav-item-hover: rgba(255, 255, 255, 0.5) !important;
      }

      body.${ACTIVE_CLASS}[data-wm-glass="restrained"] {
        --dsw-alias-bg-layer-1: rgba(251, 254, 255, 0.9) !important;
        --dsw-alias-bg-layer-2: rgba(231, 242, 250, 0.92) !important;
        --dsw-alias-bg-layer-3: rgba(252, 254, 255, 0.94) !important;
        --dsw-alias-bg-overlay: #f8fbfe !important;
        --dsw-specific-menu: #f8fbfe !important;
        --dsw-specific-selector: rgba(248, 252, 255, 0.9) !important;
        --dsw-mask-blur: blur(12px) saturate(112%) !important;
      }

      body.${ABYSS_ACTIVE_CLASS} {
        min-height: 100vh;
        background:
          radial-gradient(60rem 38rem at 82% -14%, rgba(116, 91, 204, 0.13) 0%, transparent 66%),
          radial-gradient(46rem 34rem at -12% 78%, rgba(64, 111, 151, 0.12) 0%, transparent 72%),
          linear-gradient(145deg, #0b111d 0%, #080b14 52%, #070a12 100%);
        color: var(--dsw-alias-label-primary);
        font-family: var(--dsw-font-family);
        font-optical-sizing: auto;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }

      body.${ABYSS_ACTIVE_CLASS}::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(108deg, rgba(117, 146, 187, 0.025), transparent 38%, rgba(140, 114, 242, 0.035));
      }

      body.${ABYSS_ACTIVE_CLASS}[data-wm-canvas="clear"] {
        --dsw-alias-bg-base: #080b14 !important;
        --dsw-alias-bg-layer-1: #0f1726 !important;
        --dsw-alias-bg-layer-2: #172236 !important;
        background:
          radial-gradient(58rem 36rem at 84% -16%, rgba(116, 91, 204, 0.09) 0%, transparent 68%),
          linear-gradient(145deg, #0c1321 0%, #080b14 58%, #070a12 100%);
      }

      body.${ABYSS_ACTIVE_CLASS}[data-wm-sidebar="deep"] {
        --dsw-specific-sidebar-fill: rgba(10, 16, 28, 0.98) !important;
        --dsw-specific-sidebar-nav-item-active: rgba(140, 114, 242, 0.18) !important;
        --dsw-specific-sidebar-nav-item-hover: rgba(231, 236, 245, 0.055) !important;
      }

      body.${ABYSS_ACTIVE_CLASS}[data-wm-glass="restrained"] {
        --dsw-alias-bg-layer-1: rgba(15, 23, 38, 0.985) !important;
        --dsw-alias-bg-layer-2: rgba(23, 34, 54, 0.985) !important;
        --dsw-alias-bg-layer-3: rgba(28, 40, 62, 0.99) !important;
        --dsw-alias-bg-overlay: #172236 !important;
        --dsw-specific-menu: #131d2f !important;
        --dsw-specific-selector: #1c283e !important;
        --dsw-mask-blur: blur(12px) saturate(106%) !important;
      }

      .wm-settings-group {
        box-sizing: border-box;
        width: 100%;
        border-bottom: 1px solid var(--dsw-alias-border-l2);
        padding: 16px 0;
      }

      .wm-settings-head,
      .wm-settings-heading,
      .wm-settings-row,
      .wm-settings-segment {
        display: flex;
        align-items: center;
      }

      .wm-settings-head {
        justify-content: space-between;
        gap: 16px;
      }

      .wm-settings-heading {
        min-width: 0;
        gap: 8px;
      }

      .wm-settings-title {
        color: var(--dsw-alias-label-primary);
        font-size: 14px;
        font-weight: 500;
        line-height: 22px;
      }

      .wm-settings-badge {
        color: var(--dsw-alias-brand-primary);
        background: var(--dsw-alias-state-business-tertiary);
        border-radius: 999px;
        padding: 1px 7px;
        font-size: 11px;
        font-weight: 600;
        line-height: 18px;
        letter-spacing: 0.01em;
      }

      .wm-settings-description {
        max-width: 38rem;
        margin: 4px 0 10px;
        color: var(--dsw-alias-label-secondary);
        font-size: 13px;
        line-height: 20px;
      }

      .wm-settings-reset {
        flex: none;
        min-height: 30px;
        border: 0;
        border-radius: 9px;
        padding: 4px 9px;
        color: var(--dsw-alias-label-secondary);
        background: transparent;
        font: inherit;
        font-size: 12px;
        line-height: 20px;
        cursor: pointer;
      }

      .wm-settings-reset:hover {
        color: var(--dsw-alias-label-primary);
        background: var(--dsw-alias-interactive-bg-hover);
      }

      .wm-settings-row {
        justify-content: space-between;
        gap: 20px;
        min-height: 52px;
        border-top: 1px solid var(--dsw-alias-separator-primary);
      }

      .wm-settings-copy {
        min-width: 0;
        padding: 8px 0;
      }

      .wm-settings-label {
        color: var(--dsw-alias-label-primary);
        font-size: 13px;
        font-weight: 500;
        line-height: 20px;
      }

      .wm-settings-hint {
        color: var(--dsw-alias-label-tertiary);
        font-size: 12px;
        line-height: 18px;
      }

      .wm-settings-segment {
        flex: none;
        gap: 2px;
        border: 1px solid var(--dsw-alias-border-l2);
        border-radius: 11px;
        padding: 2px;
        background: var(--dsw-alias-bg-layer-2);
      }

      .wm-settings-option {
        min-width: 64px;
        min-height: 30px;
        border: 0;
        border-radius: 8px;
        padding: 4px 10px;
        color: var(--dsw-alias-label-secondary);
        background: transparent;
        font: inherit;
        font-size: 12px;
        font-weight: 500;
        line-height: 20px;
        cursor: pointer;
      }

      .wm-settings-option:hover:not(.is-selected) {
        color: var(--dsw-alias-label-primary);
        background: var(--dsw-alias-interactive-bg-hover);
      }

      .wm-settings-option.is-selected {
        color: var(--dsw-alias-label-primary);
        background: var(--dsw-alias-bg-layer-1);
        box-shadow: var(--dsw-shadow-lv1);
      }

      .wm-session-status {
        display: inline-flex;
        align-items: center;
        box-sizing: border-box;
        height: 26px;
        gap: 6px;
        border: 1px solid rgba(54, 101, 136, 0.15);
        border-radius: 999px;
        padding: 0 9px 0 5px;
        color: var(--dsw-alias-label-secondary);
        background: rgba(250, 253, 255, 0.72);
        box-shadow: 0 1px 2px rgba(36, 76, 106, 0.05);
        font-family: var(--dsw-font-family);
        font-size: 12px;
        font-weight: 500;
        line-height: 16px;
        white-space: nowrap;
        pointer-events: none;
        transition: opacity 180ms ease, transform 180ms ease, border-color 160ms ease, color 160ms ease;
        animation: wm-status-arrive 160ms cubic-bezier(0.23, 1, 0.32, 1) both;
      }

      .wm-session-status.is-leaving {
        opacity: 0;
        transform: translateY(-2px) scale(0.98);
      }

      .wm-status-mark {
        position: relative;
        display: grid;
        flex: none;
        width: 18px;
        height: 18px;
        place-items: center;
        border-radius: 50%;
        color: #ffffff;
        background: var(--dsw-alias-brand-primary);
        transition: background-color 160ms ease;
      }

      .wm-status-logo {
        display: block;
      }

      .wm-session-status-running .wm-status-mark::after {
        content: "";
        position: absolute;
        inset: -3px;
        border: 1px solid rgba(20, 104, 168, 0.34);
        border-radius: inherit;
        animation: wm-status-breathe 1.8s ease-out infinite;
      }

      .wm-session-status-waiting {
        color: var(--dsw-alias-state-warn-label);
        border-color: rgba(169, 106, 34, 0.19);
        background: rgba(255, 250, 240, 0.82);
      }

      .wm-session-status-waiting .wm-status-mark {
        background: var(--dsw-alias-state-warn-primary);
      }

      .wm-session-status-complete {
        color: var(--dsw-alias-state-success-primary);
        border-color: rgba(43, 129, 100, 0.18);
        background: rgba(244, 252, 248, 0.84);
      }

      .wm-session-status-complete .wm-status-mark {
        background: var(--dsw-alias-state-success-primary);
      }

      body.${ABYSS_ACTIVE_CLASS} .wm-session-status {
        border-color: rgba(125, 145, 177, 0.17);
        background: rgba(19, 29, 47, 0.9);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.24);
      }

      body.${ABYSS_ACTIVE_CLASS} .wm-session-status-running .wm-status-mark::after {
        border-color: rgba(140, 114, 242, 0.46);
      }

      body.${ABYSS_ACTIVE_CLASS} .wm-session-status-waiting {
        border-color: rgba(227, 168, 93, 0.22);
        background: rgba(53, 40, 27, 0.88);
      }

      body.${ABYSS_ACTIVE_CLASS} .wm-session-status-complete {
        border-color: rgba(100, 205, 162, 0.2);
        background: rgba(19, 47, 40, 0.88);
      }

      @keyframes wm-status-arrive {
        from {
          opacity: 0;
          transform: translateY(2px) scale(0.98);
        }
      }

      @keyframes wm-status-breathe {
        0% {
          opacity: 0;
          transform: scale(0.82);
        }
        42% {
          opacity: 0.62;
        }
        100% {
          opacity: 0;
          transform: scale(1.18);
        }
      }

      @media (max-width: 720px) {
        .wm-settings-row {
          align-items: stretch;
          flex-direction: column;
          gap: 4px;
          padding: 10px 0;
        }

        .wm-settings-segment {
          align-self: stretch;
        }

        .wm-settings-option {
          flex: 1;
        }
      }

      /* Harmonize dsh-reasoning-effort with Whale Mist's light surface.
         Keep the resting track blue-white and let the plugin's moving radiation
         carry the indigo-violet depth without affecting the
         official light/dark themes. */
      body.${ACTIVE_CLASS} .re-effort-track {
        background:
          linear-gradient(100deg, #f8fcff 0%, #edf7ff 48%, #dceefb 100%) !important;
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.92),
          inset 0 0 0 1px rgba(72, 124, 164, 0.14),
          0 3px 12px rgba(47, 91, 124, 0.12) !important;
      }

      body.${ACTIVE_CLASS} .re-effort-slider:not([data-effort="off"]) .re-effort-track::before {
        background: linear-gradient(90deg, #e9dcff 0%, #c9a9ff 22%, #8e62dd 56%, #4d278f 100%) !important;
      }

      body.${ACTIVE_CLASS} .re-effort-slider[data-top="true"] .re-effort-track::before,
      body.${ACTIVE_CLASS} .re-effort-slider[data-effort="max"] .re-effort-track::before {
        background: linear-gradient(90deg, #e9dcff 0%, #bc91ff 18%, #7950cf 54%, #3f1b7f 100%) !important;
      }

      body.${ACTIVE_CLASS} .re-effort-slider:not([data-effort="off"]) .re-effort-track::after {
        background:
          radial-gradient(circle at 18% 45%, rgba(137, 96, 230, 0.2), transparent 25%),
          linear-gradient(90deg, rgba(106, 63, 179, 0.08), transparent 42%, rgba(70, 31, 139, 0.18)) !important;
      }

      body.${ACTIVE_CLASS} .re-effort .re-effort-canvas {
        opacity: 0.9;
        mix-blend-mode: multiply;
        filter: hue-rotate(42deg) saturate(1.5) contrast(1.08);
      }

      body.${ACTIVE_CLASS} .re-effort.is-dragging .re-effort-canvas {
        filter: hue-rotate(42deg) saturate(1.66) brightness(1.1) contrast(1.12);
      }

      body.${ACTIVE_CLASS} .re-effort-fx::after {
        content: "";
        position: absolute;
        z-index: 3;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        background:
          radial-gradient(ellipse 68px 34px at var(--re-progress) 50%, rgba(198, 156, 255, 0.5) 0%, rgba(137, 96, 234, 0.24) 34%, transparent 72%);
        mix-blend-mode: multiply;
        opacity: 1;
        transition: opacity 160ms cubic-bezier(0.23, 1, 0.32, 1);
      }

      /* v0.8 renders the lowest position as range value 0 instead of
         exposing the older data-effort attribute. */
      body.${ACTIVE_CLASS} .re-effort-slider[data-effort="off"] .re-effort-fx::after,
      body.${ACTIVE_CLASS} .re-effort-slider:has(.re-effort-input[value="0"]) .re-effort-fx::after {
        opacity: 0;
      }

      body.${ACTIVE_CLASS} .re-effort .re-effort-flare {
        background: radial-gradient(ellipse at 100% 50%, rgba(241, 228, 255, 0.94) 0 4%, rgba(209, 181, 255, 0.84) 12%, rgba(139, 83, 235, 0.58) 30%, rgba(75, 35, 156, 0.22) 53%, transparent 75%);
        filter: blur(2px) saturate(1.24);
        transition: opacity 160ms cubic-bezier(0.23, 1, 0.32, 1);
      }

      body.${ACTIVE_CLASS} .re-effort .re-effort-flare::before {
        background: linear-gradient(90deg, transparent, rgba(151, 112, 245, 0.46), #eadcff, rgba(116, 53, 202, 0.7), transparent) !important;
        box-shadow: 0 0 7px rgba(155, 103, 235, 0.72), 0 0 13px rgba(91, 70, 201, 0.5) !important;
      }

      body.${ACTIVE_CLASS} .re-effort .re-effort-flare::after {
        background: linear-gradient(180deg, transparent, rgba(222, 194, 255, 0.92), transparent) !important;
        box-shadow: 0 0 7px rgba(140, 83, 223, 0.68) !important;
      }

      body.${ACTIVE_CLASS} .re-effort-slider[data-effort="off"] .re-effort-flare,
      body.${ACTIVE_CLASS} .re-effort-slider:has(.re-effort-input[value="0"]) .re-effort-flare {
        opacity: 0;
      }

      body.${ACTIVE_CLASS} .re-effort.is-dragging .re-effort-flare {
        filter: blur(1.5px) saturate(1.38) brightness(1.22);
      }

      body.${ACTIVE_CLASS} .re-effort .re-effort-knob {
        box-shadow:
          0 0 0 2px rgba(94, 133, 222, 0.16),
          0 0 13px rgba(119, 82, 205, 0.38),
          0 2px 7px rgba(34, 61, 88, 0.24);
      }

      body.${ACTIVE_CLASS} .re-effort-slider[data-effort="off"] .re-effort-knob,
      body.${ACTIVE_CLASS} .re-effort-slider:has(.re-effort-input[value="0"]) .re-effort-knob {
        box-shadow:
          0 0 0 2px rgba(74, 139, 190, 0.12),
          0 3px 9px rgba(42, 86, 119, 0.18);
      }

      body.${ACTIVE_CLASS} .re-effort-slider[data-top="true"] .re-effort-knob,
      body.${ACTIVE_CLASS} .re-effort-slider[data-effort="max"] .re-effort-knob {
        box-shadow:
          0 0 0 3px rgba(126, 99, 221, 0.18),
          0 0 20px rgba(132, 83, 225, 0.62),
          0 0 30px rgba(64, 126, 218, 0.28),
          0 3px 8px rgba(34, 61, 88, 0.24);
      }

      body.${ACTIVE_CLASS} button,
      body.${ACTIVE_CLASS} [role="button"],
      body.${ABYSS_ACTIVE_CLASS} button,
      body.${ABYSS_ACTIVE_CLASS} [role="button"] {
        transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease, transform 120ms cubic-bezier(0.23, 1, 0.32, 1);
      }

      body.${ACTIVE_CLASS} button:active,
      body.${ACTIVE_CLASS} [role="button"]:active,
      body.${ABYSS_ACTIVE_CLASS} button:active,
      body.${ABYSS_ACTIVE_CLASS} [role="button"]:active {
        transform: scale(0.975);
      }

      body.${ACTIVE_CLASS} :focus-visible {
        outline: 2px solid rgba(20, 104, 168, 0.62);
        outline-offset: 2px;
      }

      body.${ABYSS_ACTIVE_CLASS} :focus-visible {
        outline: 2px solid rgba(140, 114, 242, 0.72);
        outline-offset: 2px;
      }

      @media (prefers-reduced-motion: reduce) {
        body.${ACTIVE_CLASS} button,
        body.${ACTIVE_CLASS} [role="button"],
        body.${ABYSS_ACTIVE_CLASS} button,
        body.${ABYSS_ACTIVE_CLASS} [role="button"] {
          transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
        }

        body.${ACTIVE_CLASS} button:active,
        body.${ACTIVE_CLASS} [role="button"]:active,
        body.${ABYSS_ACTIVE_CLASS} button:active,
        body.${ABYSS_ACTIVE_CLASS} [role="button"]:active {
          transform: none;
        }

        .wm-session-status,
        .wm-session-status-running .wm-status-mark::after {
          animation: none;
        }

        .wm-session-status {
          transition: opacity 120ms ease, color 120ms ease, border-color 120ms ease;
        }
      }

      @media (prefers-reduced-transparency: reduce) {
        body.${ACTIVE_CLASS},
        body.${ACTIVE_CLASS}[data-wm-glass] {
          --dsw-alias-bg-base: #eef7fe !important;
          --dsw-alias-bg-layer-1: #f8fbfe !important;
          --dsw-alias-bg-layer-2: #e5f1fa !important;
          --dsw-alias-bg-overlay: #f8fbfe !important;
          --dsw-specific-sidebar-fill: #deedf8 !important;
          --dsw-specific-input-major: #f8fbfe !important;
          --dsw-specific-menu: #f8fbfe !important;
          --dsw-mask-blur: none !important;
        }

        body.${ABYSS_ACTIVE_CLASS},
        body.${ABYSS_ACTIVE_CLASS}[data-wm-glass] {
          --dsw-alias-bg-base: #080b14 !important;
          --dsw-alias-bg-layer-1: #0f1726 !important;
          --dsw-alias-bg-layer-2: #172236 !important;
          --dsw-alias-bg-overlay: #172236 !important;
          --dsw-specific-sidebar-fill: #0f1726 !important;
          --dsw-specific-input-major: #172236 !important;
          --dsw-specific-menu: #131d2f !important;
          --dsw-mask-blur: none !important;
        }
      }

      @media (prefers-contrast: more) {
        body.${ACTIVE_CLASS} {
          --dsw-alias-label-secondary: #3c566b !important;
          --dsw-alias-label-tertiary: #506b80 !important;
          --dsw-alias-border-l2: rgba(23, 63, 92, 0.38) !important;
          --dsw-alias-border-l3: rgba(16, 55, 83, 0.56) !important;
          --dsw-alias-bg-layer-1: rgba(255, 255, 255, 0.9) !important;
        }

        body.${ABYSS_ACTIVE_CLASS} {
          --dsw-alias-label-secondary: #c0cada !important;
          --dsw-alias-label-tertiary: #a3afc2 !important;
          --dsw-alias-border-l2: rgba(188, 201, 222, 0.38) !important;
          --dsw-alias-border-l3: rgba(204, 214, 231, 0.52) !important;
          --dsw-alias-bg-layer-1: rgba(15, 23, 38, 0.99) !important;
        }
      }

      body.${ACTIVE_CLASS}[data-wm-text-contrast="enhanced"] {
        --dsw-alias-label-primary: #0c263b !important;
        --dsw-alias-label-secondary: #3c566b !important;
        --dsw-alias-label-tertiary: #506b80 !important;
      }

      body.${ABYSS_ACTIVE_CLASS}[data-wm-text-contrast="enhanced"] {
        --dsw-alias-label-primary: #f2f5fc !important;
        --dsw-alias-label-secondary: #c0cada !important;
        --dsw-alias-label-tertiary: #a3afc2 !important;
      }
    `;

    const backdropSelector = `body:is(.${ACTIVE_CLASS}, .${ABYSS_ACTIVE_CLASS})[data-wm-backdrop][data-wm-canvas]`;
    const accentSelector = `body:is(.${ACTIVE_CLASS}, .${ABYSS_ACTIVE_CLASS})[data-wm-accent-mode="custom"]`;
    const accentPaletteSelector = `body:is(.${ACTIVE_CLASS}, .${ABYSS_ACTIVE_CLASS})[data-wm-palette][data-wm-accent-mode="custom"]`;
    const accentDeepSidebarSelector = `body:is(.${ACTIVE_CLASS}, .${ABYSS_ACTIVE_CLASS})[data-wm-palette][data-wm-sidebar][data-wm-accent-mode="custom"]`;
    const backdropCss = `
      ${accentSelector},
      ${accentPaletteSelector},
      ${accentDeepSidebarSelector} {
        --dsw-alias-button-primary-fill: var(--wm-custom-raw) !important;
        --dsw-alias-button-primary-hover: var(--wm-custom-btn-hover) !important;
        --dsw-alias-label-primary-foreground: var(--wm-custom-btn-fg) !important;
        --dsw-alias-brand-primary: var(--wm-custom-ink) !important;
        --dsw-alias-brand-primary-new-colorprimary-new-color: var(--wm-custom-ink) !important;
        --dsw-alias-link: var(--wm-custom-ink) !important;
        --dsw-alias-markdown-citation: var(--wm-custom-ink) !important;
        --dsw-alias-state-business-primary: var(--wm-custom-ink) !important;
        --dsw-alias-state-business-tertiary: var(--wm-custom-business-tertiary) !important;
        --dsw-alias-button-info-fill: var(--wm-custom-btn-info-fill) !important;
        --dsw-alias-button-info-hover: var(--wm-custom-btn-info-hover) !important;
        --dsw-alias-button-ghost-active-fill: var(--wm-custom-ghost-active-fill) !important;
        --dsw-alias-interactive-bg-primary: var(--wm-custom-interactive-primary) !important;
        --dsw-alias-interactive-bg-hover: var(--wm-custom-interactive-hover) !important;
        --dsw-alias-interactive-bg-active: var(--wm-custom-interactive-active) !important;
        --dsw-specific-sidebar-nav-item-active: var(--wm-custom-sidebar-nav-active) !important;
        --dsw-specific-sidebar-nav-item-active-accent: var(--wm-custom-ink) !important;
        --dsw-focus-ring-color: var(--wm-custom-ink) !important;
      }

      ${accentSelector} :focus-visible {
        outline: 2px solid var(--wm-custom-ink) !important;
        outline-offset: 2px !important;
      }

      ${accentSelector} .wm-session-status:not(.wm-session-status-waiting):not(.wm-session-status-complete) .wm-status-mark {
        background: var(--wm-custom-raw) !important;
        color: var(--wm-custom-btn-fg) !important;
      }

      ${accentSelector} .wm-session-status-running .wm-status-mark::after {
        border-color: var(--wm-custom-interactive-primary) !important;
      }

      ${accentSelector} .wm-settings-option.is-selected,
      ${accentPaletteSelector} .wm-settings-option.is-selected,
      ${accentDeepSidebarSelector} .wm-settings-option.is-selected {
        color: var(--dsw-alias-label-primary) !important;
        background: var(--wm-custom-interactive-active) !important;
      }

      .wm-accent-controls { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
      .wm-accent-picker {
        width: 28px;
        height: 28px;
        padding: 0;
        border: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.2));
        border-radius: 6px;
        background: transparent;
        cursor: pointer;
      }
      .wm-accent-picker::-webkit-color-swatch-wrapper { padding: 2px; }
      .wm-accent-picker::-webkit-color-swatch { border: 0; border-radius: 4px; }
      .wm-accent-hex {
        font-family: var(--dsw-font-mono, monospace);
        font-size: 12px;
        color: var(--dsw-alias-label-secondary);
        user-select: all;
      }
      .wm-accent-preview {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-left: 4px;
      }
      .wm-accent-preview-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 24px;
        padding: 2px 8px;
        border: 0;
        border-radius: 6px;
        font: inherit;
        font-size: 11px;
        font-weight: 500;
        cursor: default;
      }
      .wm-accent-preview-link {
        font-size: 12px;
        text-decoration: underline;
        cursor: default;
      }

      body.${ACTIVE_CLASS} {
        --wm-base-rgb: 239 247 254; --wm-sidebar-rgb: 228 240 249;
        --wm-layer1-rgb: 255 255 255; --wm-layer2-rgb: 230 242 251; --wm-layer3-rgb: 252 254 255;
      }
      body.${ABYSS_ACTIVE_CLASS}[data-wm-palette="ocean"] {
        --wm-base-rgb: 8 11 20; --wm-sidebar-rgb: 15 23 38;
        --wm-layer1-rgb: 15 23 38; --wm-layer2-rgb: 23 34 54; --wm-layer3-rgb: 28 40 62;
      }
      body.${ACTIVE_CLASS}[data-wm-sidebar="deep"] { --wm-sidebar-rgb: 207 229 246; }
      body.${ABYSS_ACTIVE_CLASS}[data-wm-palette="ocean"][data-wm-sidebar="deep"] { --wm-sidebar-rgb: 10 16 28; }
      #wm-backdrop { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
      #wm-backdrop .wm-backdrop-media { width: 100%; height: 100%; object-fit: cover; display: block;
        filter: brightness(var(--wm-bg-brightness, .7)) blur(var(--wm-bg-blur, 0px)); }
      #wm-backdrop .wm-backdrop-mask { position: absolute; inset: 0; background: rgb(var(--wm-base-rgb) / var(--wm-bg-mask, .45)); }
      ${backdropSelector} #root { position: relative; z-index: 1; }
      ${backdropSelector} {
        --dsw-alias-bg-base: transparent !important; --dsw-alias-bg-primary: transparent !important;
        --dsw-alias-bg-layer-1: rgb(var(--wm-layer1-rgb) / var(--wm-ui-alpha)) !important;
        --dsw-alias-bg-layer-2: rgb(var(--wm-layer2-rgb) / var(--wm-ui-alpha)) !important;
        --dsw-alias-bg-layer-3: rgb(var(--wm-layer3-rgb) / var(--wm-ui-alpha)) !important;
        --dsw-specific-sidebar-fill: rgb(var(--wm-sidebar-rgb) / var(--wm-ui-alpha)) !important;
        --dsw-alias-bg-overlay: rgb(var(--wm-layer2-rgb)) !important;
        --dsw-specific-menu: rgb(var(--wm-layer2-rgb)) !important;
        --dsw-specific-selector: rgb(var(--wm-layer3-rgb)) !important;
        --dsw-specific-tip: rgb(var(--wm-layer2-rgb)) !important;
        --dsw-specific-input-major: linear-gradient(rgb(var(--wm-layer2-rgb)), rgb(var(--wm-layer1-rgb))) !important;
      }
      /* V1: the Windows title bar strip must stay opaque whatever the surface transparency is.
         The host paints BOTH the top strip and the whole application frame with the sidebar
         fill: the frame gets padding-top equal to the title bar height plus that same fill as
         its background, while its ::before is the drag strip covering inset 0 0 auto at exactly
         the title bar height. Making the frame opaque therefore covered the entire wallpaper
         (rc.14 defect); the frame background is cleared instead and only the top strip is
         painted, which still covers the padded top band. The sidebar and the content column keep
         their own backgrounds, so they stay translucent.
         V2: the same transparency removed the composer's protection. rc.14/rc.15 painted the seat,
         the overlay and the card with one flat colour, rc.16 turned the seat into a wide dark ramp,
         and both covered the wallpaper around the input box (R4/R5). The model is now:
           - only the input card is opaque, with the surface the host already gives it;
           - nothing else in the composer is painted, so the wallpaper stays visible around and
             below the card;
           - the chat history is cut off by a mask on the message layer itself, so text reaching
             the input area fades out without drawing any background over the wallpaper.
         Scope note: these selectors rely on the hooks the current host ships (the
         data-windows-titlebar attribute, data-phase, and its component class names). They are
         not a public stable API, so if a host update renames them the rules simply stop
         matching and the theme looks like it did before this fix; nothing else breaks. */
      html[data-windows-titlebar]:has(${backdropSelector}) .BynINW_frame {
        background: transparent !important;
      }
      html[data-windows-titlebar]:has(${backdropSelector}) .BynINW_frame::before {
        background: rgb(var(--wm-base-rgb)) !important;
      }
      /* The input card alone is opaque, with the surface it already has. */
      html:has(${backdropSelector}) .Dc7zOa_composerSeat .RlGAzG_card {
        background: var(--dsw-specific-input-major) !important;
      }
      /* Per-region backgrounds: the user decides which areas cover the wallpaper with their own
         colour. Each rule paints one local container, and only while a background is actually
         active, so the frame, the input surroundings, menus and every other region keep the
         behaviour above. The colours are the theme's own: the sidebar colour it already uses
         (including the deep variant and each palette) and the base colour for the chat column.
         The chat switch covers the whole right-hand column, which is the centre column: the session
         title and the conversation/trace tabs live in that column above the body, so painting only
         the body left them showing the wallpaper (R7). The column, not the frame, is painted, so the
         window title bar strip and the left region stay as they are. */
      ${backdropSelector}[data-wm-opaque-sidebar] .BynINW_sidebarCol {
        background: rgb(var(--wm-sidebar-rgb)) !important;
      }
      ${backdropSelector}[data-wm-opaque-chat] .BynINW_centerCol {
        background: rgb(var(--wm-base-rgb)) !important;
        /* The host rounds this corner by 16px. An opaque chat must also cover its tip;
           otherwise the transparent frame exposes a wedge of wallpaper beside the sidebar. */
        border-top-left-radius: 0 !important;
      }
      ${backdropSelector}[data-wm-chat-tint] .BynINW_centerCol {
        background: rgb(var(--wm-base-rgb) / var(--wm-chat-alpha)) !important;
      }
      /* The session list ends with its own 24px fade to the sidebar fill, which softens the last
         rows against the account area in the normal theme. In the wallpaper state that fill is
         translucent, so the fade lays a second layer of the same colour over the wallpaper and the
         bottom of the list turns into a measurably darker rectangle (reproduced in
         qa/sidebar-bottom-band.mjs: 39.3 to 32.4 luminance across the band, with hard left and right
         edges). It is removed only when it would do that: with a background active and the sidebar
         still allowed to show it. With the sidebar set to its own solid colour, and in the normal
         theme, the host's fade is left alone. */
      ${backdropSelector}:not([data-wm-opaque-sidebar]) ._9lTDKa_fade {
        background: none !important;
      }
      /* Only measured message siblings receive this attribute. Insets refer to their border
         box, updated on scroll/resize/session changes; the card and its surroundings stay intact. */
      html:has(${backdropSelector}) [data-wm-history-clip] {
        clip-path: inset(0px 0px var(--wm-history-clip-bottom, 0px) 0px) !important;
      }
      html:has(${backdropSelector}) [data-wm-message-port] {
        position: static !important;
        margin-bottom: var(--wm-port-reserve) !important;
      }
      html:has(${backdropSelector}) [data-wm-message-port] [data-wm-history-clip] {
        clip-path: none !important;
      }
      html:has(${backdropSelector}) [data-wm-fixed-composer] {
        position: absolute !important;
        bottom: 0 !important;
        left: var(--wm-port-left) !important;
        right: auto !important;
        width: var(--wm-port-width) !important;
      }
      @media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
        ${backdropSelector} { --wm-ui-alpha: 1 !important; --dsw-alias-bg-base: rgb(var(--wm-base-rgb)) !important;
          --dsw-alias-bg-primary: rgb(var(--wm-base-rgb)) !important; }
        ${backdropSelector} #wm-backdrop { display: none; }
      }
      .wm-settings-label, .wm-settings-hint { display: block; }
      .wm-settings-subtitle { margin: 24px 0 8px; font-size: 14px; font-weight: 500; }
      .wm-media-actions, .wm-range-control { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
      .wm-inline-field { display: inline-flex; align-items: center; gap: 6px; }
      .wm-inline-label { font-size: 12px; opacity: .8; }
      .wm-inline-field select { background: var(--dsw-alias-bg-layer-2); color: inherit; border-radius: 6px;
        border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.2)); padding: 3px 6px; font: inherit; }
      /* Wallpaper Engine area only: the description gets its own full-width line and the
         controls sit below it, wrapping when the settings panel is narrow. A two-column row
         here used to collapse the text column to zero width, which wrapped the hint one
         character per line. The other rows (image/video, sliders, theme) keep their layout. */
      .wm-wallpaper-row {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        justify-content: flex-start;
      }
      .wm-wallpaper-copy {
        width: 100%;
        max-width: none;
        padding: 4px 0 0;
      }
      .wm-wallpaper-copy .wm-settings-hint {
        max-width: 68ch;
        overflow-wrap: anywhere;
      }
      .wm-wallpaper-actions {
        /* display is required: flex-wrap/gap/flex on the children do nothing in a block box,
           which is why rc.14 shipped a group with a declared 8px gap and an actual 0px one. */
        display: flex;
        flex-wrap: wrap;
        align-items: stretch;
        justify-content: flex-start;
        gap: 8px;
        flex-shrink: 1;
        min-width: 0;
        max-width: 100%;
      }
      .wm-wallpaper-fields {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 12px;
        min-width: 0;
        max-width: 100%;
      }
      .wm-wallpaper-field {
        flex: 0 1 auto;
        min-width: 0;
        max-width: 100%;
      }
      .wm-wallpaper-field select {
        min-width: 0;
        max-width: 100%;
      }
      /* The bounded wallpaper list. It gets its own width so it stays readable in a narrow panel,
         scrolls instead of stretching the settings area, and keeps the refresh control and the
         three actions visible while it scrolls. */
      .wm-wallpaper-field-selection {
        flex: 1 1 320px;
      }
      .wm-wallpaper-selection {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
        max-width: 100%;
      }
      .wm-wallpaper-selection-head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 10px;
        min-width: 0;
      }
      .wm-wallpaper-selected,
      .wm-wallpaper-playing {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 12px;
        line-height: 18px;
        color: var(--dsw-alias-label-secondary);
      }
      .wm-wallpaper-playing {
        color: var(--dsw-alias-label-primary);
      }
      .wm-wallpaper-refresh {
        margin-left: auto;
        flex: 0 0 auto;
        min-height: 26px;
        padding: 0 10px;
        font-size: 12px;
        line-height: 18px;
        border-radius: 6px;
        background: rgb(var(--wm-layer2-rgb)) !important;
        border: 1px solid var(--dsw-alias-border-l2) !important;
        color: var(--dsw-alias-label-primary);
      }
      .wm-wallpaper-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
        max-height: 168px;
        overflow-y: auto;
        padding: 4px;
        border-radius: 8px;
        background: rgb(var(--wm-layer1-rgb) / 0.6);
        border: 1px solid var(--dsw-alias-border-l2);
      }
      .wm-wallpaper-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
        width: 100%;
        padding: 6px 8px;
        text-align: left;
        border-radius: 6px;
        background: transparent;
        border: 1px solid transparent;
        color: var(--dsw-alias-label-primary);
      }
      .wm-wallpaper-item:hover:not([aria-disabled="true"]) {
        background: rgb(var(--wm-layer2-rgb)) !important;
      }
      .wm-wallpaper-item.is-selected {
        border-color: var(--dsw-alias-brand-primary) !important;
        background: rgb(var(--wm-layer2-rgb)) !important;
      }
      /* An unavailable item stays readable and explainable; it is visibly inert, not hidden. */
      .wm-wallpaper-item[aria-disabled="true"] {
        opacity: 0.62;
        cursor: not-allowed;
      }
      .wm-wallpaper-item-title {
        font-size: 13px;
        line-height: 18px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .wm-wallpaper-item-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 8px;
        font-size: 11px;
        line-height: 16px;
        color: var(--dsw-alias-label-secondary);
      }
      .wm-wallpaper-item-badge.is-verified {
        color: var(--dsw-alias-state-success-primary, #64cda2);
      }
      .wm-wallpaper-list-status {
        margin: 0;
        font-size: 12px;
        line-height: 17px;
        color: var(--dsw-alias-label-secondary);
      }
      .wm-wallpaper-list-status.is-warning {
        color: var(--dsw-alias-state-warn-primary, #e3a85d);
      }
      /* V3: the three actions are one equally sized group with a visible surface, so stop is
         never left as a small transparent label on a line of its own. Only the WE buttons get
         this treatment; the shared settings option style is untouched for other settings. */
      .wm-wallpaper-button {
        flex: 1 1 0;
        min-width: 96px;
        min-height: 36px;
        padding: 0 14px;
        font-size: 14px;
        line-height: 20px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgb(var(--wm-layer2-rgb)) !important;
        border: 1px solid var(--dsw-alias-border-l2) !important;
        color: var(--dsw-alias-label-primary);
      }
      .wm-wallpaper-button:hover:not(:disabled) {
        background: rgb(var(--wm-layer3-rgb)) !important;
        border-color: var(--dsw-alias-brand-primary) !important;
      }
      /* Below this width the three buttons genuinely cannot share one row, so the whole group
         becomes one column on purpose: every action is full width and stop is never the lone
         straggler on a second line. A container query keeps the decision tied to the group's own
         width, which is what the settings panel changes; hosts without container query support
         just keep the wrapping row above. */
      @supports (container-type: inline-size) {
        .wm-wallpaper-actions {
          container-type: inline-size;
        }
        @container (max-width: 320px) {
          .wm-wallpaper-actions {
            flex-direction: column;
            align-items: stretch;
          }
          .wm-wallpaper-button {
            flex: 0 0 auto;
            width: 100%;
          }
        }
      }
      /* The checkbox row keeps the two-column shape, but its text column may shrink and the
         control itself never does, so a narrow panel cannot squeeze the label to nothing.
         Stretching is reset explicitly: a host form rule can set align-self or a width on
         inputs, and without this the box would fill the row instead of staying square. */
      .wm-wallpaper-auto-start {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px 20px;
      }
      .wm-wallpaper-auto-start .wm-settings-copy {
        flex: 1 1 auto;
        min-width: 0;
        width: auto;
      }
      .wm-wallpaper-auto-start input[type="checkbox"] {
        flex: 0 0 auto;
        align-self: center;
        inline-size: 16px;
        block-size: 16px;
        width: 16px;
        height: 16px;
        min-width: 16px;
        max-width: 16px;
        margin: 0;
      }
      /* The region switches share the checkbox row's geometry: text column on the left, a fixed
         square box on the right, wrapping in a narrow panel instead of squeezing the label. */
      .wm-region-row {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px 20px;
      }
      .wm-region-row .wm-settings-copy {
        flex: 1 1 auto;
        min-width: 0;
        width: auto;
      }
      .wm-region-row input[type="checkbox"] {
        flex: 0 0 auto;
        align-self: center;
        inline-size: 16px;
        block-size: 16px;
        width: 16px;
        height: 16px;
        min-width: 16px;
        max-width: 16px;
        margin: 0;
      }
      .wm-range-control input { width: 160px; accent-color: var(--dsw-alias-brand-primary); }
      .wm-range-control output { min-width: 44px; text-align: right; font-variant-numeric: tabular-nums; font-size: 12px; }
      .wm-media-name { max-width: 32rem; overflow-wrap: anywhere; }
      .wm-palette-swatch { display: inline-block; width: 12px; height: 12px; border: 1px solid currentColor;
        border-radius: 50%; vertical-align: -2px; margin-right: 5px; }
      .wm-settings-option:disabled { opacity: .5; cursor: wait; }
      .wm-settings-option:focus-visible, .wm-settings-reset:focus-visible, .wm-range-control input:focus-visible {
        outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px;
      }
      .wm-wallpaper-presets-row { align-items: flex-start; }
      .wm-wallpaper-preset-target { font-size: 12px; color: var(--dsw-alias-label-primary); margin-top: 2px; font-weight: 500; }
      .wm-wallpaper-preset-actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
      .wm-preset-button { white-space: nowrap; }
      @media (max-width: 720px) {
        .wm-settings-segment { flex-wrap: wrap; }
        .wm-range-control { width: 100%; }
        .wm-range-control input { flex: 1; min-width: 0; }
        .wm-wallpaper-preset-actions { width: 100%; justify-content: flex-start; }
      }
    `;

    const DETACHABLE_MODES = Object.freeze({
      DOCKED: 'docked',
      DETACHING: 'detaching',
      DETACHED: 'detached',
      DOCKING: 'docking',
    });

    const DETACHABLE_ACTIONS = Object.freeze({
      SET_SETTING: 'set-setting',
      RESET_SETTINGS: 'reset-settings',
      SAVE_PRESET: 'save-preset',
      APPLY_PRESET: 'apply-preset',
      REMOVE_PRESET: 'remove-preset',
      REQUEST_DOCK: 'request-dock',
      CLOSE_WINDOW: 'close-window',
      START_WALLPAPER: 'start-wallpaper',
      STOP_WALLPAPER: 'stop-wallpaper',
      REFRESH_CATALOG: 'refresh-catalog',
    });

    const DETACHABLE_RANGE_BOUNDS = Object.freeze({
      brightness: Object.freeze({ min: 20, max: 120 }),
      mask: Object.freeze({ min: 0, max: 90 }),
      blur: Object.freeze({ min: 0, max: 24 }),
      surface: Object.freeze({ min: 40, max: 100 }),
      chatBackdrop: Object.freeze({ min: 0, max: 100 }),
    });

    function buildAppearanceSnapshot(controller, revision = 1) {
      const currentSettings = controller.read ? controller.read() : controller.getSettingsSnapshot?.() || {};
      const presets = controller.presets?.getSnapshot ? controller.presets.getSnapshot() : { version: 1, entries: {} };
      const wp = controller.wallpaper?.getStatus ? controller.wallpaper.getStatus() : null;
      const presetTarget = controller.presets?.resolveTarget
        ? Object.freeze({ ...controller.presets.resolveTarget() })
        : null;

      const catalogSource = (typeof controller.wallpaper?.getLibrarySnapshot === 'function'
        ? controller.wallpaper.getLibrarySnapshot()
        : controller.catalog) || { items: [], state: 'idle', loaded: false, loading: false, truncated: false, error: null, scannedAt: null, rootWarnings: [] };

      const rawItems = Array.isArray(catalogSource.items) ? [...catalogSource.items] : [];
      if (catalogSource.state !== 'failed' && !rawItems.some(item => item.id === 'lucy')) {
        const verified = Array.isArray(wp?.host?.scenes) ? wp.host.scenes.find(scene => scene.id === 'lucy') : null;
        rawItems.unshift({
          id: 'lucy',
          title: 'Lucy',
          type: 'scene',
          available: verified ? verified.available !== false : true,
          playbackVerified: true,
          reason: null,
          warnings: [],
          previewRef: { wallpaperId: 'lucy', kind: 'preview' },
        });
      }

      const catalog = Object.freeze({
        items: Object.freeze(rawItems),
        state: catalogSource.state || 'idle',
        loaded: Boolean(catalogSource.loaded),
        loading: Boolean(catalogSource.loading),
        truncated: Boolean(catalogSource.truncated),
        error: catalogSource.error || null,
        scannedAt: catalogSource.scannedAt || null,
        rootWarnings: Array.isArray(catalogSource.rootWarnings) ? catalogSource.rootWarnings : [],
      });

      return Object.freeze({
        protocolVersion: 1,
        revision,
        settings: Object.freeze({ ...currentSettings }),
        presets,
        presetTarget,
        catalog,
        wallpaper: Object.freeze({
          state: wp?.state ?? 'idle',
          activeSceneId: wp?.activeSceneId ?? wp?.host?.activeSceneId ?? null,
          cleanupPending: Boolean(wp?.cleanupPending),
        }),
      });
    }

    function validateDetachableAction(action) {
      if (!action || typeof action !== 'object' || Array.isArray(action)) {
        return { valid: false, error: 'action-invalid-object' };
      }
      if (!Object.values(DETACHABLE_ACTIONS).includes(action.type)) {
        return { valid: false, error: 'action-unsupported-type' };
      }
      if (!action.clientActionId || typeof action.clientActionId !== 'string') {
        return { valid: false, error: 'action-missing-client-id' };
      }
      if (!Number.isInteger(action.expectedRevision) || action.expectedRevision <= 0) {
        return { valid: false, error: 'action-invalid-expected-revision' };
      }
      if (action.type === DETACHABLE_ACTIONS.SET_SETTING) {
        if (!isValidSetting(action.key, action.value)) {
          return { valid: false, error: 'setting-key-disallowed', key: action.key };
        }
        if (Object.hasOwn(DETACHABLE_RANGE_BOUNDS, action.key)) {
          if (typeof action.value !== 'number' || !Number.isFinite(action.value)) {
            return { valid: false, error: 'setting-value-not-numeric', key: action.key };
          }
          const bounds = DETACHABLE_RANGE_BOUNDS[action.key];
          if (action.value < bounds.min || action.value > bounds.max) {
            return { valid: false, error: 'setting-value-out-of-bounds', key: action.key, min: bounds.min, max: bounds.max };
          }
        }
      } else if (
        action.type === DETACHABLE_ACTIONS.SAVE_PRESET ||
        action.type === DETACHABLE_ACTIONS.APPLY_PRESET ||
        action.type === DETACHABLE_ACTIONS.REMOVE_PRESET
      ) {
        if (!isSceneId(action.sceneId)) {
          return { valid: false, error: 'preset-scene-invalid', sceneId: action.sceneId };
        }
      } else if (action.type === DETACHABLE_ACTIONS.START_WALLPAPER) {
        if (!isSceneId(action.sceneId)) {
          return { valid: false, error: 'wallpaper-scene-invalid', sceneId: action.sceneId };
        }
        if (action.mode !== undefined && !['preview', 'daily'].includes(action.mode)) {
          return { valid: false, error: 'wallpaper-mode-invalid', mode: action.mode };
        }
      }
      return { valid: true };
    }

    async function executeAuthoritativeAction({
      controller,
      action,
      expectedRevisionCheck = true,
      currentRevision = 1,
      actionCache = null,
      onRequestDock = null,
      getSnapshot = null,
    }) {
      const val = validateDetachableAction(action);
      if (!val.valid) {
        return {
          ok: false,
          error: val.error,
          snapshot: typeof getSnapshot === 'function' ? getSnapshot() : undefined,
        };
      }

      const fingerprint = JSON.stringify({
        type: action.type,
        clientActionId: action.clientActionId,
        expectedRevision: action.expectedRevision,
        key: action.key,
        value: action.value,
        sceneId: action.sceneId,
        mode: action.mode,
      });

      if (actionCache && actionCache.has(action.clientActionId)) {
        const cached = actionCache.get(action.clientActionId);
        if (cached.fingerprint !== fingerprint) {
          return {
            ok: false,
            error: 'action-payload-mismatch',
            clientActionId: action.clientActionId,
            snapshot: typeof getSnapshot === 'function' ? getSnapshot() : undefined,
          };
        }
        return { ...cached.result, duplicate: true, snapshot: typeof getSnapshot === 'function' ? getSnapshot() : undefined };
      }

      if (expectedRevisionCheck && action.expectedRevision !== currentRevision) {
        return {
          ok: false,
          error: 'stale-revision',
          expectedRevision: action.expectedRevision,
          latestRevision: currentRevision,
          snapshot: typeof getSnapshot === 'function' ? getSnapshot() : undefined,
        };
      }

      let executionResult = null;
      try {
        if (action.type === DETACHABLE_ACTIONS.SET_SETTING) {
          const res = controller.set(action.key, action.value);
          if (!res || typeof res !== 'object') {
            executionResult = { ok: false, error: 'set-setting-rejected' };
          } else {
            executionResult = { ok: true };
          }
        } else if (action.type === DETACHABLE_ACTIONS.RESET_SETTINGS) {
          controller.reset?.();
          executionResult = { ok: true };
        } else if (
          action.type === DETACHABLE_ACTIONS.SAVE_PRESET ||
          action.type === DETACHABLE_ACTIONS.APPLY_PRESET ||
          action.type === DETACHABLE_ACTIONS.REMOVE_PRESET
        ) {
          const op =
            action.type === DETACHABLE_ACTIONS.SAVE_PRESET
              ? 'save'
              : action.type === DETACHABLE_ACTIONS.APPLY_PRESET
              ? 'apply'
              : 'remove';
          const fn = controller.presets?.[op];
          if (typeof fn !== 'function') {
            executionResult = { ok: false, error: `preset-op-unsupported: ${op}` };
          } else {
            const res = fn(action.sceneId, action.name);
            if (res && typeof res === 'object' && res.ok === false) {
              executionResult = { ok: false, error: res.error || 'preset-op-failed', details: res };
            } else {
              executionResult = { ok: true, result: res };
            }
          }
        } else if (action.type === DETACHABLE_ACTIONS.START_WALLPAPER) {
          const currentSettings = typeof controller.read === 'function'
            ? controller.read()
            : (typeof controller.getSettingsSnapshot === 'function' ? controller.getSettingsSnapshot() : null);
          const currentSelectedScene = currentSettings?.weScene || 'lucy';
          const currentMode = action.mode || currentSettings?.weMode || 'daily';

          const wp = controller.wallpaper?.getStatus ? controller.wallpaper.getStatus() : null;
          const wpState = wp?.state ?? 'idle';
          const cleanupPending = Boolean(wp?.cleanupPending);
          const activeSceneId = wp?.activeSceneId ?? wp?.host?.activeSceneId ?? null;

          if (action.sceneId !== currentSelectedScene) {
            executionResult = {
              ok: false,
              error: 'target-drift-or-mismatch',
              selectedSceneId: currentSelectedScene,
              requestedSceneId: action.sceneId,
            };
          } else if (!['idle', 'stopped', 'error'].includes(wpState) || cleanupPending || wpState === 'cleanup-failed' || activeSceneId != null) {
            executionResult = { ok: false, error: 'playback-active-or-transitioning', state: wpState, activeSceneId };
          } else {
            const catalog = controller.wallpaper?.getLibrarySnapshot ? controller.wallpaper.getLibrarySnapshot() : null;
            const catalogReady = catalog?.state === 'ready' && catalog?.loaded === true;
            if (!catalogReady) {
              executionResult = { ok: false, error: 'catalog-not-ready', state: catalog?.state || 'unloaded' };
            } else {
              const items = Array.isArray(catalog?.items) ? catalog.items : [];
              const isLucy = action.sceneId === 'lucy';
              const catalogItem = items.find(item => item.id === action.sceneId);

              const lucyHostScene = Array.isArray(wp?.host?.scenes) ? wp.host.scenes.find(s => s.id === 'lucy') : null;
              const lucyAvailable = lucyHostScene ? lucyHostScene.available !== false : true;

              if (isLucy && !lucyAvailable) {
                executionResult = { ok: false, error: 'scene-unavailable', sceneId: 'lucy', reason: 'sample_unavailable' };
              } else if (!isLucy && (!catalogItem || catalogItem.available !== true || !['scene', 'video', 'web'].includes(catalogItem.type))) {
                executionResult = {
                  ok: false,
                  error: 'scene-unavailable',
                  sceneId: action.sceneId,
                  reason: catalogItem?.reason || 'not_available',
                };
              } else if (typeof controller.wallpaper?.start === 'function') {
                try {
                  const startRes = await controller.wallpaper.start(action.sceneId, currentMode);
                  if (!startRes || startRes.ok === false || startRes.state === 'error' || startRes.state === 'cleanup-failed') {
                    executionResult = {
                      ok: false,
                      error: startRes?.error || `start-failed: ${startRes?.state || 'error'}`,
                      state: startRes?.state || 'error',
                      result: startRes,
                    };
                  } else {
                    executionResult = { ok: true, activeSceneId: action.sceneId, result: startRes };
                  }
                } catch (err) {
                  executionResult = { ok: false, error: `start-failed: ${err.message}` };
                }
              } else {
                executionResult = { ok: false, error: 'wallpaper-controller-unavailable' };
              }
            }
          }
        } else if (action.type === DETACHABLE_ACTIONS.STOP_WALLPAPER) {
          if (typeof controller.wallpaper?.stop === 'function') {
            try {
              const stopRes = await controller.wallpaper.stop('user');
              if (!stopRes || stopRes.ok === false || stopRes.state === 'cleanup-failed' || stopRes.state === 'error') {
                executionResult = {
                  ok: false,
                  error: stopRes?.error || `stop-failed: ${stopRes?.state || 'error'}`,
                  state: stopRes?.state || 'error',
                  result: stopRes,
                };
              } else {
                executionResult = { ok: true, result: stopRes };
              }
            } catch (err) {
              executionResult = { ok: false, error: `stop-failed: ${err.message}` };
            }
          } else {
            executionResult = { ok: false, error: 'wallpaper-controller-unavailable' };
          }
        } else if (action.type === DETACHABLE_ACTIONS.REFRESH_CATALOG) {
          if (typeof controller.wallpaper?.readLibrary === 'function') {
            try {
              const libRes = await controller.wallpaper.readLibrary({ refresh: true });
              if (!libRes || libRes.ok === false || libRes.state === 'failed') {
                executionResult = {
                  ok: false,
                  error: libRes?.error || 'refresh-failed',
                  state: libRes?.state || 'failed',
                  result: libRes,
                };
              } else {
                executionResult = { ok: true, result: libRes };
              }
            } catch (err) {
              executionResult = { ok: false, error: `refresh-failed: ${err.message}` };
            }
          } else {
            executionResult = { ok: false, error: 'wallpaper-controller-unavailable' };
          }
        } else if (
          action.type === DETACHABLE_ACTIONS.REQUEST_DOCK ||
          action.type === DETACHABLE_ACTIONS.CLOSE_WINDOW
        ) {
          if (typeof onRequestDock === 'function') {
            const dockRes = await onRequestDock();
            if (!dockRes || !dockRes.ok) {
              executionResult = { ok: false, error: dockRes?.error || 'dock-failed' };
            } else {
              executionResult = { ok: true, mode: DETACHABLE_MODES.DOCKED };
            }
          } else {
            executionResult = { ok: false, error: 'dock-handler-unavailable' };
          }
        } else {
          executionResult = { ok: false, error: 'action-unsupported-type' };
        }
      } catch (err) {
        executionResult = { ok: false, error: `controller-error: ${err.message}` };
      }

      if (actionCache && executionResult != null) {
        actionCache.set(action.clientActionId, {
          fingerprint,
          result: executionResult,
        });
        if (actionCache.size > 200) {
          const oldest = actionCache.keys().next().value;
          actionCache.delete(oldest);
        }
      }

      return { ...executionResult, snapshot: typeof getSnapshot === 'function' ? getSnapshot() : undefined };
    }

    function createMainRendererBridgeClient({ baseUrl, instanceId, mainToken, controller }) {
      let mode = DETACHABLE_MODES.DOCKED;
      let unconfirmedCleanup = false;
      let lastCleanupError = null;
      let revision = 1;
      let currentGeneration = 1;
      let authorConnected = false;
      let windowStateKnown = false;
      let activeToken = null;
      let sseAbort = null;
      let disposed = false;
      const subscribers = new Set();
      const actionCache = new Map();

      const getSnapshot = () => buildAppearanceSnapshot(controller, revision);

      function notify() {
        const snap = getSnapshot();
        for (const sub of subscribers) {
          try {
            sub({
              snapshot: snap,
              mode,
              revision,
              generation: currentGeneration,
              unconfirmedCleanup,
              windowStateKnown,
              lastError: lastCleanupError,
            });
          } catch {}
        }
      }

      const pushSnapshotToHost = async () => {
        if (disposed) return;
        try {
          await fetch(`${baseUrl}/api/main/snapshot`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Whale-Main-Token': mainToken,
              'X-Whale-Generation': String(currentGeneration),
            },
            body: JSON.stringify({ snapshot: getSnapshot(), revision, instanceId, generation: currentGeneration }),
          });
        } catch {}
      };

      const unsubSettings = controller.subscribeSettings?.(() => {
        revision++;
        notify();
        pushSnapshotToHost();
      });

      const unsubPresets = controller.presets?.subscribe?.(() => {
        revision++;
        notify();
        pushSnapshotToHost();
      });

      const unsubWallpaper = controller.wallpaper?.subscribeStatus?.(() => {
        revision++;
        notify();
        pushSnapshotToHost();
      });

      const unsubLibrary = controller.wallpaper?.subscribeLibrary?.(() => {
        revision++;
        notify();
        pushSnapshotToHost();
      });

      const handlePageUnload = () => {
        try {
          const url = `${baseUrl}/api/main/disconnect?mainToken=${encodeURIComponent(mainToken)}&instanceId=${encodeURIComponent(instanceId)}&generation=${encodeURIComponent(currentGeneration)}`;
          if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
            navigator.sendBeacon(url);
          } else {
            fetch(url, {
              method: 'POST',
              mode: 'no-cors',
              keepalive: true,
            }).catch(() => {});
          }
        } catch {}
      };

      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('pagehide', handlePageUnload);
        window.addEventListener('beforeunload', handlePageUnload);
      }

      async function connect() {
        const res = await fetch(`${baseUrl}/api/main/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instanceId, mainToken, snapshot: getSnapshot() }),
        });
        const data = await res.json();
        if (!data.ok) return data;

        currentGeneration = data.generation ?? 1;
        authorConnected = true;
        notify();
        sseAbort = new AbortController();
        startActionStream().catch(() => {});
        return data;
      }

      async function startActionStream() {
        try {
          const res = await fetch(
            `${baseUrl}/api/main/actions?instanceId=${encodeURIComponent(instanceId)}&mainToken=${encodeURIComponent(mainToken)}&generation=${encodeURIComponent(currentGeneration)}`,
            {
              headers: {
                'Accept': 'text/event-stream',
                'X-Whale-Generation': String(currentGeneration),
              },
              signal: sseAbort.signal,
            }
          );
          if (!res.ok || !res.body?.getReader) return;
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (!disposed) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const blocks = buffer.split('\n\n');
            buffer = blocks.pop() || '';
            for (const block of blocks) {
              if (!block.trim() || block.startsWith(':')) continue;
              let eventName = 'action';
              let eventData = '';
              for (const line of block.split('\n')) {
                if (line.startsWith('event:')) eventName = line.slice(6).trim();
                else if (line.startsWith('data:')) eventData = line.slice(5).trim();
              }
              if (eventName === 'action') {
                let parsed;
                try {
                  parsed = JSON.parse(eventData);
                } catch {
                  continue;
                }
                const { action, clientActionId } = parsed;
                let result;
                try {
                  result = await executeAuthoritativeAction({
                    controller,
                    action,
                    expectedRevisionCheck: true,
                    currentRevision: revision,
                    actionCache,
                    onRequestDock: async () => {
                      return await requestDock();
                    },
                    getSnapshot,
                  });
                } catch (err) {
                  result = { ok: false, error: `execution-error: ${err.message}`, snapshot: getSnapshot() };
                }

                try {
                  await fetch(`${baseUrl}/api/main/action-result`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Whale-Main-Token': mainToken,
                      'X-Whale-Generation': String(currentGeneration),
                    },
                    body: JSON.stringify({ clientActionId, result, instanceId, generation: currentGeneration }),
                  });
                } catch {}
              } else if (eventName === 'window-state') {
                let state;
                try {
                  state = JSON.parse(eventData);
                } catch {
                  continue;
                }
                if (state.generation != null && state.generation !== currentGeneration) {
                  continue;
                }
                windowStateKnown = state.generation === currentGeneration && Object.values(DETACHABLE_MODES).includes(state.mode) && typeof state.unconfirmedCleanup === 'boolean';
                if (state.mode) {
                  mode = state.mode;
                }
                unconfirmedCleanup = Boolean(state.unconfirmedCleanup);
                lastCleanupError = state.lastError || null;
                if (mode === DETACHABLE_MODES.DOCKED && !unconfirmedCleanup) {
                  activeToken = null;
                }
                notify();
              } else if (eventName === 'dock') {
                if (!unconfirmedCleanup) {
                  mode = DETACHABLE_MODES.DOCKED;
                  activeToken = null;
                  notify();
                }
              }
            }
          }
        } catch {}
        finally { authorConnected = false; windowStateKnown = false; if(!disposed)notify(); }
      }

      async function requestDetach() {
        const res = await fetch(`${baseUrl}/api/main/detach`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Whale-Main-Token': mainToken,
            'X-Whale-Generation': String(currentGeneration),
          },
          body: JSON.stringify({ instanceId, generation: currentGeneration }),
        });
        const data = await res.json();
        if (data.ok) {
          mode = data.mode || DETACHABLE_MODES.DETACHED;
          activeToken = data.token;
          notify();
        }
        return data;
      }

      async function requestDock() {
        const res = await fetch(`${baseUrl}/api/main/dock`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Whale-Main-Token': mainToken,
            'X-Whale-Generation': String(currentGeneration),
          },
          body: JSON.stringify({ instanceId, generation: currentGeneration }),
        });
        const data = await res.json();
        if (data.ok) {
          mode = DETACHABLE_MODES.DOCKED;
          unconfirmedCleanup = false;
          lastCleanupError = null;
          activeToken = null;
          notify();
        } else {
          if (data.mode) mode = data.mode;
          unconfirmedCleanup = Boolean(data.unconfirmedCleanup);
          lastCleanupError = data.error || null;
          notify();
        }
        return data;
      }

      async function dispose() {
        if (disposed) return { ok: true };
        disposed = true;
        if (typeof window !== 'undefined' && window.removeEventListener) {
          window.removeEventListener('pagehide', handlePageUnload);
          window.removeEventListener('beforeunload', handlePageUnload);
        }
        try { sseAbort?.abort(); } catch {}
        try { unsubSettings?.(); } catch {}
        try { unsubPresets?.(); } catch {}
        try { unsubWallpaper?.(); } catch {}
        try { unsubLibrary?.(); } catch {}
        subscribers.clear();
        let res = { ok: true };
        try {
          const resp = await fetch(
            `${baseUrl}/api/main/disconnect?mainToken=${encodeURIComponent(mainToken)}&instanceId=${encodeURIComponent(instanceId)}&generation=${encodeURIComponent(currentGeneration)}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Whale-Main-Token': mainToken,
                'X-Whale-Generation': String(currentGeneration),
              },
              body: JSON.stringify({ instanceId, generation: currentGeneration }),
            }
          );
          res = await resp.json();
        } catch {}
        mode = DETACHABLE_MODES.DOCKED;
        activeToken = null;
        notify();
        return res;
      }

      async function requestAuthor(route,payload,{signal}={}) {
        const tag=(error,stage,reason,status)=>Object.assign(error,{whaleReadDiagnostic:{stage,reason,status}});
        if(disposed || !authorConnected || !currentGeneration || !['schema','draft','apply'].includes(route))throw tag(new Error('author-disconnected'),'bridge',disposed?'disposed':!authorConnected?'disconnected':'unavailable');
        let snapshotResult;
        try{snapshotResult=await fetch(`${baseUrl}/api/main/snapshot`,{
          method:'POST',headers:{'Content-Type':'application/json','X-Whale-Main-Token':mainToken,'X-Whale-Generation':String(currentGeneration)},
          body:JSON.stringify({snapshot:getSnapshot(),instanceId,generation:currentGeneration}),signal});}
        catch(error){throw tag(error,'snapshot',signal?.aborted?'cancelled':'transport');}
        if(!snapshotResult.ok)throw tag(new Error('author-disconnected'),'snapshot','http',snapshotResult.status);
        if(disposed)throw tag(new Error('author-disconnected'),'bridge','disposed');
        let res;
        try{res=await fetch(`${baseUrl}/api/author-properties/${route}${route==='schema'?`?wallpaperId=${encodeURIComponent(payload.wallpaperId)}`:''}`,{
          method:route==='schema'?'GET':'POST',headers:{'Content-Type':'application/json',
            'X-Whale-Main-Token':mainToken,'X-Whale-Instance-Id':instanceId,'X-Whale-Generation':String(currentGeneration)},
          ...(route!=='schema'?{body:JSON.stringify(payload)}:{}),signal});}
        catch(error){throw tag(error,'schema',signal?.aborted?'cancelled':'transport');}
        let value;try{value=await res.json();}catch(error){throw tag(error,'schema','json',res.status);}
        if(route==='schema'&&value&&typeof value==='object'&&!Array.isArray(value)&&value.ok===false){
          // Closed categories only. Never retain backend text, headers, paths or values.
          const code=value.error;
          const reason=['author_unauthorized','author_rating_denied'].includes(code)?'permission':
            ['author_cleanup_pending','author_context_changed','author_context_invalid'].includes(code)?'context':
            ['author_read_timeout','author_body_timeout'].includes(code)?'timeout':
            ['author_library_unavailable','author_wallpaper_unavailable','author_type_unsupported'].includes(code)?'metadata':
            ['author_read_busy','author_draft_limit'].includes(code)?'limit':'rejected';
          Object.defineProperty(value,'__whaleReadDiagnostic',{value:{stage:'schema',reason,status:res.status},enumerable:false});
        }
        return value;
      }

      async function fetchPreviewBlob(sceneId, { signal } = {}) {
        if (disposed) throw new Error('bridge-disposed');
        if (!baseUrl || !mainToken) throw new Error('bridge-not-connected');
        if (!sceneId) throw new Error('invalid-scene-id');

        const url = `${baseUrl}/api/wallpaper-preview?id=${encodeURIComponent(sceneId)}`;
        const resp = await fetch(url, {
          method: 'GET',
          headers: {
            'X-Whale-Main-Token': mainToken,
            'X-Whale-Instance-Id': instanceId,
            'X-Whale-Generation': String(currentGeneration),
          },
          signal,
        });

        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          throw new Error(`preview-fetch-failed: ${resp.status} ${errText}`);
        }

        return await resp.blob();
      }

      return {
        get instanceId() { return instanceId; },
        get revision() { return revision; },
        get generation() { return currentGeneration; },
        get authorConnected() { return authorConnected && !disposed; },
        connect,
        getSnapshot,
        getMode: () => mode,
        hasUnconfirmedCleanup: () => unconfirmedCleanup,
        getLastError: () => lastCleanupError,
        requestDetach,
        requestDock,
        fetchPreviewBlob,
        requestAuthor,
        dispose,
        subscribe(listener) {
          subscribers.add(listener);
          return () => subscribers.delete(listener);
        },
      };
    }

    function WhaleHeaderAppearanceTrigger({ appearanceBridge }) {
      const h = React.createElement;
      const bridgeState = React.useSyncExternalStore(
        appearanceBridge.subscribe,
        appearanceBridge.getSnapshot,
        appearanceBridge.getSnapshot
      );
      const isOpen = bridgeState.isOpen;
      const isDetached = bridgeState.mode === DETACHABLE_MODES.DETACHED;

      return h('button', {
        type: 'button',
        id: 'whale-appearance-header-btn',
        className: 'dsw-btn dsw-header-action-btn' + (isOpen ? ' active' : ''),
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 10px',
          fontSize: '12px',
          fontWeight: '500',
          borderRadius: '6px',
          border: '1px solid var(--dsw-alias-border-subtle, rgba(140, 165, 210, 0.2))',
          background: isOpen ? 'var(--dsw-alias-brand-primary, #8c72f2)' : 'transparent',
          color: isOpen ? '#ffffff' : 'var(--dsw-alias-text-primary, #e6edf8)',
          cursor: 'pointer',
          lineHeight: '1.2',
          userSelect: 'none',
          transition: 'background 0.15s ease, border-color 0.15s ease',
        },
        title: isDetached ? '外观设置（已在独立窗口打开）' : '切换外观面板',
        onClick: () => {
          appearanceBridge.togglePanel();
        },
      }, [
        h('span', { key: 'badge', style: { fontWeight: '700', fontSize: '11px', opacity: '0.85' } }, 'Whale'),
        h('span', { key: 'label' }, isDetached ? '独立窗口' : '外观'),
      ]);
    }

    function DockedPreviewImage({ sceneId, appearanceBridge, alt, style }) {
      const h = React.createElement;
      const [blobUrl, setBlobUrl] = React.useState(null);
      const [failed, setFailed] = React.useState(false);

      React.useEffect(() => {
        if (!sceneId || !appearanceBridge?.fetchPreviewBlob) {
          setBlobUrl(null);
          setFailed(true);
          return;
        }

        let active = true;
        let createdUrl = null;
        const abortCtrl = new AbortController();

        appearanceBridge.fetchPreviewBlob(sceneId, { signal: abortCtrl.signal })
          .then((blob) => {
            if (!active) return;
            createdUrl = URL.createObjectURL(blob);
            setBlobUrl(createdUrl);
            setFailed(false);
          })
          .catch(() => {
            if (active) {
              setBlobUrl(null);
              setFailed(true);
            }
          });

        return () => {
          active = false;
          try { abortCtrl.abort(); } catch {}
          if (createdUrl) {
            try { URL.revokeObjectURL(createdUrl); } catch {}
          }
        };
      }, [sceneId, appearanceBridge]);

      if (failed || !blobUrl) {
        return h('div', {
          style: {
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            color: 'var(--dsw-alias-text-secondary, #9cb0d1)',
            opacity: 0.6,
          },
        }, '🖼');
      }

      return h('img', {
        src: blobUrl,
        alt: alt || sceneId,
        style,
        onError: () => setFailed(true),
      });
    }

    function WhaleAuthorProperties({appearanceBridge,wallpaperId,allowed,connected,contextKey}) {
      const mount=React.useRef(null),panel=React.useRef(null);
      React.useEffect(()=>{
        if(!mount.current)return;
        panel.current=WM_AUTHOR_PANEL.createAuthorPanel({root:mount.current,request:(...args)=>appearanceBridge.requestAuthor(...args)});
        return()=>{panel.current?.dispose();panel.current=null;};
      },[appearanceBridge]);
      React.useEffect(()=>{panel.current?.update({wallpaperId,allowed,connected,contextKey});},[wallpaperId,allowed,connected,contextKey,appearanceBridge]);
      return React.createElement('div',{ref:mount,'data-author-panel':'docked'});
    }

    function WhaleDockedAppearancePanel({ appearanceBridge, controller }) {
      const h = React.createElement;
      const bridgeState = React.useSyncExternalStore(
        appearanceBridge.subscribe,
        appearanceBridge.getSnapshot,
        appearanceBridge.getSnapshot
      );
      const settings = React.useSyncExternalStore(
        controller.subscribeSettings,
        controller.getSettingsSnapshot,
        controller.getSettingsSnapshot
      );
      const presetsState = React.useSyncExternalStore(
        controller.presets?.subscribe ?? (() => () => {}),
        controller.presets?.getSnapshot ?? (() => ({ version: 1, entries: {} })),
        controller.presets?.getSnapshot ?? (() => ({ version: 1, entries: {} }))
      );

      const [inFlightDetach, setInFlightDetach] = React.useState(false);
      const [actionError, setActionError] = React.useState('');

      if (!bridgeState.isOpen) {
        return null;
      }

      const isDetached = bridgeState.mode === DETACHABLE_MODES.DETACHED;
      const isDetaching = bridgeState.mode === DETACHABLE_MODES.DETACHING;
      const unconfirmedCleanup = bridgeState.unconfirmedCleanup;

      // Age ratings filter handling
      const rawAgeRatings = settings.weAgeRatings;
      const parseAgeRatingsLocal = (val) => {
        if (typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed === '') return [];
          const parts = trimmed.split(',').map(s => s.trim()).filter(Boolean);
          if (parts.length === 0 || !parts.every(p => ['Everyone', 'Questionable', 'Mature'].includes(p))) {
            return ['Everyone'];
          }
          const unique = [...new Set(parts)].sort((a, b) => ['Everyone', 'Questionable', 'Mature'].indexOf(a) - ['Everyone', 'Questionable', 'Mature'].indexOf(b));
          return unique;
        }
        return ['Everyone'];
      };
      const allowedRatings = parseAgeRatingsLocal(rawAgeRatings);

      const handleToggleRating = (rating) => {
        let next;
        if (allowedRatings.includes(rating)) {
          next = allowedRatings.filter(r => r !== rating);
        } else {
          next = [...allowedRatings, rating];
        }
        next.sort((a, b) => ['Everyone', 'Questionable', 'Mature'].indexOf(a) - ['Everyone', 'Questionable', 'Mature'].indexOf(b));
        controller.set('weAgeRatings', next.join(','));
      };

      // Catalog & Wallpaper extraction
      const catalog = bridgeState.snapshot?.catalog || bridgeState.catalog || (controller.wallpaper?.getLibrarySnapshot ? controller.wallpaper.getLibrarySnapshot() : null) || { items: [] };
      const wp = bridgeState.snapshot?.wallpaper || bridgeState.wallpaper || (controller.wallpaper?.getStatus ? controller.wallpaper.getStatus() : null) || {};
      const selectedSceneId = settings.weScene || 'lucy';
      const activeSceneId = isSceneId(wp.activeSceneId) ? wp.activeSceneId : (isSceneId(wp.host && wp.host.activeSceneId) ? wp.host.activeSceneId : null);
      const wpState = wp.state || 'idle';
      const cleanupPending = Boolean(wp.cleanupPending);

      const rawItems = Array.isArray(catalog.items) ? catalog.items.map(i => ({
        ...i,
        contentRating: ['Everyone', 'Questionable', 'Mature'].includes(i.contentRating) ? i.contentRating : (i.id === 'lucy' ? 'Everyone' : 'unknown'),
      })) : [];
      if (catalog.state !== 'failed' && !rawItems.some(item => item.id === 'lucy')) {
        const verified = Array.isArray(wp?.host?.scenes) ? wp.host.scenes.find(scene => scene.id === 'lucy') : null;
        rawItems.unshift({
          id: 'lucy',
          title: 'Lucy',
          type: 'scene',
          contentRating: 'Everyone',
          available: verified ? verified.available !== false : true,
          playbackVerified: true,
          previewRef: { wallpaperId: 'lucy', kind: 'preview' },
        });
      }

      const visibleItems = rawItems.filter(item => allowedRatings.includes(item.contentRating));

      const selectedItem = rawItems.find(i => i.id === selectedSceneId) || {
        id: selectedSceneId,
        title: selectedSceneId,
        type: 'unknown',
        contentRating: selectedSceneId === 'lucy' ? 'Everyone' : 'unknown',
        available: false,
        playbackVerified: false,
        reason: 'unknown_wallpaper',
      };

      const isSelectedHidden = !allowedRatings.includes(selectedItem.contentRating);
      const isBusy = wpState === 'starting' || wpState === 'stopping' || cleanupPending;
      const isCurrentlyPlaying = wpState === 'playing';
      const isMismatch = isCurrentlyPlaying && activeSceneId !== selectedSceneId;
      const isLucy = selectedSceneId === 'lucy';
      const catalogReady = catalog?.state === 'ready' && catalog?.loaded === true;
      const STARTABLE_STATES = ['idle', 'stopped', 'error'];
      const isStartableState = STARTABLE_STATES.includes(wpState) && !cleanupPending && wpState !== 'cleanup-failed' && activeSceneId == null;
      const canStartWp = !isDetached && isStartableState && !isSelectedHidden && catalogReady && (isLucy ? selectedItem.available !== false : (selectedItem.available === true && ['scene', 'video', 'web'].includes(selectedItem.type))) && !isMismatch;
      const canStopWp = !isDetached && (isCurrentlyPlaying || wpState === 'starting' || wpState === 'cleanup-failed');

      // Settings extraction
      const brightnessVal = settings.brightness ?? 70;
      const maskVal = settings.mask ?? 45;
      const blurVal = settings.blur ?? 0;
      const surfaceVal = settings.surface ?? 82;
      const chatBackdropVal = settings.chatBackdrop ?? 0;
      const themeVal = settings.theme ?? 'abyss';
      const paletteVal = settings.palette ?? 'ocean';
      const contrastVal = settings.textContrast ?? 'standard';
      const accentModeVal = settings.accentMode ?? 'theme';
      const accentColorVal = settings.accentColor ?? '#8c72f2';

      // Preset target resolution & gating
      const targetResolution = controller.presets?.resolveTarget ? controller.presets.resolveTarget() : { ok: false, error: 'unavailable' };
      const targetId = targetResolution.ok ? targetResolution.targetId : null;
      const isPlaying = Boolean(targetResolution.ok && targetResolution.isPlaying);
      const presetsEntries = presetsState?.entries || {};
      const hasPreset = Boolean(targetId && presetsEntries[targetId]);
      const canOperate = Boolean(targetResolution.ok && !isDetached);
      const canSave = canOperate;
      const canApply = canOperate && hasPreset;
      const canDelete = canOperate && hasPreset;

      let targetLine = '';
      if (targetResolution.ok) {
        const prefix = isPlaying ? '当前播放' : '所选壁纸';
        const title = targetId === 'lucy' ? 'Lucy' : targetId;
        const status = hasPreset ? '已保存预设' : '未保存预设';
        targetLine = `${prefix}：${title}（${status}）`;
      } else {
        if (targetResolution.error === 'transition') targetLine = '播放状态切换中，预设暂不可用';
        else if (targetResolution.error === 'cleanup-failed') targetLine = '源窗口关闭未确认，请重试清理';
        else if (targetResolution.error === 'mismatch') targetLine = '请先停止当前播放或切换到所选壁纸';
        else if (targetResolution.error === 'scene-unconfirmed') targetLine = '壁纸目录未确认，预设暂不可用';
        else if (targetResolution.error === 'scene-unavailable') targetLine = '壁纸当前不可用，预设暂不可用';
        else if (targetResolution.error === 'unknown-scene') targetLine = '当前播放壁纸未知，预设暂不可用';
        else targetLine = '壁纸预设不可用';
      }

      const cardStyle = {
        background: 'rgba(24, 38, 64, 0.55)',
        border: '1px solid var(--dsw-alias-border-subtle, rgba(140, 165, 210, 0.16))',
        borderRadius: '8px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        opacity: isDetached ? '0.45' : '1',
        pointerEvents: isDetached ? 'none' : 'auto',
      };

      const groupHeaderStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        paddingBottom: '4px',
        borderBottom: '1px solid rgba(140, 165, 210, 0.12)',
      };

      const groupTitleStyle = {
        fontSize: '13px',
        fontWeight: '600',
        color: 'var(--dsw-alias-text-primary, #e6edf8)',
      };

      const groupSubtitleStyle = {
        fontSize: '11px',
        color: 'var(--dsw-alias-text-secondary, #9cb0d1)',
      };

      const rowLabelStyle = {
        fontSize: '12px',
        fontWeight: '500',
        color: 'var(--dsw-alias-text-primary, #e6edf8)',
      };

      const rowValStyle = {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#8c72f2',
      };

      const hintStyle = {
        fontSize: '10.5px',
        color: 'var(--dsw-alias-text-secondary, #9cb0d1)',
        lineHeight: 1.35,
        margin: 0,
      };

      const segmentGroupStyle = {
        display: 'flex',
        gap: '4px',
        background: 'rgba(10, 16, 28, 0.6)',
        border: '1px solid rgba(140, 165, 210, 0.16)',
        borderRadius: '6px',
        padding: '2px',
      };

      const segmentBtn = (active, label, onClick, id) => h('button', {
        id,
        key: id,
        type: 'button',
        disabled: isDetached,
        style: {
          flex: 1,
          padding: '4px 6px',
          fontSize: '11px',
          border: 'none',
          borderRadius: '4px',
          background: active ? '#8c72f2' : 'transparent',
          color: active ? '#fff' : 'var(--dsw-alias-text-secondary, #9cb0d1)',
          cursor: isDetached ? 'not-allowed' : 'pointer',
          fontWeight: active ? '600' : '400',
          transition: 'all 0.15s ease',
        },
        onClick,
      }, label);

      const renderSliderRow = (key, label, val, min, max, unit, sliderId, valId, hint) => h('div', {
        key,
        style: { display: 'flex', flexDirection: 'column', gap: '4px' },
      }, [
        h('div', {
          key: 'header',
          style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        }, [
          h('label', { key: 'lbl', htmlFor: sliderId, style: rowLabelStyle }, label),
          h('span', { key: 'val', id: valId, style: rowValStyle }, `${val}${unit}`),
        ]),
        h('input', {
          key: 'slider',
          id: sliderId,
          type: 'range',
          min,
          max,
          step: 1,
          value: val,
          disabled: isDetached,
          style: { width: '100%', cursor: isDetached ? 'not-allowed' : 'pointer' },
          onChange: (e) => {
            const next = parseInt(e.target.value, 10);
            controller.set(key, next);
          },
        }),
        hint ? h('p', { key: 'hint', style: hintStyle }, hint) : null,
      ]);

      return h('div', {
        id: 'whale-docked-panel',
        role: 'region',
        'aria-label': '鲸系外观设置',
        style: {
          position: 'fixed',
          right: '16px',
          top: '64px',
          width: '360px',
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 80px)',
          zIndex: 1000,
          pointerEvents: 'auto',
          background: 'var(--dsw-specific-menu, rgba(19, 29, 47, 0.96))',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--dsw-alias-border-subtle, rgba(140, 165, 210, 0.2))',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          color: 'var(--dsw-alias-text-primary, #e6edf8)',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        },
      }, [
        // 1. Header
        h('div', {
          key: 'header',
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '8px',
            borderBottom: '1px solid var(--dsw-alias-border-subtle, rgba(140, 165, 210, 0.15))',
            flexShrink: 0,
          },
        }, [
          h('div', { key: 'brand', style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
            h('span', {
              key: 'badge',
              style: {
                background: 'linear-gradient(135deg, #8c72f2, #4a3891)',
                color: '#fff',
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 6px',
                borderRadius: '4px',
              },
            }, 'Whale'),
            h('span', { key: 'title', style: { fontWeight: '600', fontSize: '14px' } }, '外观快捷设置'),
          ]),
          h('button', {
            key: 'close-btn',
            type: 'button',
            id: 'whale-docked-close-x',
            style: {
              background: 'transparent',
              border: 'none',
              color: 'var(--dsw-alias-text-secondary, #9cb0d1)',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '2px 6px',
              borderRadius: '4px',
            },
            onClick: () => appearanceBridge.closePanel(),
            'aria-label': '关闭面板',
          }, '✕'),
        ]),

        // 2. Unconfirmed cleanup alert
        unconfirmedCleanup ? h('div', {
          key: 'cleanup-err',
          id: 'whale-docked-cleanup-error',
          role: 'alert',
          style: {
            padding: '8px 10px',
            borderRadius: '6px',
            background: 'rgba(255, 113, 133, 0.15)',
            border: '1px solid rgba(255, 113, 133, 0.35)',
            color: '#ff7185',
            fontSize: '12px',
            flexShrink: 0,
          },
        }, `窗口关闭待确认: ${bridgeState.lastError || '请重试吸附'}`) : null,

        // 2b. Independent action error alert (R4)
        actionError ? h('div', {
          key: 'action-err',
          id: 'whale-docked-action-error',
          role: 'alert',
          'aria-live': 'assertive',
          style: {
            padding: '8px 10px',
            borderRadius: '6px',
            background: 'rgba(255, 113, 133, 0.15)',
            border: '1px solid rgba(255, 113, 133, 0.35)',
            color: '#ff7185',
            fontSize: '12px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          },
        }, [
          h('span', { key: 'msg' }, actionError),
          h('button', {
            key: 'dismiss',
            type: 'button',
            id: 'whale-docked-action-error-dismiss',
            style: {
              background: 'transparent',
              border: 'none',
              color: '#ff7185',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '2px 4px',
            },
            onClick: () => setActionError(''),
            'aria-label': '清除提示',
          }, '✕'),
        ]) : null,

        // 3. Detached Guidance Banner
        isDetached ? h('div', {
          key: 'detached-banner',
          style: {
            padding: '10px',
            borderRadius: '8px',
            background: 'rgba(140, 114, 242, 0.12)',
            border: '1px solid rgba(140, 114, 242, 0.25)',
            fontSize: '13px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            flexShrink: 0,
          },
        }, [
          h('div', { key: 'text' }, '已在独立 Edge 窗口中打开设置。在吸附回主界面之前，本地界面写入已锁定。'),
          h('button', {
            key: 'dock-btn',
            type: 'button',
            id: 'whale-docked-btn-dock',
            style: {
              background: 'var(--dsw-alias-brand-primary, #8c72f2)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
            },
            onClick: async () => {
              setActionError('');
              const res = await appearanceBridge.requestDock();
              if (!res.ok) {
                setActionError(res.error || '吸附失败');
              } else {
                setActionError('');
              }
            },
          }, '吸附回主界面'),
        ]) : null,

        // 4. Scrollable Content Body
        h('div', {
          key: 'scroll-body',
          style: {
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            paddingRight: '2px',
          },
        }, [
          // Group 0: 壁纸图库与所选壁纸 (Wallpaper Gallery & Selection)
          h('div', { key: 'group-wallpaper', id: 'whale-docked-wallpaper-group', style: cardStyle }, [
            h('div', { key: 'gh', style: groupHeaderStyle }, [
              h('div', { key: 'title-wrap', style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [
                h('span', { key: 'gt', style: groupTitleStyle }, '壁纸图库'),
                h('span', { key: 'count', id: 'whale-docked-catalog-count', style: { fontSize: '10px', color: 'var(--dsw-alias-text-secondary, #9cb0d1)', background: 'rgba(255, 255, 255, 0.05)', padding: '1px 5px', borderRadius: '4px' } }, `${visibleItems.length} 项`),
              ]),
              h('button', {
                key: 'refresh-btn',
                id: 'whale-docked-catalog-refresh',
                type: 'button',
                disabled: isDetached || catalog.loading,
                style: {
                  background: 'transparent',
                  border: '1px solid rgba(140, 165, 210, 0.16)',
                  borderRadius: '4px',
                  color: 'var(--dsw-alias-text-secondary, #9cb0d1)',
                  fontSize: '11px',
                  padding: '2px 6px',
                  cursor: (isDetached || catalog.loading) ? 'not-allowed' : 'pointer',
                },
                onClick: () => {
                  if (typeof controller.wallpaper?.loadLibrary === 'function') {
                    controller.wallpaper.loadLibrary(true);
                  } else if (typeof controller.wallpaper?.readLibrary === 'function') {
                    controller.wallpaper.readLibrary({ refresh: true });
                  }
                },
              }, catalog.loading ? '刷新中...' : '↻ 刷新'),
            ]),

            // Age rating filter checkboxes
            h('div', {
              key: 'age-filters',
              id: 'whale-docked-age-filters',
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11px',
                color: 'var(--dsw-alias-text-secondary, #9cb0d1)',
                padding: '2px 0 4px 0',
              },
            }, [
              h('span', { key: 'lbl' }, '分级：'),
              ...[
                { id: 'Everyone', label: '所有人' },
                { id: 'Questionable', label: '敏感内容' },
                { id: 'Mature', label: '成人内容' },
              ].map(({ id, label }) => {
                const isChecked = allowedRatings.includes(id);
                return h('label', {
                  key: id,
                  style: { display: 'flex', alignItems: 'center', gap: '3px', cursor: isDetached ? 'not-allowed' : 'pointer' },
                }, [
                  h('input', {
                    type: 'checkbox',
                    id: `whale-docked-filter-${id.toLowerCase()}`,
                    checked: isChecked,
                    disabled: isDetached,
                    onChange: () => handleToggleRating(id),
                  }),
                  h('span', null, label),
                ]);
              }),
            ]),

            // Catalog notices
            catalog.loading ? h('div', { key: 'notice-loading', style: hintStyle }, '正在刷新壁纸库...') : null,
            catalog.error ? h('div', { key: 'notice-error', style: { ...hintStyle, color: '#ff7185' } }, `读取失败: ${catalog.error}`) : null,
            catalog.truncated ? h('div', { key: 'notice-truncated', style: { ...hintStyle, color: '#e3a85d' } }, '壁纸较多，已显示前部分条目') : null,
            (catalog.loaded && visibleItems.length === 0) ? h('div', { key: 'notice-empty', style: hintStyle }, allowedRatings.length === 0 ? '未勾选任何年龄分级' : '未发现匹配分级的可用壁纸') : null,

            // Compact Wallpaper Cards List
            h('div', {
              key: 'cards-list',
              id: 'whale-docked-wallpaper-list',
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                maxHeight: '160px',
                overflowY: 'auto',
                paddingRight: '2px',
              },
            }, visibleItems.map(item => {
              const isSelected = item.id === selectedSceneId;
              const isPlayingItem = item.id === activeSceneId && (wpState === 'playing' || wpState === 'starting');
              return h('button', {
                key: item.id,
                type: 'button',
                disabled: isDetached || item.available === false,
                'aria-checked': isSelected,
                'data-scene-id': item.id,
                style: {
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: isSelected ? 'rgba(140, 114, 242, 0.22)' : 'rgba(10, 16, 28, 0.5)',
                  border: isSelected ? '1px solid #8c72f2' : (isPlayingItem ? '1px solid rgba(72, 177, 136, 0.5)' : '1px solid rgba(140, 165, 210, 0.16)'),
                  borderRadius: '6px',
                  padding: '6px 8px',
                  cursor: (isDetached || item.available === false) ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  color: isSelected ? '#ffffff' : 'var(--dsw-alias-text-primary, #e6edf8)',
                },
                onClick: () => {
                  if (!isDetached && item.available !== false) {
                    controller.set('weScene', item.id);
                  }
                },
              }, [
                h('div', {
                  key: 'thumb-title-wrap',
                  style: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 },
                }, [
                  h('div', {
                    key: 'thumb-wrap',
                    style: {
                      width: '36px',
                      height: '24px',
                      borderRadius: '3px',
                      overflow: 'hidden',
                      background: 'rgba(0, 0, 0, 0.3)',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                  }, [
                    h(DockedPreviewImage, {
                      key: 'thumb-img',
                      sceneId: item.previewRef ? item.id : null,
                      appearanceBridge,
                      alt: item.title || item.id,
                      style: {
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      },
                    }),
                  ]),
                  h('span', {
                    key: 'title',
                    title: item.title || item.id,
                    style: {
                      fontSize: '12px',
                      fontWeight: isSelected ? '600' : '400',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '140px',
                    },
                  }, item.title || item.id),
                ]),
                h('div', {
                  key: 'tags',
                  style: { display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 },
                }, [
                  h('span', { key: 'type', style: { fontSize: '10px', color: 'var(--dsw-alias-text-secondary, #9cb0d1)', background: 'rgba(255, 255, 255, 0.05)', padding: '1px 4px', borderRadius: '3px' } }, item.type || 'scene'),
                  isPlayingItem ? h('span', { key: 'playing', style: { fontSize: '10px', color: '#48b188', background: 'rgba(72, 177, 136, 0.2)', padding: '1px 4px', borderRadius: '3px', fontWeight: '500' } }, '正在播放') : null,
                  isSelected ? h('span', { key: 'selected', style: { fontSize: '10px', color: '#8c72f2', background: 'rgba(140, 114, 242, 0.25)', padding: '1px 4px', borderRadius: '3px', fontWeight: '500' } }, '本次选择') : null,
                ]),
              ]);
            })),

            // Details and Playback controls
            h('div', {
              key: 'details-wrap',
              id: 'whale-docked-details-wrap',
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'rgba(10, 16, 28, 0.4)',
                border: '1px solid rgba(140, 165, 210, 0.14)',
                borderRadius: '6px',
                padding: '8px',
              },
            }, [
              h('div', {
                key: 'details-preview-wrap',
                id: 'whale-docked-details-preview-wrap',
                style: {
                  width: '100%',
                  height: '70px',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  background: 'rgba(0, 0, 0, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              }, [
                isSelectedHidden ? h('div', {
                  key: 'hidden-notice',
                  id: 'whale-docked-details-hidden-notice',
                  style: {
                    fontSize: '11px',
                    color: '#e3a85d',
                    textAlign: 'center',
                    padding: '8px',
                  },
                }, '已被年龄分级筛选隐藏') : h(DockedPreviewImage, {
                  key: `details-img-${selectedItem.id}`,
                  id: 'whale-docked-details-img',
                  sceneId: selectedItem.previewRef ? selectedItem.id : null,
                  appearanceBridge,
                  alt: selectedItem.title || selectedItem.id,
                  style: {
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  },
                }),
              ]),
              h('div', { key: 'details-header', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
                h('span', { key: 'lbl', id: 'whale-docked-selected-title', style: { fontSize: '12px', fontWeight: '600', color: 'var(--dsw-alias-text-primary, #e6edf8)' } }, isSelectedHidden ? `所选壁纸：${selectedItem.title || selectedItem.id}（已被筛选隐藏）` : `所选壁纸：${selectedItem.title || selectedItem.id}`),
                h('span', { key: 'status-tag', style: { fontSize: '10px', color: selectedItem.playbackVerified ? '#48b188' : '#e3a85d' } }, selectedItem.playbackVerified ? '已验证' : (selectedItem.available ? '实验性' : '不可用')),
              ]),
              h('div', { key: 'status-text', id: 'whale-docked-playback-status', style: { fontSize: '11px', color: 'var(--dsw-alias-text-secondary, #9cb0d1)' } },
                wpState === 'playing' ? `正在播放：${activeSceneId === 'lucy' ? 'Lucy' : (activeSceneId || '未知壁纸')}` :
                (wpState === 'starting' ? '壁纸启动中...' :
                (wpState === 'stopping' || cleanupPending ? '壁纸停止/清理中...' :
                (wpState === 'cleanup-failed' ? '源窗口清理未确认，请重试停止' : '未开始播放')))
              ),
              isMismatch ? h('div', {
                key: 'mismatch-alert',
                id: 'whale-docked-mismatch-banner',
                style: {
                  fontSize: '11px',
                  color: '#e3a85d',
                  background: 'rgba(227, 168, 93, 0.12)',
                  border: '1px solid rgba(227, 168, 93, 0.3)',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  lineHeight: '1.35',
                },
              }, activeSceneId ? `当前正在播放「${activeSceneId === 'lucy' ? 'Lucy' : activeSceneId}」。请先停止当前播放，再开始所选项。` : `当前活动壁纸身份未确认，请先停止播放。`) : null,
              h(WhaleAuthorProperties,{key:'author-properties',appearanceBridge,wallpaperId:selectedSceneId,connected:appearanceBridge.getClient?.()?.authorConnected===true,
                allowed:!isDetached&&!isSelectedHidden&&selectedItem.available===true&&['scene','web'].includes(selectedItem.type),
                contextKey:JSON.stringify([settings.weAgeRatings,bridgeState.generation,wpState,activeSceneId,cleanupPending,catalog.scannedAt])}),
              h('div', { key: 'playback-options', className: 'wm-playback-options', style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
                h('label', { key: 'mode-label', htmlFor: 'whale-docked-we-mode', style: { fontSize: '11px', color: 'var(--dsw-alias-text-secondary, #9cb0d1)' } }, '播放模式'),
                h('select', {
                  key: 'we-mode',
                  id: 'whale-docked-we-mode',
                  'data-wm-setting': 'weMode',
                  disabled: isDetached || !isStartableState,
                  value: settings.weMode === 'daily' ? 'daily' : 'preview',
                  onChange: (event) => {
                    const el = event && event.currentTarget;
                    if (isDetached || !isStartableState) return;
                    if (!el || el.disabled) return;
                    const next = el.value;
                    if (next !== 'daily' && next !== 'preview') return;
                    controller.set('weMode', next);
                  },
                }, [
                  h('option', { key: 'daily', value: 'daily' }, '日常（持续播放）'),
                  h('option', { key: 'preview', value: 'preview' }, '预览（限时）'),
                ]),
                h('label', { key: 'autostart-label', htmlFor: 'whale-docked-we-autostart', style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--dsw-alias-text-secondary, #9cb0d1)' } }, [
                  h('input', {
                    key: 'we-autostart',
                    id: 'whale-docked-we-autostart',
                    type: 'checkbox',
                    'data-wm-setting': 'weAutoStart',
                    disabled: isDetached || !isStartableState,
                    checked: settings.weAutoStart === true,
                    onChange: (event) => {
                      const el = event && event.currentTarget;
                      if (isDetached || !isStartableState) return;
                      if (!el || el.disabled) return;
                      if (el.checked !== true && el.checked !== false) return;
                      controller.set('weAutoStart', el.checked === true);
                    },
                  }),
                  '随 DSH 启动自动播放',
                ]),
                h('div', { key: 'lucy-hint', style: { fontSize: '10px', lineHeight: '1.35', color: 'var(--dsw-alias-text-secondary, #9cb0d1)' } }, '仅 Lucy 具备自动播放资格。修改播放模式或自动播放不会开始当前播放。'),
              ]),
              h('div', { key: 'actions-row', style: { display: 'flex', gap: '6px', marginTop: '2px' } }, [
                h('button', {
                  key: 'start-btn',
                  id: 'whale-docked-btn-start',
                  type: 'button',
                  disabled: !canStartWp,
                  style: {
                    flex: 1,
                    padding: '5px 8px',
                    fontSize: '11px',
                    fontWeight: '500',
                    background: canStartWp ? '#8c72f2' : 'rgba(255, 255, 255, 0.08)',
                    color: canStartWp ? '#ffffff' : 'rgba(255, 255, 255, 0.3)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: canStartWp ? 'pointer' : 'not-allowed',
                  },
                  onClick: async () => {
                    setActionError('');
                    try {
                      const mode = settings.weMode || 'daily';
                      const res = await controller.wallpaper.start(selectedSceneId, mode);
                      if (res && (res.ok === false || res.state === 'error' || res.state === 'cleanup-failed')) {
                        setActionError(res.error || '启动壁纸失败');
                      }
                    } catch (err) {
                      setActionError(err.message || '启动异常');
                    }
                  },
                }, '开始播放'),
                h('button', {
                  key: 'stop-btn',
                  id: 'whale-docked-btn-stop',
                  type: 'button',
                  disabled: !canStopWp,
                  style: {
                    flex: 1,
                    padding: '5px 8px',
                    fontSize: '11px',
                    fontWeight: '500',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: canStopWp ? 'var(--dsw-alias-text-primary, #e6edf8)' : 'rgba(255, 255, 255, 0.3)',
                    border: '1px solid rgba(140, 165, 210, 0.2)',
                    borderRadius: '4px',
                    cursor: canStopWp ? 'pointer' : 'not-allowed',
                  },
                  onClick: async () => {
                    setActionError('');
                    try {
                      const res = await controller.wallpaper.stop('user');
                      if (res && (res.ok === false || res.state === 'cleanup-failed' || res.state === 'error')) {
                        setActionError(res.error || '停止壁纸失败');
                      }
                    } catch (err) {
                      setActionError(err.message || '停止异常');
                    }
                  },
                }, '停止播放'),
              ]),
            ]),
          ]),

          // Group 1: 画面调节 (Visual)
          h('div', { key: 'group-visual', style: cardStyle }, [
            h('div', { key: 'gh', style: groupHeaderStyle }, [
              h('span', { key: 'gt', style: groupTitleStyle }, '壁纸画面效果'),
              h('span', { key: 'gs', style: groupSubtitleStyle }, 'DSH 背景渲染'),
            ]),
            h('div', {
              key: 'visual-notice',
              id: 'whale-docked-visual-notice',
              style: {
                ...hintStyle,
                background: 'rgba(255, 255, 255, 0.04)',
                padding: '4px 6px',
                borderRadius: '4px',
                border: '1px solid rgba(140, 165, 210, 0.12)',
              },
            }, isCurrentlyPlaying ? `调节对当前播放的壁纸「${activeSceneId === 'lucy' ? 'Lucy' : (activeSceneId || '当前壁纸')}」生效` : '当前未播放壁纸；四项调节属于 DSH 背景渲染全局效果'),
            renderSliderRow('brightness', '背景亮度', brightnessVal, 20, 120, '%', 'whale-docked-brightness-slider', 'whale-docked-brightness-val', '100%保留原亮度，可继续提亮；最终效果还受遮罩和界面底色影响'),
            renderSliderRow('mask', '遮罩', maskVal, 0, 90, '%', 'whale-docked-mask-slider', 'whale-docked-mask-val', '叠加主题底色；数值越大覆盖越强，0%关闭'),
            renderSliderRow('blur', '模糊', blurVal, 0, 24, 'px', 'whale-docked-blur-slider', 'whale-docked-blur-val', '柔化壁纸细节，视频较大时会增加显卡负担'),
            renderSliderRow('surface', '界面不透明度', surfaceVal, 40, 100, '%', 'whale-docked-surface-slider', 'whale-docked-surface-val', '侧栏与卡片；菜单和输入卡片保持不透明'),
          ]),

          // Group 2: 界面定制 (Interface)
          h('div', { key: 'group-interface', style: cardStyle }, [
            h('div', { key: 'gh', style: groupHeaderStyle }, [
              h('span', { key: 'gt', style: groupTitleStyle }, '界面定制'),
              h('span', { key: 'gs', style: groupSubtitleStyle }, '主题与配色'),
            ]),
            // Theme
            h('div', { key: 'theme-row', style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
              h('span', { key: 'lbl', style: rowLabelStyle }, '主题'),
              h('div', { key: 'seg', id: 'whale-docked-theme-segment', style: segmentGroupStyle }, [
                segmentBtn(themeVal === 'mist', 'Mist (浅色)', () => controller.set('theme', 'mist'), 'whale-docked-theme-mist'),
                segmentBtn(themeVal === 'abyss', 'Abyss (深色)', () => controller.set('theme', 'abyss'), 'whale-docked-theme-abyss'),
              ]),
            ]),
            // Palette
            h('div', { key: 'palette-row', style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
              h('div', { key: 'hdr', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
                h('span', { key: 'lbl', style: rowLabelStyle }, '深色配色'),
                h('span', { key: 'tag', style: { fontSize: '10px', color: 'var(--dsw-alias-text-secondary, #9cb0d1)' } }, '仅深色生效'),
              ]),
              h('div', { key: 'seg', id: 'whale-docked-palette-segment', style: segmentGroupStyle }, [
                segmentBtn(paletteVal === 'ocean', 'Ocean', () => controller.set('palette', 'ocean'), 'whale-docked-palette-ocean'),
                segmentBtn(paletteVal === 'graphite', 'Graphite', () => controller.set('palette', 'graphite'), 'whale-docked-palette-graphite'),
                segmentBtn(paletteVal === 'violet', 'Violet', () => controller.set('palette', 'violet'), 'whale-docked-palette-violet'),
                segmentBtn(paletteVal === 'jade', 'Jade', () => controller.set('palette', 'jade'), 'whale-docked-palette-jade'),
              ]),
            ]),
            // Text Contrast
            h('div', { key: 'contrast-row', style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
              h('span', { key: 'lbl', style: rowLabelStyle }, '文字可读性'),
              h('div', { key: 'seg', id: 'whale-docked-contrast-segment', style: segmentGroupStyle }, [
                segmentBtn(contrastVal === 'standard', '标准', () => controller.set('textContrast', 'standard'), 'whale-docked-contrast-standard'),
                segmentBtn(contrastVal === 'enhanced', '增强', () => controller.set('textContrast', 'enhanced'), 'whale-docked-contrast-enhanced'),
              ]),
            ]),
            // Chat Backdrop
            renderSliderRow('chatBackdrop', '聊天区底色', chatBackdropVal, 0, 100, '%', 'whale-docked-chatbackdrop-slider', 'whale-docked-chatbackdrop-val', '0%保留壁纸透光，100%完全不透明'),
            // Accent Mode & Color
            h('div', { key: 'accent-row', style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
              h('span', { key: 'lbl', style: rowLabelStyle }, '强调色'),
              h('div', { key: 'seg', id: 'whale-docked-accent-segment', style: segmentGroupStyle }, [
                segmentBtn(accentModeVal === 'theme', '跟随主题', () => controller.set('accentMode', 'theme'), 'whale-docked-accent-theme'),
                segmentBtn(accentModeVal === 'custom', '自定义', () => controller.set('accentMode', 'custom'), 'whale-docked-accent-custom'),
              ]),
              accentModeVal === 'custom' ? h('div', {
                key: 'picker-wrap',
                style: {
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(10, 16, 28, 0.4)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  marginTop: '4px',
                },
              }, [
                h('span', { key: 'lbl', style: { fontSize: '11px', color: 'var(--dsw-alias-text-secondary, #9cb0d1)' } }, '自定义色值'),
                h('div', { key: 'row', style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
                  h('input', {
                    key: 'color-input',
                    id: 'whale-docked-accent-color-picker',
                    type: 'color',
                    value: accentColorVal,
                    disabled: isDetached,
                    style: { width: '24px', height: '22px', border: 'none', background: 'transparent', cursor: 'pointer' },
                    onChange: (e) => controller.set('accentColor', e.target.value),
                  }),
                  h('span', { key: 'hex', id: 'whale-docked-accent-hex', style: rowValStyle }, accentColorVal.toLowerCase()),
                ]),
              ]) : null,
            ]),
          ]),

          // Group 3: 壁纸外观预设 (Presets)
          h('div', { key: 'group-presets', style: cardStyle }, [
            h('div', { key: 'gh', style: groupHeaderStyle }, [
              h('span', { key: 'gt', style: groupTitleStyle }, '壁纸外观预设'),
              h('span', { key: 'gs', style: groupSubtitleStyle }, '仅限四项画面参数'),
            ]),
            h('div', {
              key: 'target-line',
              style: { fontSize: '12px', fontWeight: '500', color: 'var(--dsw-alias-text-primary, #e6edf8)' },
            }, targetLine),
            h('p', { key: 'preset-hint', style: hintStyle }, '每张壁纸保存一份亮度、遮罩、模糊与不透明度；手动应用到当前外观，全局恢复默认不删除预设'),
            h('div', { key: 'actions', style: { display: 'flex', gap: '6px', marginTop: '4px' } }, [
              h('button', {
                key: 'save',
                id: 'whale-docked-preset-save',
                type: 'button',
                disabled: !canSave,
                style: {
                  flex: 1,
                  padding: '5px 8px',
                  fontSize: '11px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: canSave ? '#fff' : 'rgba(255, 255, 255, 0.3)',
                  border: '1px solid rgba(140, 165, 210, 0.2)',
                  borderRadius: '4px',
                  cursor: canSave ? 'pointer' : 'not-allowed',
                },
                onClick: () => {
                  setActionError('');
                  const res = controller.presets.save();
                  if (!res.ok) {
                    setActionError(res.error || '保存预设失败');
                  } else {
                    setActionError('');
                  }
                },
              }, '保存当前外观'),
              h('button', {
                key: 'apply',
                id: 'whale-docked-preset-apply',
                type: 'button',
                disabled: !canApply,
                style: {
                  flex: 1,
                  padding: '5px 8px',
                  fontSize: '11px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: canApply ? '#fff' : 'rgba(255, 255, 255, 0.3)',
                  border: '1px solid rgba(140, 165, 210, 0.2)',
                  borderRadius: '4px',
                  cursor: canApply ? 'pointer' : 'not-allowed',
                },
                onClick: () => {
                  setActionError('');
                  const res = controller.presets.apply();
                  if (!res.ok) {
                    setActionError(res.error || '应用预设失败');
                  } else {
                    setActionError('');
                  }
                },
              }, '应用已保存外观'),
              h('button', {
                key: 'delete',
                id: 'whale-docked-preset-delete',
                type: 'button',
                disabled: !canDelete,
                style: {
                  flex: 1,
                  padding: '5px 8px',
                  fontSize: '11px',
                  background: 'rgba(255, 113, 133, 0.1)',
                  color: canDelete ? '#ff7185' : 'rgba(255, 113, 133, 0.3)',
                  border: '1px solid rgba(255, 113, 133, 0.25)',
                  borderRadius: '4px',
                  cursor: canDelete ? 'pointer' : 'not-allowed',
                },
                onClick: () => {
                  setActionError('');
                  const res = controller.presets.remove();
                  if (!res.ok) {
                    setActionError(res.error || '删除预设失败');
                  } else {
                    setActionError('');
                  }
                },
              }, '删除预设'),
            ]),
          ]),
        ]),

        // 5. Footer actions
        h('div', {
          key: 'footer',
          style: {
            display: 'flex',
            gap: '8px',
            paddingTop: '8px',
            borderTop: '1px solid var(--dsw-alias-border-subtle, rgba(140, 165, 210, 0.15))',
            flexShrink: 0,
          },
        }, [
          !isDetached ? h('button', {
            key: 'detach-btn',
            type: 'button',
            id: 'whale-docked-btn-detach',
            disabled: inFlightDetach || isDetaching || unconfirmedCleanup,
            style: {
              flex: 1,
              padding: '8px 12px',
              borderRadius: '6px',
              border: 'none',
              background: 'var(--dsw-alias-brand-primary, #8c72f2)',
              color: '#fff',
              fontSize: '12px',
              fontWeight: '500',
              cursor: (inFlightDetach || isDetaching || unconfirmedCleanup) ? 'not-allowed' : 'pointer',
              opacity: (inFlightDetach || isDetaching || unconfirmedCleanup) ? '0.5' : '1',
            },
            onClick: async () => {
              setInFlightDetach(true);
              setActionError('');
              try {
                const res = await appearanceBridge.requestDetach();
                if (!res.ok) {
                  setActionError(res.error || '弹出失败');
                } else {
                  setActionError('');
                }
              } catch (err) {
                setActionError(err.message || '弹出异常');
              } finally {
                setInFlightDetach(false);
              }
            },
          }, isDetaching ? '弹出中...' : '弹出独立窗口') : null,

          h('button', {
            key: 'close-btn-bottom',
            type: 'button',
            id: 'whale-docked-btn-close',
            style: {
              flex: 1,
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--dsw-alias-border-subtle, rgba(140, 165, 210, 0.2))',
              background: 'rgba(255, 255, 255, 0.06)',
              color: 'var(--dsw-alias-text-secondary, #9cb0d1)',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
            },
            onClick: () => appearanceBridge.closePanel(),
          }, '关闭'),
        ]),
      ]);
    }

    /* WM_NATIVE_SIDEBAR_BEGIN */
    const WM_NATIVE_SIDEBAR = (() => {
// These rules belong to Whale's own view; a host class name alone provides no styling.
const NATIVE_APPEARANCE_CONTROLS_CSS = `
[data-whale-native-sidebar] {
  display: flex; flex: 1 1 auto; flex-direction: column; height: 100%; min-height: 0;
  min-width: 0; overflow: hidden; box-sizing: border-box; line-height: 1.5;
  background: var(--dsw-specific-sidebar-fill, var(--dsw-alias-bg-layer-1));
}
[data-whale-native-sidebar] [data-whale-settings-navigation] {
  display: flex; flex: none; gap: 8px; padding: 12px 16px 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
}
[data-whale-native-sidebar] [data-whale-settings-section] { flex: 1; min-width: 0; }
[data-whale-native-sidebar] [data-whale-settings-section][aria-selected="true"] {
  color: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary);
  background: var(--dsw-alias-button-info-fill);
}
[data-whale-native-sidebar] [data-whale-playback-header] {
  flex: none; min-width: 0; padding: 8px 16px; border-bottom: 1px solid var(--dsw-alias-border-l2); background: transparent;
}
[data-whale-native-sidebar] [data-whale-playback-header] > p { margin: 8px 0; }
[data-whale-native-sidebar] [data-whale-current-object] {
  display: flex; align-items: center; gap: 8px; min-width: 0;
}
[data-whale-native-sidebar] [data-whale-object-preview] { width: 48px; flex: none; overflow: hidden; border-radius: 4px; }
[data-whale-native-sidebar] [data-whale-current-object] [data-whale-object-title] { flex: 1; min-width: 0; margin-bottom: 0; }
[data-whale-native-sidebar] [data-whale-object-title] {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; margin-bottom: 8px;
}
[data-whale-native-sidebar] [data-whale-page-panel] {
  flex: 1 1 auto; min-height: 0; min-width: 0; overflow: auto; overscroll-behavior: contain;
  padding: 16px; box-sizing: border-box;
}
[data-whale-native-sidebar] [data-whale-page-panel][hidden] { display: none; }
[data-whale-native-sidebar] :where(button, input, select, textarea) {
  box-sizing: border-box; font: inherit;
}
[data-whale-native-sidebar] button {
  color: inherit; cursor: pointer; line-height: 1.4;
}
[data-whale-native-sidebar] button:not([data-whale-gallery-item]) {
  min-height: 32px; padding: 5px 10px; border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-button-elevated-fill);
}
[data-whale-native-sidebar] button:not([data-whale-gallery-item]):enabled:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
[data-whale-native-sidebar] button:not([data-whale-gallery-item]):enabled:active {
  background: var(--dsw-alias-interactive-bg-active);
}
[data-whale-native-sidebar] button[data-whale-playback-action] {
  display: inline-grid; place-items: center; width: 32px; min-width: 32px; padding: 5px;
  background: var(--dsw-alias-button-elevated-fill); color: var(--dsw-alias-label-primary);
}
[data-whale-native-sidebar] button[data-whale-playback-recovery="true"] { width: auto; }
[data-whale-native-sidebar] button[data-whale-playback-action="start"] { color: var(--dsw-alias-brand-primary); }
[data-whale-native-sidebar] [data-whale-play-icon] { width: 14px; height: 14px; fill: currentColor; }
[data-whale-native-sidebar] [data-whale-object-status]::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-inline-end: 5px; background: currentColor; }
[data-whale-native-sidebar] [data-whale-object-status][data-playing="true"]::before { background: var(--dsw-alias-brand-primary); }
[data-whale-native-sidebar][data-whale-settings-page="interface"] [data-whale-object-preview] { width: 32px; }
[data-whale-native-sidebar][data-whale-settings-page="interface"] [data-whale-playback-header] { padding-block: 5px; }
[data-whale-native-sidebar] [data-whale-object-row] { display: flex; align-items: center; gap: 6px; min-width: 0; }
[data-whale-native-sidebar] [data-whale-object-row] > [data-whale-current-object] { flex: 1; }
@container (max-width: 359px) { [data-whale-native-sidebar] [data-whale-object-row] > [data-whale-current-object] [data-whale-object-preview] { display: none; } }

[data-whale-native-sidebar] [data-whale-change-wallpaper] { margin-inline-end: 6px; }
[data-whale-native-sidebar] :where(input[type="search"], input[type="text"], input[type="number"], select, textarea) {
  min-height: 32px; padding: 5px 8px; border-radius: 6px;
  color: var(--dsw-alias-label-primary); background: var(--dsw-alias-button-elevated-fill);
  border: 1px solid var(--dsw-alias-border-l2);
}
[data-whale-native-sidebar] input::placeholder { color: var(--dsw-alias-label-secondary); opacity: 1; }
[data-whale-native-sidebar] select { color-scheme: inherit; cursor: pointer; }
[data-whale-native-sidebar] input[type="checkbox"] {
  width: 16px; height: 16px; margin: 0; flex-shrink: 0; vertical-align: middle;
  accent-color: var(--dsw-alias-brand-primary); cursor: pointer;
}
[data-whale-native-sidebar] label:has(input[type="checkbox"]) { min-height: 32px; }
[data-whale-native-sidebar] input[type="range"] { min-height: 24px; cursor: pointer; }
[data-whale-native-sidebar] summary { min-height: 32px; padding-block: 5px; box-sizing: border-box; display: flex; align-items: center; gap: 8px; list-style: none; cursor: pointer; }
[data-whale-native-sidebar] summary::marker { content: ''; }
[data-whale-native-sidebar] summary::-webkit-details-marker { display: none; }
[data-whale-native-sidebar] summary::before, [data-whale-native-sidebar] [data-whale-chevron] { content: ''; display: inline-block; width: .45em; height: .45em; flex: none; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); }
[data-whale-native-sidebar] details[open] > summary::before, [data-whale-native-sidebar] [data-whale-chevron="down"] { transform: rotate(45deg); }
[data-whale-native-sidebar] [data-whale-chevron="left"] { transform: rotate(135deg); }
[data-whale-native-sidebar] [data-whale-choice][aria-expanded="true"] [data-whale-choice-chevron] { transform: rotate(225deg); }
[data-whale-native-sidebar] :where(button, input, select, textarea):disabled {
  opacity: .45; cursor: not-allowed;
}
[data-whale-native-sidebar] [aria-busy="true"] { cursor: progress; }
[data-whale-native-sidebar] :where(button, input, select, textarea, summary):focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset: 2px;
}
[data-whale-native-sidebar] [role="alert"] { color: var(--dsw-alias-label-error); }
[data-whale-native-sidebar] [data-whale-author-feedback] {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; min-width: 18px; flex: 0 0 18px; align-self: center;
  color: var(--dsw-alias-label-secondary);
}
[data-whale-native-sidebar] [data-whale-author-feedback][data-state="error"] { color: var(--dsw-alias-label-error); }
[data-whale-native-sidebar] [data-whale-author-feedback-text] {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0;
}
[data-whale-native-sidebar] [data-whale-author-heading] { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; width: 100%; margin: 0 0 8px; }
[data-whale-native-sidebar] [data-whale-author-heading] [data-whale-author-read] { margin-inline-start: auto; min-width: 32px; }
[data-whale-native-sidebar] [data-whale-author-name] { display: inline-flex; align-items: center; gap: 4px; min-width: 0; max-width: 100%; }
[data-whale-native-sidebar] [data-whale-author-name] > label { min-width: 0; cursor: pointer; }
[data-whale-native-sidebar] [data-whale-author-bool-row] [data-whale-author-name] > label { display: flex; align-items: center; flex: 1; min-height: 32px; }
[data-whale-native-sidebar] [data-whale-author-name] [data-whale-action-menu] { flex: none; }
[data-whale-native-sidebar] [data-whale-action-menu] button[aria-haspopup="dialog"] { display: inline-grid; place-items: center; padding: 4px; min-width: 24px; min-height: 28px; }
[data-whale-native-sidebar] [data-whale-info-icon] { width: 14px; height: 14px; }
[data-whale-native-sidebar] [data-whale-help-content] { overflow-wrap: anywhere; }
[data-whale-native-sidebar] [data-whale-help-content] p { margin: 6px 4px 10px; font-size: .875em; font-weight: 400; }

[data-whale-native-sidebar] { container-type: inline-size; }
[data-whale-native-sidebar] [data-whale-settings-navigation] { gap: 20px; padding-block: 8px; }
[data-whale-native-sidebar] button[data-whale-settings-section] { flex: 0 0 auto; border: 0; border-radius: 0; background: transparent; padding-inline: 0; border-bottom: 2px solid transparent; }
[data-whale-native-sidebar] button[data-whale-settings-section][aria-selected="true"] { background: transparent; border-bottom-color: var(--dsw-alias-brand-primary); }
[data-whale-native-sidebar] [data-whale-object-summary] { min-width: 0; flex: 1; }
[data-whale-native-sidebar] [data-whale-object-title] { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; }
[data-whale-native-sidebar] [data-whale-object-status] { color: var(--dsw-alias-label-primary); font-size: .8125em; }
[data-whale-native-sidebar] [data-whale-preview-placeholder] { display: block; aspect-ratio: 16/9; background: var(--dsw-alias-button-elevated-fill); }
[data-whale-native-sidebar] [data-whale-header-actions] { display: flex; align-items: center; flex: none; gap: 4px; }

[data-whale-native-sidebar] button[data-whale-quiet] { border-color: transparent; background: transparent; color: var(--dsw-alias-label-secondary); }
[data-whale-native-sidebar] [data-whale-control-group] { border: 0; padding: 0; margin: 0 0 24px; min-width: 0; display: grid; gap: 12px; }
[data-whale-native-sidebar] [data-whale-control-group] > legend { padding: 0; margin-bottom: 12px; font-weight: 600; }
[data-whale-native-sidebar] [data-whale-fold], [data-whale-native-sidebar] [data-whale-playback-options], [data-whale-native-sidebar] [data-whale-presets] { margin: 0 0 12px; min-width: 0; }
[data-whale-native-sidebar] [data-whale-fold-body] { display: grid; gap: 12px; padding: 10px 0; }
[data-whale-native-sidebar] [data-whale-group-error] { color: var(--dsw-alias-label-error); }
[data-whale-native-sidebar] [data-whale-action-menu] { display: inline-flex; align-items: center; flex: none; }
[data-whale-native-sidebar] [data-whale-action-menu-popup] {
  box-sizing: border-box; padding: 4px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px;
  color: var(--dsw-alias-label-primary); background: var(--dsw-specific-menu, var(--dsw-alias-bg-base));
  font: inherit; line-height: 1.5; overflow: auto; overscroll-behavior: contain; box-shadow: 0 3px 12px rgb(0 0 0 / .14);
}
[data-whale-native-sidebar] [data-whale-action-menu-popup]::backdrop { background: transparent; pointer-events: none; }
[data-whale-native-sidebar] [data-whale-action-menu-popup] button { display: block; width: 100%; min-height: 32px; text-align: left; border: 0; background: transparent; }
[data-whale-native-sidebar] [data-whale-action-menu-popup] [data-danger="true"] { color: var(--dsw-alias-label-error); }
[data-whale-native-sidebar] [data-whale-presets] { display: grid; gap: 6px; padding-block: 12px; border-top: 1px solid var(--dsw-alias-border-l2); }
[data-whale-native-sidebar] [data-whale-preset-row] { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; min-width: 0; }
[data-whale-native-sidebar] [data-whale-preset-label] { font-weight: 500; }
[data-whale-native-sidebar] [data-whale-preset-state], [data-whale-native-sidebar] [data-whale-preset-scope] { color: var(--dsw-alias-label-secondary); font-size: .8125em; }
[data-whale-native-sidebar] [data-whale-preset-feedback] { flex: 1 1 18px; min-width: 18px; text-align: end; color: var(--dsw-alias-brand-primary); }
[data-whale-native-sidebar] [data-whale-preset-confirm] { display: grid; gap: 8px; min-width: 0; padding-top: 6px; }
[data-whale-native-sidebar] [data-whale-preset-confirm] p { margin: 0; overflow-wrap: anywhere; }
[data-whale-native-sidebar] [data-whale-preset-values] { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 4px 12px; margin: 0; }
[data-whale-native-sidebar] [data-whale-preset-values] dd { margin: 0; font-variant-numeric: tabular-nums; }
[data-whale-native-sidebar] [data-whale-preset-confirm-actions] { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
[data-whale-native-sidebar] [data-whale-local-actions] { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
[data-whale-native-sidebar] [data-whale-playback-header] > :where(p,div[data-whale-selected-target]) { font-size: .875em; margin: 6px 0 0; }

[data-whale-native-sidebar] [data-whale-choice-segments] { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 4px; min-width: 0; }
[data-whale-native-sidebar] [data-whale-choice-segments="swatches"] { grid-template-columns: repeat(4,minmax(0,1fr)); gap: 6px; }
[data-whale-native-sidebar] [data-whale-choice-segment] { position: relative; min-width: 0; cursor: pointer; }
[data-whale-native-sidebar] [data-whale-choice-segment] input { position: absolute; z-index: 1; inset: 0; width: 100%; height: 100%; opacity: 0; margin: 0; cursor: inherit; }
[data-whale-native-sidebar] [data-whale-segment-face] { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; padding: 5px 8px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; box-sizing: border-box; color: var(--dsw-alias-label-secondary); background: transparent; }
[data-whale-native-sidebar] [data-whale-segment-text] { min-width: 0; overflow-wrap: anywhere; }
[data-whale-native-sidebar] [data-whale-segment-check] { flex: none; width: 1em; font-size: .8125em; text-align: center; }
[data-whale-native-sidebar] [data-whale-choice-segment] input:checked + [data-whale-segment-face] { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-interactive-bg-hover); font-weight: 600; }
[data-whale-native-sidebar] [data-whale-choice-segment] input:focus-visible + [data-whale-segment-face] { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
[data-whale-native-sidebar] [data-whale-choice-segment]:has(input:disabled) { cursor: default; }
[data-whale-native-sidebar] [data-whale-choice-segment] input:active:enabled + [data-whale-segment-face] { transform: scale(.97); }
[data-whale-native-sidebar] [data-whale-choice-segments="swatches"] [data-whale-segment-face] { flex-wrap: wrap; gap: 4px; font-size: .8125em; padding: 8px 4px; }
[data-whale-native-sidebar] [data-whale-palette-swatch] { width: 100%; height: 22px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 4px; box-sizing: border-box; }
[data-whale-native-sidebar] [data-whale-choice-unavailable] { grid-column: 1 / -1; color: var(--dsw-alias-label-secondary); font-size: .8125em; }
@container (max-width: 359px) { [data-whale-native-sidebar] [data-whale-choice-segments="swatches"] { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media (forced-colors: active) {
  [data-whale-native-sidebar] [data-whale-choice-segment] input:checked + [data-whale-segment-face] { border: 2px solid Highlight; color: CanvasText; background: Canvas; }
  [data-whale-native-sidebar] [data-whale-choice-segment] input:focus-visible + [data-whale-segment-face] { outline-color: Highlight; }
  [data-whale-native-sidebar] [data-whale-palette-swatch] { forced-color-adjust: none; }
}
@media (prefers-reduced-motion: reduce) { [data-whale-native-sidebar] [data-whale-choice-segment] input:active:enabled + [data-whale-segment-face] { transform: none; } }

@media (max-height: 400px) {
  [data-whale-native-sidebar] { overflow: auto; }
  [data-whale-native-sidebar] [data-whale-page-panel] { flex: none; overflow: visible; }
}

[data-whale-native-sidebar] :where(input,button,select,textarea,output) { font-variant-numeric: tabular-nums; }
[data-whale-native-sidebar] :where(button,input,textarea) { box-shadow: none; }
[data-whale-native-sidebar] [data-whale-author-switches] { margin: 0 0 24px !important; gap: 12px !important; }
[data-whale-native-sidebar] [data-whale-author-switches] > :is(label,[data-whale-author-bool-row]) { display: grid !important; grid-template-columns: minmax(0,1fr) auto; column-gap: 8px; align-items: center; min-height: 36px; }
[data-whale-native-sidebar] [data-whale-author-switches] > label > span:first-child { overflow-wrap: anywhere; }
[data-whale-native-sidebar] input[type="checkbox"]:is([data-whale-author-key],[data-whale-interface-toggle],[data-whale-playback-option]) {
  appearance: none; width: 30px; height: 18px; min-width: 30px; border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px; background: var(--dsw-specific-selector, var(--dsw-alias-button-elevated-fill)); border-color: var(--dsw-alias-label-secondary); position: relative; margin: 0;
}
[data-whale-native-sidebar] input[type="checkbox"]:is([data-whale-author-key],[data-whale-interface-toggle],[data-whale-playback-option])::before {
  content: ''; position: absolute; width: 12px; height: 12px; top: 2px; left: 2px;
  border-radius: 50%; background: var(--dsw-alias-label-primary);
}
[data-whale-native-sidebar] input[type="checkbox"]:is([data-whale-author-key],[data-whale-interface-toggle],[data-whale-playback-option]):checked { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); }
[data-whale-native-sidebar] input[type="checkbox"]:is([data-whale-author-key],[data-whale-interface-toggle],[data-whale-playback-option]):checked::before { left: 14px; background: var(--wm-custom-btn-fg, #fff); }
[data-whale-native-sidebar] input[type="checkbox"][data-whale-interface-toggle]:indeterminate::before { left: 8px; }
[data-whale-native-sidebar] input[type="range"] { appearance: none; background: transparent; height: 24px; accent-color: var(--dsw-alias-brand-primary); }
[data-whale-native-sidebar] input[type="range"]::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: var(--dsw-alias-border-l2); }
[data-whale-native-sidebar] input[type="range"]::-webkit-slider-thumb { appearance: none; width: 14px; height: 14px; margin-top: -5px; border-radius: 50%; background: var(--dsw-alias-brand-primary); border: 1px solid var(--dsw-alias-border-l2); }
[data-whale-native-sidebar] input[type="range"]::-moz-range-track { height: 4px; border-radius: 2px; background: var(--dsw-alias-border-l2); }
[data-whale-native-sidebar] input[type="range"]::-moz-range-thumb { width: 14px; height: 14px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 50%; background: var(--dsw-alias-brand-primary); }
[data-whale-native-sidebar] [data-whale-gallery-grid] { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; min-width: 0; }
[data-whale-native-sidebar] button[data-whale-gallery-item] { position: relative; padding: 0; display: block; min-width: 0; overflow: hidden; text-align: left; font: inherit; color: inherit; background: transparent; border-radius: 6px; border: 1px solid var(--dsw-alias-border-l2); }
[data-whale-native-sidebar] button[data-whale-gallery-item][aria-pressed="true"] { border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-button-info-fill); }
[data-whale-native-sidebar] [data-whale-gallery-thumbnail] { position: relative; }
[data-whale-native-sidebar] [data-whale-gallery-type] { position: absolute; top: 4px; left: 4px; padding: 1px 5px; border-radius: 3px; font-size: .6875em; line-height: 1.5; color: var(--dsw-alias-label-primary); background: var(--dsw-specific-menu, var(--dsw-alias-bg-base)); }
[data-whale-native-sidebar] [data-whale-gallery-caption] { display: flex; align-items: center; gap: 4px; min-width: 0; padding: 6px; font-size: .8125em; }
[data-whale-native-sidebar] [data-whale-gallery-title] { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
[data-whale-native-sidebar] [data-whale-gallery-selected] { flex: none; color: var(--dsw-alias-brand-primary); }
[data-whale-native-sidebar] [data-whale-gallery-item]:enabled:hover { background: var(--dsw-alias-interactive-bg-hover); }
[data-whale-native-sidebar] [data-whale-gallery-item]:disabled { opacity: .5; }
[data-whale-native-sidebar] [data-whale-gallery-playing] { position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; display: grid; place-items: center; border-radius: 50%; font-size: .6875em; color: var(--dsw-alias-label-primary); background: var(--dsw-specific-menu, var(--dsw-alias-bg-base)); }
[data-whale-native-sidebar] [data-whale-gallery-count] { color: var(--dsw-alias-label-secondary); font-size: .8125em; }
[data-whale-native-sidebar] [data-whale-gallery-pagination] { position: sticky; bottom: -16px; margin-bottom: -16px; z-index: 2; display: flex; align-items: center; justify-content: center; gap: 12px; padding: 6px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; background: rgb(var(--wm-layer2-rgb)); color: var(--dsw-alias-label-primary); }
[data-whale-native-sidebar] [data-whale-gallery-pagination] output { font-size: .8125em; font-variant-numeric: tabular-nums; }
[data-whale-native-sidebar] [data-whale-gallery-pagination] button { min-width: 32px; }
@container (min-width: 480px) { [data-whale-native-sidebar] [data-whale-gallery-grid] { grid-template-columns: repeat(3,minmax(0,1fr)); } }
@container (max-width: 299px) { [data-whale-native-sidebar] [data-whale-gallery-grid] { grid-template-columns: minmax(0,1fr); } }
@media (forced-colors: active) {
  [data-whale-native-sidebar] input[type="checkbox"]:is([data-whale-author-key],[data-whale-interface-toggle],[data-whale-playback-option]),
  [data-whale-native-sidebar] input[type="range"] { appearance: auto; }
  [data-whale-native-sidebar] input[type="checkbox"]::before { display: none; }
}

[data-whale-native-sidebar] [data-whale-choice-root] { display: block; min-width: 0; }
[data-whale-native-sidebar] button[data-whale-choice] { width: 100%; display: flex; align-items: center; gap: 10px; text-align: left; padding: 5px 10px; min-height: 32px; }
[data-whale-native-sidebar] [data-whale-choice-label] { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
[data-whale-native-sidebar] [data-whale-choice-chevron] { margin-inline: 4px; }
[data-whale-native-sidebar] [data-whale-choice-list] {
  box-sizing: border-box; padding: 4px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px;
  color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-base); font: inherit; line-height: 1.5;
  overflow: auto; overscroll-behavior: contain; box-shadow: 0 3px 12px rgb(0 0 0 / .14);
}
[data-whale-native-sidebar] [data-whale-choice-list]::backdrop { background: transparent; pointer-events: none; }
[data-whale-native-sidebar] [data-whale-choice-list] [role="option"] { display: flex; gap: 8px; align-items: baseline; min-height: 32px; padding: 5px 8px; border-radius: 4px; box-sizing: border-box; overflow-wrap: anywhere; cursor: pointer; }
[data-whale-native-sidebar] [data-whale-choice-check] { flex: 0 0 16px; color: var(--dsw-alias-brand-primary); }
[data-whale-native-sidebar] [data-whale-choice-list] [aria-selected="true"] { background: var(--dsw-alias-button-info-fill); }
[data-whale-native-sidebar] [data-whale-choice-list] [data-active="true"] { outline: 1px solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset: -1px; }
[data-whale-native-sidebar] [data-whale-choice-list] [role="option"]:not([aria-disabled="true"]):hover { background: var(--dsw-alias-interactive-bg-hover); }
[data-whale-native-sidebar] [data-whale-choice-list] [aria-disabled="true"] { color: var(--dsw-alias-label-secondary); cursor: not-allowed; }
@media (prefers-reduced-motion: reduce) { [data-whale-native-sidebar] *,[data-whale-native-sidebar] *::before { transition: none !important; } }

`;

const NATIVE_APPEARANCE_TRIGGER_CSS = `
button[data-whale-native-trigger] {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 28px; padding: 4px 8px; box-sizing: border-box;
  border: 1px solid transparent; border-radius: 6px;
  color: inherit; background: transparent; font: inherit; line-height: 1.4; cursor: pointer;
}
button[data-whale-native-trigger]:enabled:hover { background: var(--dsw-alias-interactive-bg-hover); }
button[data-whale-native-trigger]:enabled:active { background: var(--dsw-alias-interactive-bg-active); }
button[data-whale-native-trigger]:disabled { opacity: .45; cursor: not-allowed; }
button[data-whale-native-trigger]:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset: 2px;
}
`;

// One command gate belongs to the controller integration, not a provider/view generation.
/** One editor surface at a time; a timed-out close never grants editing permission. */
function createAppearanceEditorGate({readBridge,dock,timers=globalThis,timeoutMs=4000}={}) {
  const listeners=new Set(),leases=new Set();
  let disposed=false,pending=null,blocked=false,message=null,snapshot;
  function bridgeSafe(){try{const value=readBridge();return value?.mode==='docked'&&value.unconfirmedCleanup===false;}catch{return false;}}
  function refresh(){
    if(disposed)return;
    const safe=bridgeSafe()&&!pending&&!blocked;
    const next={nativeAllowed:safe&&leases.size===0,legacyAllowed:safe&&leases.size>0,
      canRequestNative:leases.size===0&&!pending,busy:pending!==null,message:leases.size>0&&safe?'请先关闭通用设置或旧外观页':message};
    if(snapshot&&Object.keys(next).every(key=>Object.is(next[key],snapshot[key])))return;
    snapshot=Object.freeze(next);for(const fn of [...listeners])fn();
  }
  function prepare(){
    if(disposed)return {ok:false,error:'disposed'};
    if(pending)return {ok:false,error:'cleanup-busy'};
    // A late close result needs a new user gesture, including when it eventually succeeded.
    blocked=false;message=null;
    if(bridgeSafe()){refresh();return {ok:true};}
    const ticket={timer:null,expired:false};pending=ticket;message='正在关闭旧独立窗…';refresh();
    ticket.timer=timers.setTimeout(()=>{if(disposed||pending!==ticket)return;ticket.expired=true;blocked=true;message='独立窗关闭结果未确认，请稍后重试';refresh();},timeoutMs);
    Promise.resolve().then(()=>dock()).then(result=>{
      if(disposed||pending!==ticket)return;
      if(!ticket.expired&&!ticket.abandoned){blocked=result?.ok!==true||!bridgeSafe();message=blocked?'独立窗关闭未确认，请重试':'旧独立窗已关闭，请再次打开侧栏';}
    },()=>{if(!disposed&&pending===ticket){blocked=true;message='独立窗关闭未确认，请重试';}}).finally(()=>{
      timers.clearTimeout(ticket.timer);if(disposed||pending!==ticket)return;pending=null;refresh();
    });
    return {ok:false,error:'cleanup-required'};
  }
  refresh();
  return Object.freeze({getSnapshot:()=>snapshot,subscribe(fn){if(disposed)return()=>{};listeners.add(fn);return()=>listeners.delete(fn);},refresh,
    prepareNative(){if(leases.size)return {ok:false,error:'legacy-editor-active'};return prepare();},
    acquireLegacy(){if(disposed)return()=>{};const token=Symbol('legacy-editor');leases.add(token);refresh();prepare();let released=false;
      return()=>{if(released)return;released=true;leases.delete(token);if(!leases.size&&pending){pending.abandoned=true;blocked=true;message='编辑页已关闭，请再次打开外观侧栏';}refresh();};},
    retry:prepare,
    dispose(){if(disposed)return;disposed=true;if(pending)timers.clearTimeout(pending.timer);leases.clear();listeners.clear();},
  });
}

/** Mount the old controls only after the native editors have been withdrawn. */
function createLegacyAppearanceBoundary({React,editorGate,Component}) {
  return function LegacyAppearanceBoundary(props){
    const state=React.useSyncExternalStore(editorGate.subscribe,editorGate.getSnapshot,editorGate.getSnapshot);
    const [admitted,setAdmitted]=React.useState(false);
    React.useEffect(()=>{const release=editorGate.acquireLegacy();setAdmitted(true);return()=>{release();};},[]);
    if(!admitted||!state.legacyAllowed)return React.createElement('div',{'data-whale-legacy-pending':true},
      React.createElement('span',{role:'status'},state.message??'外观编辑尚未就绪'),
      admitted&&!state.busy?React.createElement('button',{type:'button',className:'dsw-btn',onClick:()=>editorGate.retry()},'重试'):null);
    return React.createElement('div',{'data-whale-legacy-editor':true},React.createElement(Component,props));
  };
}

function createNativePlaybackGate({timers=globalThis,timeoutMs=12000}={}) {
  const listeners=new Set(),tasks=new Set();
  let disposed=false,current=null,unknown=false,error=null;
  const deadline=Number.isFinite(timeoutMs)&&timeoutMs>0?timeoutMs:12000;
  const notify=()=>{if(!disposed)for(const fn of [...listeners])fn();};
  return {
    read:()=>({busy:!!current&&!current.uiDone,action:current?.action??null,unknown,error,draining:tasks.size>0,
      canStart:!disposed&&!unknown&&tasks.size===0,
      canStop:!disposed&&(!current||current.uiDone)&&![...tasks].some(task=>task.action==='stop')}),
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    run(action,invoke){
      if(disposed)return Promise.resolve({ok:false,error:'disposed'});
      if((current&&!current.uiDone)||(action==='start'&&(unknown||tasks.size))||(action==='stop'&&[...tasks].some(task=>task.action==='stop')))return Promise.resolve({ok:false,error:'busy'});
      const task={action,uiDone:false,timer:null,resolve:null};current=task;tasks.add(task);error=null;
      const result=new Promise(resolve=>{task.resolve=resolve;});
      const finishUI=value=>{if(task.uiDone)return;task.uiDone=true;timers.clearTimeout(task.timer);task.resolve(value);};
      task.timer=timers.setTimeout(()=>{if(disposed)return;finishUI({ok:false,error:'playback-result-unknown'});if(current===task){unknown=true;error='操作结果未确认';}notify();},deadline);
      // Publish the lock before invoking a controller that can synchronously notify other views.
      notify();
      let returned;
      try{returned=invoke();}catch{finish(false,null);return result;}
      Promise.resolve(returned).then(value=>finish(true,value),()=>finish(false,null));
      function finish(fulfilled,value){
        tasks.delete(task);
        if(disposed){finishUI({ok:false,error:'disposed'});return;}
        if(current===task){
          const failed=value?.ok===false||['error','cleanup-failed'].includes(value?.state)||
            (action==='stop'&&(!['idle','stopped'].includes(value?.state)||value?.cleanupPending===true));
          const recognized=fulfilled&&value&&['idle','stopped','starting','connecting','playing','waiting','retrying','stopping','error','cleanup-failed'].includes(value.state);
          unknown=!recognized||(action==='stop'&&failed);
          error=unknown?'操作结果未确认':failed?(action==='start'?'未能开始播放':'停止未确认，请重试清理'):null;
          finishUI({ok:recognized&&!failed,error:unknown?'playback-result-unknown':failed?'playback-failed':null});
        }else finishUI({ok:false,error:'superseded'});
        notify();
      }
      return result;
    },
    dispose(){if(disposed)return;disposed=true;listeners.clear();for(const task of tasks){timers.clearTimeout(task.timer);if(!task.uiDone){task.uiDone=true;task.resolve({ok:false,error:'disposed'});}}tasks.clear();},
  };
}

// Cache confirmation starts only from an explicit open/retry, never a render or visibility change.
function createNativeCatalogRead(controller,{timers=globalThis,timeoutMs=4000}={}) {
  const listeners=new Set(),views=new Map(),viewReleases=new Set();
  let disposed=false,request=null,error=null;
  const ready=cache=>cache?.ok!==false&&cache?.state==='ready'&&cache?.loaded===true&&cache?.loading!==true;
  const notify=()=>{if(!disposed)for(const fn of [...listeners])fn();};
  const read=()=>({loading:request!==null,error});
  function cancel(){const old=request;if(!old)return;request=null;if(!error)error='目录加载已取消';timers.clearTimeout(old.timer);old.abort.abort();notify();}
  function ensure(){
    if(disposed||request)return;
    let cache;
    try{cache=controller.wallpaper.getLibrarySnapshot?.();}catch{error='壁纸目录暂不可用';notify();return;}
    if(ready(cache)){error=null;notify();return;}
    if(cache?.loading===true||cache?.state==='loading')return;
    if(typeof controller.wallpaper.readLibrary!=='function'){error='壁纸目录暂不可用';notify();return;}
    const own={abort:new AbortController(),timer:null};request=own;error=null;
    own.timer=timers.setTimeout(()=>{if(request!==own||disposed)return;error='壁纸目录读取超时';cancel();},Number.isFinite(timeoutMs)&&timeoutMs>0?timeoutMs:4000);
    notify();
    function finish(failed){
      if(disposed||request!==own)return;
      request=null;timers.clearTimeout(own.timer);
      try{error=!failed&&ready(controller.wallpaper.getLibrarySnapshot?.())?null:'壁纸目录读取失败';}catch{error='壁纸目录暂不可用';}
      notify();
    }
    try{Promise.resolve(controller.wallpaper.readLibrary({ensure:true,signal:own.abort.signal})).then(()=>finish(false),()=>finish(true));}
    catch{finish(true);}
  }
  return {read,ensure,cancel,
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    registerView(token,signal){
      if(disposed)return()=>{};
      views.set(token,false);let released=false;
      const remove=()=>{if(released)return;released=true;signal?.removeEventListener('abort',remove);viewReleases.delete(remove);
        const wasVisible=views.get(token),existed=views.delete(token);if(existed&&(!views.size||wasVisible&&![...views.values()].some(Boolean)))cancel();};
      viewReleases.add(remove);signal?.addEventListener('abort',remove,{once:true});
      if(signal?.aborted)remove();
      return remove;
    },
    visible(token,visible){if(disposed||!views.has(token))return;const had=[...views.values()].some(Boolean);views.set(token,visible===true);if(had&&![...views.values()].some(Boolean))cancel();},
    dispose(){if(disposed)return;cancel();disposed=true;for(const off of [...viewReleases])off();listeners.clear();views.clear();},
  };
}

function nativeGalleryItems(library,ratings) {
  if(library?.ok===false||library?.state!=='ready'||library?.loaded!==true||library?.loading)return [];
  const seen=new Set(),rows=[];
  for(const item of Array.isArray(library.items)?library.items:[]) {
    if(!item||typeof item.id!=='string'||!/^(?:lucy|we-[a-f0-9]{24})$/.test(item.id)||seen.has(item.id))continue;
    seen.add(item.id);
    const rating=item.contentRating??(item.id==='lucy'?'Everyone':'unknown');
    if(!ratings.includes(rating))continue;
    const supported=['scene','video','web'].includes(item.type);
    rows.push(Object.freeze({id:item.id,title:typeof item.title==='string'&&item.title.trim()?item.title.slice(0,200):item.id==='lucy'?'Lucy':'未命名壁纸',
      type:supported?item.type:'unknown',contentRating:rating,selectable:item.available===true&&supported,
      hasPreview:item.available===true&&supported&&item.previewRef?.wallpaperId===item.id&&item.previewRef?.kind==='preview'}));
  }
  if(!seen.has('lucy')&&ratings.includes('Everyone'))rows.unshift(Object.freeze({id:'lucy',title:'Lucy',type:'scene',contentRating:'Everyone',selectable:true,hasPreview:true}));
  return Object.freeze(rows);
}

// Deadlines include queue wait. A reader ignoring abort keeps its physical slot until settlement.
function createNativePreviewQueue(loadPreview,{timers=globalThis,timeoutMs=4000}={}) {
  const jobs=new Set(),queue=[];let active=0,disposed=false;
  function pump(){while(!disposed&&active<2&&queue.length){const job=queue.shift();if(job.done)continue;job.started=true;active++;
    let result;try{result=loadPreview(job.id,{signal:job.abort.signal});}catch(error){settled(job,error);continue;}
    Promise.resolve(result).then(blob=>settled(job,null,blob),error=>settled(job,error));}}
  function finishUI(job,error,blob){if(job.done)return;job.done=true;timers.clearTimeout(job.timer);job.signal?.removeEventListener('abort',job.cancel);
    if(error)job.reject(Error('preview-unavailable'));else job.resolve(blob);}
  function cancel(job){finishUI(job,true);job.abort.abort();if(!job.started){jobs.delete(job);const index=queue.indexOf(job);if(index>=0)queue.splice(index,1);}pump();}
  function settled(job,error,blob){active--;jobs.delete(job);const valid=blob&&Number.isFinite(blob.size)&&blob.size>0&&blob.size<=4*1024*1024&&['image/png','image/jpeg','image/gif','image/webp'].includes(blob.type);
    finishUI(job,error||!valid||disposed||job.abort.signal.aborted,blob);pump();}
  return {read:()=>({active,queued:queue.length}),
    request(id,{signal}={}){if(disposed||signal?.aborted||typeof loadPreview!=='function'||typeof id!=='string'||!/^(?:lucy|we-[a-f0-9]{24})$/.test(id))return Promise.reject(Error('preview-unavailable'));
      return new Promise((resolve,reject)=>{const job={id,signal,resolve,reject,abort:new AbortController(),done:false,started:false,timer:null,cancel:null};job.cancel=()=>cancel(job);jobs.add(job);
        job.timer=timers.setTimeout(job.cancel,timeoutMs);signal?.addEventListener('abort',job.cancel,{once:true});queue.push(job);pump();});},
    dispose(){if(disposed)return;disposed=true;for(const job of [...jobs])cancel(job);jobs.clear();queue.length=0;},
  };
}

// UI conversion only. Protocol authorization/validation stays in the shared author contract.
function nativeAuthorColor(value){
  if(typeof value!=='string'||!value.trim())return null;const rgb=value.trim().split(/\s+/).map(Number);
  if(rgb.length!==3||rgb.some(n=>!Number.isFinite(n)||n<0||n>1))return null;
  return {rgb,hex:'#'+rgb.map(n=>Math.round(n*255).toString(16).padStart(2,'0')).join('')};
}
function nativeAuthorColorFromHex(text){return typeof text==='string'&&/^#[a-f0-9]{6}$/i.test(text)?[1,3,5].map(i=>parseInt(text.slice(i,i+2),16)/255).join(' '):null;}

// One UI transaction lane across provider/view replacement. Host still owns the real executor.
function createNativeAuthorSwitches({request,timers=globalThis,validateValue}={}) {
  const listeners=new Set(),views=new Map();let context=null,epoch=0,active=null,disposed=false,phase='idle',message=null,schema=null,revision=null;
  const initialReadMode=Object.freeze({});let initialReadEpoch=-1;
  let fields=Object.freeze([]),values={},marks={},desired=new Map(),snapshot,recovery=null,owned=null;
  const edits=new Map();
  function valid(field,value){try{return field.type==='bool'?typeof value==='boolean':typeof validateValue==='function'&&validateValue(field,value)===value;}catch{return false;}}
  function cancelEdits(view){for(const [key,edit]of edits)if(view===undefined||edit.ticket.view===view)edits.delete(key);}
  function invalidateStaleRecovery(){if(recovery?.stale&&recovery.allowed)recovery=Object.freeze({...recovery,allowed:false});}
  const currentEdit=ticket=>ticket&&edits.get(ticket.key)?.ticket===ticket&&ticket.epoch===epoch&&ticket.context===context&&views.get(ticket.view)===true&&!disposed;
  const visible=()=>[...views.values()].some(Boolean);
  function publish(){snapshot=Object.freeze({fields,values:Object.freeze({...values,...Object.fromEntries(desired),...Object.fromEntries([...edits].map(([key,edit])=>[key,edit.value]))}),marks:Object.freeze({...marks}),
    phase,message,loading:phase==='reading',busy:active!==null,editing:edits.size>0,canRead:!!context&&visible()&&!active&&!disposed,
    recovery,canDiscard:!!context&&visible()&&!active&&!disposed&&recovery?.allowed===true,
    canEdit:!!context&&visible()&&schema!==null&&!recovery&&['ready','writing'].includes(phase)&&!disposed});
    if(!disposed)for(const fn of [...listeners])fn();}
  function cancel(){if(active)active.abort.abort();}
  function check(job){if(disposed||active!==job||job.abort.signal.aborted||context!==job.context||epoch!==job.epoch||!visible())throw Error('cancelled');}
  function accept(result,{fingerprint=null,expected=null,dirty=[],requireActive=true,allowDirty=false}={}){
    const s=result?.schema,d=result?.draft;
    if(result?.ok!==true){const error=Error('request-failed');error.uncertain=result?.sentMayHaveOccurred===true;throw error;}
    if(!allowDirty&&!dirty.length&&Array.isArray(d?.dirtyKeys)&&d.dirtyKeys.length)throw Error('draft-pending');
    if(s?.wallpaperId!=='lucy'||s.schemaVersion!==1||!/^([a-f0-9]{64})$/.test(s.fingerprint)||fingerprint&&fingerprint!==s.fingerprint||
      !Array.isArray(s.fields)||s.fields.length>256||!Number.isSafeInteger(d?.revision)||d.revision<0||expected!==null&&d.revision!==expected||d.stale||
      !Array.isArray(d.dirtyKeys)||d.dirtyKeys.length>256||new Set(d.dirtyKeys).size!==d.dirtyKeys.length||
      (allowDirty?d.dirtyKeys.some(key=>typeof key!=='string'||!/^[A-Za-z0-9_]{1,64}$/.test(key)||['__proto__','constructor','prototype'].includes(key.toLowerCase())||!s.fields.some(field=>field.supported===true&&field.key===key)):
        d.dirtyKeys.length!==dirty.length||d.dirtyKeys.some(key=>!dirty.includes(key))))throw Error('response-invalid');
    const found=[],seen=new Set(),next={};
    for(const field of s.fields){
      if(field.supported!==true||!['bool','slider','color','combo','textinput'].includes(field.type)||field.type!=='bool'&&typeof validateValue!=='function')continue;
      if(typeof field.key!=='string'||!/^[A-Za-z0-9_]{1,64}$/.test(field.key)||['__proto__','constructor','prototype'].includes(field.key.toLowerCase())||seen.has(field.key)||!valid(field,d.values?.[field.key]))throw Error('response-invalid');
      seen.add(field.key);
      if(typeof field.label!=='string'||!field.label.trim()||field.label.length>160||/[<>\x00-\x1f]/.test(field.label)||field.label.startsWith('ui_'))continue;
      let range={};
      if(field.type==='slider'){
        // Integer sliders with a fractional lattice need a different UI; never silently round them.
        if(!field.fraction&&field.step!=null&&(!Number.isInteger(field.min)||!Number.isInteger(field.step)))continue;
        range={min:field.min,max:field.max,step:field.step,fraction:field.fraction,supported:true,
          rangeMin:field.fraction?field.min:Math.ceil(field.min),rangeMax:field.fraction?field.max:Math.floor(field.max),rangeStep:field.step??(field.fraction?'any':1)};
        if(range.rangeMin>range.rangeMax)continue;
      }
      if(field.type==='combo'){
        if(!Array.isArray(field.options)||!field.options.length||field.options.length>64)throw Error('response-invalid');
        const options=[],identities=new Set();
        for(const option of field.options){
          if(!option||typeof option!=='object'||!valid(field,option.value)||identities.has(JSON.stringify(option.value)))throw Error('response-invalid');
          identities.add(JSON.stringify(option.value));options.push(Object.freeze({label:option.label,value:option.value}));
        }
        if(options.some(option=>typeof option.label!=='string'||!option.label.trim()||option.label.length>160||/[<>\x00-\x1f\x7f]/.test(option.label)||option.label.startsWith('ui_')))continue;
        range={options:Object.freeze(options)};
      }
      found.push(Object.freeze({key:field.key,label:field.label,type:field.type,supported:true,...range}));next[field.key]=d.values[field.key];
    }
    if(result.application?.available!==true||requireActive&&result.application?.targetActive!==true)throw Error('target-unavailable');
    const delivery=d.delivery?.revision===d.revision&&['none','not-sent','pending','confirmed','unknown','untracked'].includes(d.delivery.state)?d.delivery.state:'untracked';
    return {fingerprint:s.fingerprint,revision:d.revision,fields:Object.freeze(found),values:next,dirtyKeys:[...d.dirtyKeys],delivery};
  }
  function authorReadFailureCode(error,job){
    const d=error?.whaleReadDiagnostic??job?.readDiagnostic;
    const stages=['bridge','snapshot','schema'];
    const reasons=['disposed','disconnected','unavailable','cancelled','transport','http','json','permission','context','timeout','metadata','limit','rejected'];
    if(d&&stages.includes(d.stage)&&reasons.includes(d.reason))return d.stage+'.'+d.reason+(Number.isInteger(d.status)&&d.status>=100&&d.status<=599?'.'+d.status:'');
    const codes={'response-invalid':'validation.shape','target-unavailable':'target.unverified','cancelled':'controller.cancelled','draft-pending':'record.pending'};
    return codes[error?.message]??'controller.unknown';
  }
  function run(kind,work){
    if(disposed||active||!context||!visible()||typeof request!=='function')return Promise.resolve({ok:false,error:'unavailable'});
    const job={context,epoch,abort:new AbortController(),applyPending:false};active=job;if(kind==='read'){initialReadEpoch=epoch;cancelEdits();}phase=kind==='read'?'reading':'writing';message=null;publish();
    let timer,onAbort;
    const guard=new Promise((_,reject)=>{onAbort=()=>reject(Error('cancelled'));job.abort.signal.addEventListener('abort',onAbort,{once:true});timer=timers.setTimeout(()=>job.abort.abort(),kind==='write'?12000:4000);});
    const physical=Promise.resolve().then(()=>{check(job);return work(job);});
    const release=()=>{if(active===job){active=null;publish();}};physical.then(release,release);
    return Promise.race([physical,guard]).then(()=>{if(disposed||context!==job.context||epoch!==job.epoch)return {ok:false,error:'stale'};phase=recovery?'blocked':'ready';message=null;publish();return {ok:true};},error=>{
      if(!disposed&&context===job.context&&epoch===job.epoch){phase='blocked';const uncertain=job.applyPending&&error.uncertain!==false||error.uncertain===true;
        message=error.message==='schema-readonly-stale'?'参数结构已变化，请手动重新读取以更新本机记录':error.message==='schema-refresh-blocked'?'作者设置已变化，旧待处理记录已保留，暂不能自动刷新':error.message==='schema-changed'?'作者设置已变化，请重新读取':error.message==='draft-pending'?'另有待发送修改，暂不能即时应用':kind==='discard'?'清除结果未确认，请重新读取':kind==='read'?'未能读取设置，请重试':uncertain?'下发结果未确认，请观察后重新读取':'未能应用，请重新读取后再修改';
        if(kind==='read'&&message==='未能读取设置，请重试')message+=' ['+authorReadFailureCode(error,job)+']';
        cancelEdits();if(recovery)recovery=Object.freeze({...recovery,allowed:false});for(const key of desired.keys())marks[key]=uncertain?'unknown':'error';publish();}
      return {ok:false,error:'author-switches-failed'};
    }).finally(()=>{timers.clearTimeout(timer);job.abort.signal.removeEventListener('abort',onAbort);});
  }
  async function call(job,route,payload){check(job);const result=await request(route,payload,{signal:job.abort.signal});check(job);if(route==='schema')job.readDiagnostic=result?.__whaleReadDiagnostic??null;
    if(result?.ok===false&&['author_schema_changed','author_schema_stale','author_schema_refresh_unsafe'].includes(result.error))throw Object.assign(Error(result.error==='author_schema_refresh_unsafe'?'schema-refresh-blocked':'schema-changed'),{uncertain:result.sentMayHaveOccurred===true});return result;}
  const api={
    read:()=>snapshot,subscribe(fn){if(disposed)return()=>{};listeners.add(fn);return()=>listeners.delete(fn);},
    setContext(key){if(disposed||key===context)return;cancel();cancelEdits();epoch++;context=typeof key==='string'?key:null;schema=null;revision=null;fields=Object.freeze([]);values={};marks={};desired.clear();recovery=null;owned=null;phase='idle';message=null;publish();},
    view(token,isVisible){if(disposed)return;if(views.get(token)===true&&isVisible!==true)invalidateStaleRecovery();views.set(token,isVisible===true);if(isVisible!==true)cancelEdits(token);if(!visible())cancel();publish();},
    remove(token){if(views.get(token)===true)invalidateStaleRecovery();views.delete(token);cancelEdits(token);if(!visible())cancel();publish();},
    ensureLoaded(){
      if(disposed||!context||!visible()||active||phase!=='idle'||schema!==null||recovery||edits.size||desired.size||initialReadEpoch===epoch||typeof request!=='function')return Promise.resolve({ok:false,error:'initial-read-skipped'});
      return api.load(initialReadMode);
    },
    load(mode){const initial=mode===initialReadMode;return run('read',async job=>{let reply=await call(job,'schema',{wallpaperId:'lucy'});
      if(reply?.ok===true&&reply.draft?.stale===true){
        const d=reply.draft;
        if(d.values!==null||!Array.isArray(d.dirtyKeys)||d.dirtyKeys.length||d.delivery?.revision!==d.revision)throw Error('schema-refresh-blocked');
        // Validate the new schema/defaults before asking Host to replace a clean local record.
        const defaults=Object.fromEntries((reply.schema?.fields??[]).filter(field=>field.supported===true).map(field=>[field.key,field.defaultValue]));
        const candidate=accept({...reply,draft:{...d,stale:false,values:defaults}},{requireActive:false});
        const old=d.staleRecord,states=['none','not-sent','pending','confirmed','unknown','untracked'];
        if(old&&(typeof old.schemaFingerprint!=='string'||!/^([a-f0-9]{64})$/.test(old.schemaFingerprint)||old.schemaFingerprint===candidate.fingerprint||old.revision!==d.revision||!Array.isArray(old.keys)||old.keys.length>256||new Set(old.keys).size!==old.keys.length||old.keys.some(key=>typeof key!=='string'||!/^[A-Za-z0-9_]{1,64}$/.test(key)||['__proto__','constructor','prototype'].includes(key.toLowerCase()))||!Array.isArray(old.labels)||old.labels.length!==old.keys.length||old.labels.some(label=>typeof label!=='string'||!label.trim()||label.length>160||/[<>\x00-\x1f\x7f]/.test(label)||label.startsWith('ui_'))||old.delivery?.revision!==d.revision||old.delivery?.state!==d.delivery.state||!states.includes(old.delivery.state)))throw Error('schema-refresh-blocked');
        if(!['none','confirmed'].includes(d.delivery.state)||old?.keys.length){
          if(!old)throw Error('schema-refresh-blocked');
          recovery=Object.freeze({stale:true,fingerprint:candidate.fingerprint,previousFingerprint:old.schemaFingerprint,revision:candidate.revision,
            keys:Object.freeze([...old.keys]),labels:Object.freeze([...old.labels]),delivery:old.delivery.state,defaults:Object.freeze({...candidate.values}),own:false,
            unknown:old.delivery.state!=='not-sent',pending:old.delivery.state==='pending'||reply.application?.busy===true,
            allowed:reply.application?.busy===false&&reply.application?.targetActive===true&&old.delivery.state!=='pending'});
          cancelEdits();publish();return;
        }
        if(initial)throw Error('schema-readonly-stale');
        if(reply.application?.busy!==false||reply.application?.targetActive!==true)throw Error('schema-refresh-blocked');
        const refreshed=await call(job,'draft',{wallpaperId:'lucy',schemaFingerprint:candidate.fingerprint,expectedRevision:candidate.revision,action:'refresh-schema'});
        const confirmed=accept(refreshed,{fingerprint:candidate.fingerprint,expected:candidate.revision+1});
        if(refreshed.refreshed!==true||refreshed.mutation!=='refresh-schema'||refreshed.currentValuesKnown!==false||refreshed.application?.busy!==false||refreshed.draft?.delivery?.revision!==confirmed.revision||refreshed.draft?.delivery?.state!=='none'||Object.keys(candidate.values).length!==Object.keys(confirmed.values).length||Object.keys(candidate.values).some(key=>candidate.values[key]!==confirmed.values[key]))throw Error('schema-refresh-unconfirmed');
        reply=refreshed;
      }
      const next=accept(reply,{allowDirty:true,requireActive:false});
      if(!next.dirtyKeys.length&&reply.application?.targetActive!==true)throw Error('target-unavailable');
      const isOwn=owned&&owned.revision===next.revision&&owned.fingerprint===next.fingerprint&&Object.keys(owned.values).length===next.dirtyKeys.length&&next.dirtyKeys.every(key=>Object.hasOwn(owned.values,key)&&owned.values[key]===next.values[key]);
      recovery=next.dirtyKeys.length?Object.freeze({revision:next.revision,fingerprint:next.fingerprint,keys:Object.freeze(next.dirtyKeys),
        labels:Object.freeze(next.dirtyKeys.map(key=>{const label=reply.schema.fields.find(field=>field.key===key)?.label;return typeof label==='string'&&label.trim()&&label.length<=160&&!/[<>\x00-\x1f]/.test(label)&&!label.startsWith('ui_')?label:'其它参数';})),
        own:!!isOwn,unknown:next.delivery!=='not-sent',pending:next.delivery==='pending'||reply.application.busy===true,
        allowed:reply.application.busy===false&&next.delivery!=='pending'}):null;
      schema=next.fingerprint;revision=next.revision;fields=next.fields;values=next.values;marks={};desired.clear();cancelEdits();publish();});},
    discard({confirm=false,observed=false,expected=null,view=null}={}){
      if(confirm!==true||!snapshot.canDiscard||expected!==recovery||recovery.unknown&&observed!==true||recovery.stale&&views.get(view)!==true)return Promise.resolve({ok:false,error:'confirmation-required'});
      if(expected.stale)return run('discard',async job=>{
        const reply=await call(job,'draft',{wallpaperId:'lucy',schemaFingerprint:expected.fingerprint,expectedRevision:expected.revision,action:'discard-stale-schema',
          previousSchemaFingerprint:expected.previousFingerprint,discardKeys:[...expected.keys],expectedDelivery:{revision:expected.revision,state:expected.delivery},confirmDiscard:true,acknowledgeUnknown:expected.unknown&&observed===true});
        const next=accept(reply,{fingerprint:expected.fingerprint,expected:expected.revision+1,requireActive:false}),proof=reply.discardedRecord;
        if(reply.discarded!==true||reply.refreshed!==true||reply.mutation!=='discard-stale-schema'||reply.currentValuesKnown!==false||reply.application?.busy!==false||reply.draft?.delivery?.revision!==next.revision||reply.draft?.delivery?.state!=='none'||proof?.schemaFingerprint!==expected.previousFingerprint||proof.revision!==expected.revision||!Array.isArray(proof.keys)||proof.keys.length!==expected.keys.length||new Set(proof.keys).size!==proof.keys.length||proof.keys.some(key=>!expected.keys.includes(key))||proof.delivery?.revision!==expected.revision||proof.delivery?.state!==expected.delivery||Object.keys(next.values).length!==Object.keys(expected.defaults).length||Object.keys(expected.defaults).some(key=>next.values[key]!==expected.defaults[key]))throw Error('discard-unconfirmed');
        schema=next.fingerprint;revision=next.revision;fields=next.fields;values=next.values;marks={};desired.clear();recovery=null;owned=null;publish();
      });
      return run('discard',async job=>{const reply=await call(job,'draft',{wallpaperId:'lucy',schemaFingerprint:expected.fingerprint,expectedRevision:expected.revision,action:'discard',discardKeys:[...expected.keys],acknowledgeUnknown:expected.unknown&&observed===true});
        const next=accept(reply,{fingerprint:expected.fingerprint,expected:expected.revision+1,requireActive:false});
        if(reply.discarded!==true||reply.mutation!=='discard'||reply.currentValuesKnown!==false||Object.keys(values).some(key=>next.values[key]!==values[key]))throw Error('discard-unconfirmed');
        schema=next.fingerprint;revision=next.revision;fields=next.fields;values=next.values;marks={};desired.clear();recovery=null;owned=null;publish();});
    },
    editStart(key,owner,view,expected){if(!snapshot.canEdit||views.get(view)!==true||edits.has(key)||!fields.some(field=>field.key===key&&['slider','color','textinput'].includes(field.type)&&(expected===undefined&&field.type!=='textinput'||field===expected)))return null;
      const ticket=Object.freeze({key,owner,view,epoch,context,base:snapshot.values[key]});edits.set(key,{ticket,value:ticket.base});publish();return ticket;},
    editCurrent:ticket=>snapshot.canEdit&&!!currentEdit(ticket),
    editPreview(ticket,value){const field=fields.find(field=>field.key===ticket?.key);if(!currentEdit(ticket)||!snapshot.canEdit||!field||!valid(field,value))return false;
      edits.get(ticket.key).value=value;publish();return true;},
    editCancel(ticket){if(!currentEdit(ticket))return false;edits.delete(ticket.key);publish();return true;},
    editEnd(ticket){if(!currentEdit(ticket))return Promise.resolve({ok:false,error:'stale'});const value=edits.get(ticket.key).value;edits.delete(ticket.key);publish();
      return value===ticket.base?Promise.resolve({ok:true,unchanged:true}):api.change(ticket.key,value);},
    select(key,index,expected,view){const field=fields.find(item=>item.key===key);
      if(!snapshot.canEdit||views.get(view)!==true||field!==expected||field?.type!=='combo'||typeof index!=='string'||!/^(?:0|[1-9]\d?)$/.test(index)||!field.options[Number(index)])return Promise.resolve({ok:false,error:'unavailable'});
      const value=field.options[Number(index)].value;return Object.is(snapshot.values[key],value)?Promise.resolve({ok:true,unchanged:true}):api.change(key,value);
    },
    change(key,value){if(disposed||!snapshot.canEdit||edits.has(key)||!fields.some(field=>field.key===key&&valid(field,value)))return Promise.resolve({ok:false,error:'unavailable'});
      desired.set(key,value);marks[key]='busy';publish();if(active)return Promise.resolve({ok:true,queued:true});
      return run('write',async job=>{
        for(let round=0;desired.size;round++){
          if(round>=4)throw Error('burst-limit');check(job);
          const patch=Object.fromEntries(desired),keys=Object.keys(patch),fingerprint=schema;
          const saved=await call(job,'draft',{wallpaperId:'lucy',schemaFingerprint:fingerprint,expectedRevision:revision,values:patch});
          const next=accept(saved,{fingerprint,expected:revision+1,dirty:keys});
          if(keys.some(key=>next.values[key]!==patch[key]))throw Error('save-mismatch');revision=next.revision;owned={fingerprint,revision,values:{...patch}};
          job.applyPending=true;const applied=await call(job,'apply',{wallpaperId:'lucy',schemaFingerprint:fingerprint,expectedRevision:revision});
          if(applied?.ok!==true){const error=Error('apply-failed');error.uncertain=applied?.sentMayHaveOccurred===true;throw error;}
          const confirmed=accept(applied,{fingerprint,expected:revision,requireActive:false});
          if(applied.applySent!==true||applied.currentValuesKnown!==false||keys.some(key=>confirmed.values[key]!==patch[key]))throw Error('apply-unconfirmed');
          job.applyPending=false;values=confirmed.values;owned=null;
          for(const key of keys){if(desired.get(key)===patch[key]){desired.delete(key);marks[key]='sent';}}publish();
        }
      });
    },
    dispose(){if(disposed)return;cancel();cancelEdits();disposed=true;listeners.clear();views.clear();desired.clear();schema=null;fields=Object.freeze([]);values={};recovery=null;owned=null;publish();},
  };publish();return api;
}

// Local completion/IME state only; both editors reuse the same author transaction lane.
function createNativeAuthorTextEditor(options) {return createNativeAuthorInputEditor(options);}
function createNativeAuthorNumberEditor(options) {
  if(options.field?.type!=='slider')throw TypeError('Numeric editor requires a slider descriptor');
  return createNativeAuthorInputEditor({...options,numeric:true});
}
function createNativeAuthorInputEditor({author,field,view,isCurrent=()=>false,numeric=false}) {
  const owner=Symbol('author-text'),listeners=new Set();let ticket=null,compositionTicket=null,composing=false,fence=false,error=null,disposed=false,off=null,snapshot;
  let text=record();
  function format(value){return numeric?typeof value==='number'&&Number.isFinite(value)?String(value):'':typeof value==='string'?value:'';}
  function record(){return format(author.read().values[field.key]);}
  function preview(value){if(!numeric)return author.editPreview(ticket,value);
    if(value.length>64||!(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/).test(value))return false;
    const number=Number(value);return Number.isFinite(number)&&author.editPreview(ticket,number);}
  const invalid=numeric?'数值不符合范围或步长':'文字不符合参数限制';
  function current(){try{return !disposed&&isCurrent()===true;}catch{return false;}}
  function publish(){const next=Object.freeze({text,error,composing,editing:!!ticket});if(snapshot&&Object.keys(next).every(key=>snapshot[key]===next[key]))return;snapshot=next;if(!disposed)for(const fn of [...listeners])fn();}
  function cancel(message=null){const old=ticket;ticket=null;compositionTicket=null;composing=false;fence=false;error=null;if(old)author.editCancel(old);text=record();error=message;publish();}
  function sync(){if(disposed)return;if(ticket&&(!author.editCurrent(ticket)||!current())){cancel();return;}if(!ticket){const next=record();if(numeric&&next!==text)error=null;text=next;}publish();}
  function begin(){if(!current())return false;if(author.editCurrent(ticket))return true;if(ticket)cancel();
    ticket=author.editStart(field.key,owner,view,field);if(!ticket)return false;text=format(ticket.base);error=null;composing=false;fence=false;publish();return true;}
  function input(value){if(!author.editCurrent(ticket)||!current()||typeof value!=='string'){sync();return false;}text=value;
    if(!composing)error=preview(value)?null:invalid;publish();return true;}
  function complete(reason){if(!ticket)return Promise.resolve({ok:true,unchanged:true});
    if(!current()||!author.editCurrent(ticket)||composing||fence){cancel();return Promise.resolve({ok:false,error:'cancelled'});}
    if(!preview(text)){if(reason==='blur')cancel(numeric?'数值无效，未应用':'文字无效，未应用');else{error=invalid;publish();}return Promise.resolve({ok:false,error:'invalid'});}
    const old=ticket;ticket=null;compositionTicket=null;composing=false;fence=false;error=null;const result=author.editEnd(old);text=record();publish();return result;}
  const api={read:()=>snapshot,subscribe(fn){if(disposed)return()=>{};listeners.add(fn);if(!off)off=author.subscribe(sync);sync();return()=>{listeners.delete(fn);if(!listeners.size){off?.();off=null;}};},
    focus:begin,paste(){if(!composing)fence=false;return begin();},input,cancel,sync,complete,
    compositionStart(){if(!begin())return false;compositionTicket=ticket;composing=true;fence=false;error=null;publish();return true;},
    compositionEnd(value){if(!compositionTicket||compositionTicket!==ticket||!author.editCurrent(ticket)||!current())return false;compositionTicket=null;composing=false;return input(value);},
    keyDown({key,isComposing=false,keyCode=0}){if(composing||isComposing||keyCode===229){fence=true;return {prevent:false,stop:key==='Enter'};}
      if(key==='Enter'){if(!fence)void complete('enter');return {prevent:!fence,stop:true};}
      if(key==='Escape'){cancel();return {prevent:true,stop:true};}
      fence=false;if(key?.length===1||['Backspace','Delete'].includes(key))begin();return {prevent:false,stop:false};},
    keyUp({isComposing=false,keyCode=0}={}){if(composing||isComposing||keyCode!==229)fence=false;},
    dispose(){if(disposed)return;off?.();off=null;cancel();disposed=true;listeners.clear();}
  };publish();return api;
}

// Native sidebar over ONE existing controller. No autonomous playback, scans or window IO.
function createNativeAppearanceSidebar({ctx, React, controller,playback=null,catalogOptions,loadPreview,previewOptions,author=null,editorGate=null}) {
  const id = 'dsh-whale-mist/appearance-sidebar';
  const kind = 'whale-appearance';
  const right = ctx.sidebarRight;
  if (!right?.openTab || !right.mounted?.subscribe || !right.mounted?.getSnapshot ||
      !ctx.sidebarRightTabs?.register || !ctx.slots?.inject || !ctx.slots?.register ||
      !controller?.getSettingsSnapshot || !controller?.subscribeSettings ||
      !controller.wallpaper?.getStatus || !controller.wallpaper?.subscribeStatus) {
    throw Error('native-sidebar-services-unavailable');
  }
  const listeners = new Set(), releases = [];
  const transport=playback??createNativePlaybackGate();
  const catalogRead=createNativeCatalogRead(controller,catalogOptions);
  const previews=createNativePreviewQueue(loadPreview,previewOptions);
  const ranges = Object.freeze({brightness:[20,120],mask:[0,90],blur:[0,24],surface:[40,100],chatBackdrop:[0,100]});
  const themeIds=Object.freeze({mist:'whale-mist',abyss:'whale-abyss'});
  const paletteOptions=Object.freeze([['ocean','深海'],['graphite','石墨'],['violet','暗紫'],['jade','墨绿']]);
  const validPalette=value=>paletteOptions.some(([key])=>key===value);
  const validAccentColor=value=>typeof value==='string'&&/^#[0-9a-fA-F]{6}$/.test(value);
  const fieldErrors = {brightness:null,mask:null,blur:null,surface:null,chatBackdrop:null,textContrast:null,theme:null,palette:null,accentMode:null,accentColor:null,sidebar:null,canvas:null,glass:null,opaqueSidebar:null,motion:null,background:null,weMode:null,weAutoStart:null};
  const validValue = (key,value) => Object.hasOwn(ranges,key) && Number.isInteger(value) && value>=ranges[key][0] && value<=ranges[key][1];
  let disposed = false, failure = null, snapshot,galleryOpen=false,query='',page=0,selectionError=null;
  let accentColorRetry=null;
  let sourceEnableKey=null,sourceEnableEpoch=0;
  let sourceJob=null,imageKey=null,imageEpoch=0,videoKey=null,videoEpoch=0;
  const presetFields=['brightness','mask','blur','surface'],presetViews=new Map();
  let presetKey=null,presetEpoch=0,presetConfirmation=null,presetError=null,presetCacheKey=null,presetCache=null;
  const four=value=>value&&presetFields.every(key=>validValue(key,value[key]))?Object.freeze(Object.fromEntries(presetFields.map(key=>[key,value[key]]))):null;
  const sameFour=(a,b)=>!!a&&!!b&&presetFields.every(key=>a[key]===b[key]);
  function presetSnapshot(settings,status,context) {
    let available=false,target=null,saved=null,current=null,safe=false,reason='当前暂不可用';
    try{
      const p=controller.presets;
      available=settings.background==='wallpaper'&&['getSnapshot','subscribe','resolveTarget','save','apply','remove'].every(key=>typeof p?.[key]==='function');
      if(available){
        const resolution=p.resolveTarget(),store=p.getSnapshot();current=four(settings);
        const shape=store?.version===1&&store.entries&&typeof store.entries==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(store.entries));
        const identity=sceneId(resolution?.targetId);
        const eligible=context.allowed&&resolution?.ok===true&&identity===context.selectedId&&
          (context.state==='playing'?resolution.isPlaying===true&&context.activeId===identity:resolution.isPlaying===false);
        if(eligible&&shape){target=identity;const exists=Object.hasOwn(store.entries,target);saved=exists?four(store.entries[target]):null;
          safe=!!current&&(!exists||saved!==null);if(!safe)reason='预设数据暂不可用';}
        else if(resolution?.error==='mismatch')reason='请先停止播放或选回当前壁纸';
      }
    }catch{reason='预设暂时无法读取';}
    const nextKey=safe?JSON.stringify([context.key,target,current,saved]):null;
    if(nextKey!==presetKey){presetKey=nextKey;presetEpoch++;presetConfirmation=null;presetError=null;}
    const matching=sameFour(current,saved),cacheKey=JSON.stringify([available,target,context.title,current,saved,safe,matching,reason,presetEpoch,presetError]);
    if(presetCacheKey!==cacheKey||presetCache?.confirmation!==presetConfirmation){presetCacheKey=cacheKey;presetCache=Object.freeze({available,target,title:safe?context.title:null,current:safe?current:null,saved:safe?saved:null,safe,
      matching,canSave:safe&&!matching,canApply:safe&&!!saved&&!matching,canRemove:safe&&!!saved,ticket:safe?presetEpoch:null,reason:safe?null:reason,error:presetError,confirmation:presetConfirmation});}
    return presetCache;
  }
  let lastLibrary,lastFilter,lastSearch,lastPage,galleryVersion=0,galleryRows=Object.freeze([]),pageRows=Object.freeze([]),matches=0;
  const sceneId = value => typeof value === 'string' && /^(?:lucy|we-[a-f0-9]{24})$/.test(value) ? value : null;
  function activeTheme(){try{const id=ctx.theme?.getTheme?.()?.active?.id;return Object.keys(themeIds).find(key=>themeIds[key]===id)??null;}catch{return null;}}
  function canSetTheme(){try{return typeof ctx.theme?.getTheme==='function'&&typeof ctx.theme?.setTheme==='function';}catch{return false;}}
  function read() {
    let settings, status;
    try { settings = controller.getSettingsSnapshot(); status = controller.wallpaper.getStatus(); }
    catch { settings = {}; status = {state:'unknown'}; }
    settings ??= {}; status ??= {};
    if(accentColorRetry&&(accentColorRetry.actual!==settings.accentColor||accentColorRetry.mode!==settings.accentMode||
      accentColorRetry.theme!==settings.theme||accentColorRetry.active!==activeTheme()||accentColorRetry.session!==right.mounted.getSnapshot())){
      accentColorRetry=null;fieldErrors.accentColor=null;
    }
    const activeId = sceneId(status.activeSceneId) ?? sceneId(status.host?.activeSceneId);
    const hasActive=[status.activeSceneId,status.host?.activeSceneId].some(value=>value!=null);
    const selectedId=sceneId(settings.weScene);
    const gate=transport.read();
    const catalogState=catalogRead.read();
    let library=null,pendingCleanup=!!(status.cleanupPending||status.host?.cleanupPending||status.state==='stopping');
    try{library=controller.wallpaper.getLibrarySnapshot?.();}catch{}
    try{pendingCleanup ||=!!controller.wallpaper.hasPendingCleanup?.();}catch{pendingCleanup=true;}
    const ready=library?.ok!==false&&library?.loaded===true&&library?.state==='ready'&&library?.loading!==true;
    const ratings=typeof settings.weAgeRatings==='string'?settings.weAgeRatings.split(',').map(s=>s.trim()).filter(Boolean):['Everyone'];
    const allowed=ratings.every(s=>['Everyone','Questionable','Mature'].includes(s))?ratings:['Everyone'];
    const filter=allowed.join(',');
    if(lastLibrary!==library||lastFilter!==filter){lastLibrary=library;lastFilter=filter;galleryRows=nativeGalleryItems(library,allowed);galleryVersion++;lastSearch=null;}
    if(lastSearch!==query||lastPage!==page){const all=galleryRows.filter(row=>row.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));matches=all.length;
      page=Math.min(page,Math.max(0,Math.ceil(matches/12)-1));pageRows=Object.freeze(all.slice(page*12,page*12+12));lastSearch=query;lastPage=page;}
    const items=Array.isArray(library?.items)?library.items:[];
    const item=items.find(entry=>entry?.id===selectedId);
    const hostLucy=Array.isArray(status.host?.scenes)?status.host.scenes.find(entry=>entry?.id==='lucy'):null;
    const eligible=selectedId==='lucy'?allowed.includes('Everyone')&&item?.available!==false&&hostLucy?.available!==false:
      !!item&&allowed.includes(item.contentRating)&&item.available===true&&['scene','video','web'].includes(item.type);
    const labelFor=id=>{
      if(!id)return '身份未确认';
      if(id==='lucy')return 'Lucy';
      const entry=items.find(entry=>entry?.id===id);
      return entry&&allowed.includes(entry.contentRating)&&typeof entry.title==='string'&&entry.title.trim()?entry.title:'所选壁纸';
    };
    // Cached metadata only; respect the same age selection before exposing a title.
    let title = activeId === 'lucy' ? 'Lucy' : activeId ? '当前壁纸' : '无活动壁纸';
    try {
      const ratings = typeof settings.weAgeRatings === 'string' ? settings.weAgeRatings.split(',').map(s=>s.trim()) : [];
      const item = controller.wallpaper.getLibrarySnapshot?.()?.items?.find(v=>v.id === activeId);
      if (item && ratings.includes(item.contentRating) && typeof item.title === 'string' && item.title.trim()) title = item.title;
    } catch { /* Optional cached label does not affect playback or source identity. */ }
    const current = right.mounted.getSnapshot();
    const state = pendingCleanup ? 'stopping' : hasActive&&(!activeId||['idle','stopped'].includes(status.state))?'unknown':status.state;
    const labels = {idle:'未播放',stopped:'已停止',playing:'播放中',starting:'启动中',connecting:'连接中',waiting:'等待画面',stopping:'停止中',error:'播放异常','cleanup-failed':'待清理',retrying:'重试中'};
    const safeIdle=['idle','stopped','error'].includes(state)&&!hasActive&&!pendingCleanup;
    const needsStop=!safeIdle||gate.unknown;
    const action=needsStop?'stop':'start';
    const mode=['daily','preview'].includes(settings.weMode)?settings.weMode:null;
    const session=typeof current==='string'&&current.length>0;
    const optionsEditable=session&&typeof controller.set==='function'&&!pendingCleanup&&!gate.busy&&!gate.draining&&!gate.unknown&&
      ['idle','stopped','error','playing','connecting','waiting','retrying'].includes(state);
    const autoStart=typeof settings.weAutoStart==='boolean'?settings.weAutoStart:null;
    const autoEligible=selectedId==='lucy'&&mode==='daily'&&settings.background==='wallpaper'&&ready&&eligible;
    const externalStarting=state==='starting'&&!gate.draining;
    const canPlay=!sourceJob&&session&&!gate.busy&&!externalStarting&&(needsStop?gate.canStop&&typeof controller.wallpaper.stop==='function'&&!pendingCleanup:
      gate.canStart&&settings.background==='wallpaper'&&!!mode&&!!selectedId&&ready&&eligible&&typeof controller.wallpaper.start==='function');
    const showEnableWallpaper=settings.background==='none'&&['idle','stopped'].includes(state)&&!needsStop&&!gate.busy&&!gate.draining;
    const sourceTheme=activeTheme(),canEnableWallpaper=!sourceJob&&showEnableWallpaper&&admitted()&&session&&typeof controller.enableBackgroundSource==='function'&&
      gate.canStart&&!gate.unknown&&!hasActive&&!pendingCleanup&&Number.isSafeInteger(status.generation)&&status.generation>=0&&
      ['mist','abyss'].includes(settings.theme)&&sourceTheme===settings.theme;
    let closeState=null;try{closeState=controller.readBackgroundCloseState?.();}catch{}
    const fenceState=closeState?.fence?.state??'unprepared';
    let sourceReleased=false;try{sourceReleased=controller.wallpaper.canEnableBackgroundSource?.()===true;}catch{}
    // A completed source save invalidates the observation's context, not its private
    // released admission. A later Close starts a new fence rather than inspecting it forever.
    const closeAction=fenceState==='unconfirmed'?'retry':['unprepared','released'].includes(fenceState)||sourceReleased?'prepare':'inspect';
    const inspectOnly=closeAction==='inspect'&&!!closeState;
    const canCloseWallpaper=!sourceJob&&settings.background==='wallpaper'&&admitted()&&session&&!gate.busy&&!gate.draining&&!gate.unknown&&
      (inspectOnly||!pendingCleanup&&!externalStarting&&(['idle','stopped','playing','waiting','connecting'].includes(state)||state==='cleanup-failed'&&fenceState==='unconfirmed'))&&
      Number.isSafeInteger(status.generation)&&status.generation>=0&&['mist','abyss'].includes(settings.theme)&&sourceTheme===settings.theme&&
      !!closeState&&(inspectOnly||!closeState.uncertain)&&['prepareBackgroundClose','inspectBackgroundClose','retryBackgroundClose','commitBackgroundClose'].every(key=>typeof controller[key]==='function');
    const nextSourceKey=canEnableWallpaper||canCloseWallpaper?JSON.stringify([current,state,status.generation,settings,sourceTheme,fenceState]):null;
    if(nextSourceKey!==sourceEnableKey){sourceEnableKey=nextSourceKey;sourceEnableEpoch++;}
    let imageInfo=null;try{imageInfo=controller.media?.getSnapshot?.()?.media?.image??null;}catch{}
    const showLocalImage=typeof controller.editBackgroundImage==='function'&&['none','image'].includes(settings.background);
    const canEditImage=showLocalImage&&!sourceJob&&admitted()&&session&&!pendingCleanup&&!gate.busy&&!gate.draining&&!gate.unknown&&
      ['idle','stopped'].includes(state)&&!hasActive&&Number.isSafeInteger(status.generation)&&status.generation>=0&&
      ['mist','abyss'].includes(settings.theme)&&sourceTheme===settings.theme;
    const nextImageKey=canEditImage?JSON.stringify([current,state,status.generation,settings,sourceTheme,imageInfo]):null;
    if(nextImageKey!==imageKey){imageKey=nextImageKey;imageEpoch++;}
    let videoInfo=null;try{videoInfo=controller.media?.getSnapshot?.()?.media?.video??null;}catch{}
    const showLocalVideo=typeof controller.editBackgroundVideo==='function'&&['none','video'].includes(settings.background);
    const canEditVideo=showLocalVideo&&!sourceJob&&admitted()&&session&&!pendingCleanup&&!gate.busy&&!gate.draining&&!gate.unknown&&
      ['idle','stopped'].includes(state)&&!hasActive&&Number.isSafeInteger(status.generation)&&status.generation>=0&&
      ['mist','abyss'].includes(settings.theme)&&sourceTheme===settings.theme;
    const nextVideoKey=canEditVideo?JSON.stringify([current,state,status.generation,settings,sourceTheme,videoInfo]):null;
    if(nextVideoKey!==videoKey){videoKey=nextVideoKey;videoEpoch++;}
    const playLabel=gate.busy?(gate.action==='start'?'正在启动…':'正在停止…'):externalStarting?'正在启动…':pendingCleanup?'正在清理…':
      gate.draining&&!gate.unknown?'等待本轮结束':gate.unknown?(gate.action==='stop'?(gate.canStop?'重试清理':'停止结果待确认'):'停止并确认'):
      needsStop?(state==='cleanup-failed'?'重试清理':'停止播放'):'开始播放';
    const playHint=gate.unknown?'操作结果未确认':state==='cleanup-failed'?'上次清理未完成':
      (safeIdle?gate.error:null)??(!showEnableWallpaper&&!needsStop&&!canPlay?(settings.background!=='wallpaper'?'请先选择壁纸背景':!selectedId?'请先选择壁纸':!mode?'播放模式未确认':!ready?'请先在壁纸目录确认所选项':!eligible?'所选壁纸当前不可播放':null):null);
    const presetAllowed=admitted()&&session&&typeof controller.set==='function'&&settings.background==='wallpaper'&&ready&&eligible&&
      !pendingCleanup&&!gate.busy&&!gate.draining&&!gate.unknown&&Number.isSafeInteger(status.generation)&&status.generation>=0&&
      ['mist','abyss'].includes(settings.theme)&&sourceTheme===settings.theme&&
      (['idle','stopped'].includes(state)?!hasActive:state==='playing'&&activeId===selectedId&&[status.activeSceneId,status.host?.activeSceneId].every(id=>id==null||id===selectedId));
    const preset=presetSnapshot(settings,status,{allowed:presetAllowed,selectedId,activeId,state,title:labelFor(selectedId),
      key:presetAllowed?JSON.stringify([current,state,status.generation,filter,Object.entries(settings).sort(([a],[b])=>a.localeCompare(b))]):null});
    // Resolve from all approved metadata, never from the searched/paginated gallery.
    // An uncertain active identity must not borrow the selected wallpaper's picture.
    const activeIdentities=[status.activeSceneId,status.host?.activeSceneId].filter(id=>id!=null);
    const previewId=hasActive?(activeId&&activeIdentities.every(id=>sceneId(id)===activeId)?activeId:null):safeIdle&&!gate.unknown?selectedId:null;
    const objectPreview=['none','wallpaper'].includes(settings.background)&&ready&&previewId?
      galleryRows.find(row=>row.id===previewId&&row.selectable&&row.hasPreview)??null:null;
    return Object.freeze({objectPreview,activeId,title,selectedId,state:labels[state] ? state : 'unknown',selectedTitle:selectedId?labelFor(selectedId):'尚未选择壁纸',
      preset,
      playAction:action,playMode:mode,playGeneration:Number.isSafeInteger(status.generation)?status.generation:null,playLabel,canPlay,playBusy:gate.busy||pendingCleanup||externalStarting,playHint,
      showEnableWallpaper,canEnableWallpaper,enableWallpaperTicket:canEnableWallpaper?sourceEnableEpoch:null,backgroundEnableError:fieldErrors.background,
      showCloseWallpaper:settings.background==='wallpaper'&&!!closeState,canCloseWallpaper,closeWallpaperTicket:canCloseWallpaper?sourceEnableEpoch:null,
      closeWallpaperAction:closeAction,sourceBusy:!!sourceJob,closeWallpaperLabel:sourceJob?.kind==='close'?'正在关闭…':closeAction==='retry'?'重试关闭':closeAction==='inspect'?'检查关闭':'关闭背景',
      showLocalImage,canEditImage,imageInfo,imageTicket:canEditImage?imageEpoch:null,imageBusy:sourceJob?.kind==='image',imageError:fieldErrors.image??null,
      showLocalVideo,canEditVideo,videoInfo,videoTicket:canEditVideo?videoEpoch:null,videoBusy:sourceJob?.kind==='video',videoError:fieldErrors.video??null,
      catalogLoading:catalogState.loading||library?.loading===true||library?.state==='loading',catalogError:!ready?(catalogState.error??(library?.state==='failed'?'壁纸目录读取失败':null)):null,
      galleryOpen,galleryQuery:query,galleryPage:page,galleryCount:matches,galleryPages:Math.max(1,Math.ceil(matches/12)),galleryRows:pageRows,galleryRatings:filter,galleryVersion,selectionError,
      autoStart,autoEligible,canSetMode:optionsEditable,canSetAutoStart:optionsEditable&&autoStart!==null&&(autoStart||autoEligible),
      modeError:fieldErrors.weMode,autoStartError:fieldErrors.weAutoStart,
      authorContext:author&&(!editorGate||editorGate.getSnapshot().nativeAllowed)&&session&&settings.background==='wallpaper'&&selectedId==='lucy'&&activeId==='lucy'&&ready&&eligible&&
        Number.isSafeInteger(status.generation)&&status.generation>=0&&!gate.busy&&!gate.draining&&!gate.unknown&&!pendingCleanup&&['playing','connecting','waiting'].includes(state)?JSON.stringify([current,selectedId,activeId,status.generation,filter]):null,
      statusLabel:labels[state] ?? '状态未知',brightness:validValue('brightness',settings.brightness) ? settings.brightness : null,
      mask:validValue('mask',settings.mask) ? settings.mask : null,
      blur:validValue('blur',settings.blur) ? settings.blur : null,
      surface:validValue('surface',settings.surface) ? settings.surface : null,
      chatBackdrop:validValue('chatBackdrop',settings.chatBackdrop) ? settings.chatBackdrop : null,
      textContrast:['standard','enhanced'].includes(settings.textContrast)?settings.textContrast:null,textContrastError:fieldErrors.textContrast,
      theme:['mist','abyss'].includes(settings.theme)?settings.theme:null,activeTheme:activeTheme(),canSetTheme:canSetTheme(),themeError:fieldErrors.theme,
      palette:validPalette(settings.palette)?settings.palette:null,paletteError:fieldErrors.palette,
      accentMode:['theme','custom'].includes(settings.accentMode)?settings.accentMode:null,
      accentColor:validAccentColor(settings.accentColor)?settings.accentColor.toLowerCase():null,
      accentModeError:fieldErrors.accentMode,accentColorError:fieldErrors.accentColor,
      canRetryAccentColor:accentColorRetry!==null,
      sidebar:['balanced','deep'].includes(settings.sidebar)?settings.sidebar:null,sidebarError:fieldErrors.sidebar,
      canvas:['soft','clear'].includes(settings.canvas)?settings.canvas:null,canvasError:fieldErrors.canvas,
      glass:['standard','restrained'].includes(settings.glass)?settings.glass:null,glassError:fieldErrors.glass,
      videoMotion:['focus','always'].includes(settings.motion)?settings.motion:null,motionError:fieldErrors.motion,
      canSetVideoMotion:settings.background==='video'&&canEditVideo&&typeof controller.set==='function'&&['focus','always'].includes(settings.motion),
      backgroundMode:['none','image','video','wallpaper'].includes(settings.background)?settings.background:null,
      opaqueSidebar:typeof settings.opaqueSidebar==='boolean'?settings.opaqueSidebar:null,opaqueSidebarError:fieldErrors.opaqueSidebar,
      brightnessError:fieldErrors.brightness,maskError:fieldErrors.mask,blurError:fieldErrors.blur,surfaceError:fieldErrors.surface,chatBackdropError:fieldErrors.chatBackdrop,canEdit:typeof controller.set==='function',
      canOpen:session,error:failure});
  }
  function refresh() {
    if (disposed) return;
    if(sourceJob&&!sourceJob.current())sourceJob.abort.abort();
    const next = read();
    author?.setContext(next.authorContext);
    if (snapshot && Object.keys(next).every(key=>Object.is(next[key],snapshot[key]))) return;
    snapshot = next;
    for (const fn of [...listeners]) fn();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    sourceJob?.abort.abort();
    author?.setContext(null);
    for(const view of [...presetViews.values()])view.remove?.();
    catalogRead.dispose();
    previews.dispose();
    presetViews.clear();presetConfirmation=null;
    const errors=[];
    for (const off of releases.splice(0).reverse()) { try { off(); } catch(error) { errors.push(error); } }
    listeners.clear();
    if(!playback)transport.dispose();
    if(errors.length) throw new AggregateError(errors,'native-sidebar-dispose-failed');
  }
  const api = {
    getSnapshot: () => snapshot,
    subscribe(fn) { if(disposed) return ()=>{}; listeners.add(fn); return ()=>listeners.delete(fn); },
    registerView(token,signal){if(disposed)return()=>{};const off=catalogRead.registerView(token,signal),view={visible:false,lease:null};presetViews.set(token,view);let removed=false;
      const remove=()=>{if(removed)return;removed=true;signal?.removeEventListener('abort',remove);off();presetViews.delete(token);sourceEnableKey=null;sourceEnableEpoch++;imageKey=null;imageEpoch++;videoKey=null;videoEpoch++;if(presetConfirmation?.owner===token)presetConfirmation=null;refresh();};
      view.remove=remove;signal?.addEventListener('abort',remove,{once:true});if(signal?.aborted)remove();return remove;},
    viewVisible(token,visible){if(disposed)return;catalogRead.visible(token,visible);const view=presetViews.get(token);if(view){if(view.visible!==(visible===true)){sourceEnableKey=null;sourceEnableEpoch++;imageKey=null;imageEpoch++;videoKey=null;videoEpoch++;}view.visible=visible===true;if(!view.visible){view.lease=null;if(presetConfirmation?.owner===token)presetConfirmation=null;}refresh();}},
    setPresetOpen(token,open){const view=presetViews.get(token);if(disposed||!view)return null;if(open===true&&view.visible&&admitted()){view.lease??=Object.freeze({});return view.lease;}
      view.lease=null;if(presetConfirmation?.owner===token)presetConfirmation=null;refresh();return null;},
    presetAction(op,ticket,token,lease){return actPreset(op,ticket,token,lease,null);},
    confirmPreset(expected,token,lease){if(!expected||expected!==presetConfirmation)return {ok:false,error:'preset-confirmation-stale'};return actPreset(expected.op,expected.ticket,token,lease,expected);},
    cancelPreset(token,lease){if(presetViews.get(token)?.lease===lease&&presetConfirmation?.owner===token){presetConfirmation=null;refresh();}},
    retryCatalog(){if(!disposed&&admitted())catalogRead.ensure();},
    showGallery(open){if(disposed||!admitted())return;galleryOpen=open===true;selectionError=null;if(galleryOpen)catalogRead.ensure();refresh();},
    search(value){if(disposed||!admitted()||typeof value!=='string')return;query=value.slice(0,200);page=0;refresh();},
    changePage(delta){if(disposed||!admitted()||![1,-1].includes(delta))return;page=Math.max(0,page+delta);refresh();},
    setRating(rating,checked){if(disposed||!admitted()||!['Everyone','Questionable','Mature'].includes(rating)||typeof checked!=='boolean')return;
      refresh();const next=new Set(snapshot.galleryRatings.split(',').filter(Boolean));if(checked)next.add(rating);else next.delete(rating);
      try{const value=['Everyone','Questionable','Mature'].filter(value=>next.has(value)).join(',');controller.set('weAgeRatings',value);if(controller.getSettingsSnapshot()?.weAgeRatings!==value)throw Error('rejected');page=0;selectionError=null;}catch{selectionError='暂时无法更改筛选';}refresh();},
    selectWallpaper(id){if(disposed)return {ok:false,error:'disposed'};refresh();
      if(!admitted())return {ok:false,error:'editor-suspended'};
      const row=galleryRows.find(row=>row.id===id);if(!snapshot.canOpen||!galleryOpen||!row?.selectable||typeof controller.set!=='function')return {ok:false,error:'selection-unavailable'};
      try{controller.set('weScene',id);if(controller.getSettingsSnapshot()?.weScene!==id)throw Error('rejected');galleryOpen=false;selectionError=null;refresh();return {ok:true};}
      catch{selectionError='暂时无法选择这张壁纸';refresh();return {ok:false,error:'selection-failed'};}
    },
    enableWallpaper(expectedTicket,token) {
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      refresh();
      if(!snapshot.canEnableWallpaper)return {ok:false,error:'background-enable-unavailable'};
      if(!Number.isSafeInteger(expectedTicket)||expectedTicket!==snapshot.enableWallpaperTicket)return {ok:false,error:'background-enable-stale'};
      return sourceAction('enable',token,options=>controller.enableBackgroundSource(options));
    },
    closeWallpaper(expectedTicket,token) {
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      refresh();
      if(!snapshot.canCloseWallpaper)return {ok:false,error:'background-close-unavailable'};
      if(expectedTicket!==snapshot.closeWallpaperTicket)return {ok:false,error:'background-close-stale'};
      const action=snapshot.closeWallpaperAction;
      return sourceAction('close',token,async options=>{
        const end=performance.now()+options.timeoutMs;
        let result=await controller[action==='prepare'?'prepareBackgroundClose':action==='retry'?'retryBackgroundClose':'inspectBackgroundClose'](options);
        if(!options.isCurrent())return {ok:false,error:'background-close-stale'};
        // One preparation and at most one inspection. Pending never becomes a polling loop.
        if(result.ok&&!result.permit&&action!=='inspect'&&result.snapshot?.state==='pending'&&performance.now()<end)result=await controller.inspectBackgroundClose({...options,timeoutMs:end-performance.now()});
        if(result.ok&&result.permit&&options.isCurrent())return controller.commitBackgroundClose(result.permit);
        return {...result,ok:false,error:result.error??'background-close-pending'};
      });
    },
    imageAction(action,file,ticket,token){return mediaAction('image',action,file,ticket,token);},
    videoAction(action,file,ticket,token){return mediaAction('video',action,file,ticket,token);},
    setPlaybackOption(key,value){
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      if(!(key==='weMode'&&['daily','preview'].includes(value)||key==='weAutoStart'&&typeof value==='boolean'))return {ok:false,error:'invalid-playback-option'};
      refresh();
      if(!(key==='weMode'?snapshot.canSetMode:snapshot.canSetAutoStart)||key==='weAutoStart'&&value&&!snapshot.autoEligible)return {ok:false,error:'playback-option-unavailable'};
      fieldErrors[key]=null;
      try{
        const old=key==='weMode'?snapshot.playMode:snapshot.autoStart;
        if(old!==value)controller.set(key,value);
        if(controller.getSettingsSnapshot()?.[key]!==value)throw Error('rejected');
        refresh();return {ok:true,value};
      }catch{fieldErrors[key]='暂时无法更改，请重试';refresh();return {ok:false,error:'playback-option-failed'};}
    },
    play(action,expectedScene=snapshot.selectedId,expectedMode=snapshot.playMode,expectedActive=snapshot.activeId,expectedGeneration=snapshot.playGeneration) {
      if(disposed)return Promise.resolve({ok:false,error:'disposed'});
      if(!admitted())return Promise.resolve({ok:false,error:'editor-suspended'});
      refresh();
      // Use the rendered action as well as a fresh policy: a stale Start click must never become Stop.
      if(action!==snapshot.playAction||!snapshot.canPlay)return Promise.resolve({ok:false,error:'playback-unavailable'});
      if(action==='start'&&(expectedScene!==snapshot.selectedId||expectedMode!==snapshot.playMode))return Promise.resolve({ok:false,error:'target-drift'});
      if(action==='stop'&&(expectedActive!==snapshot.activeId||expectedGeneration!==snapshot.playGeneration))return Promise.resolve({ok:false,error:'target-drift'});
      const target=snapshot.selectedId,mode=snapshot.playMode;
      return transport.run(action,()=>action==='start'?controller.wallpaper.start(target,mode):controller.wallpaper.stop('user'));
    },
    setTheme(value) {
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      if(!['mist','abyss'].includes(value))return {ok:false,error:'invalid-theme'};
      refresh();
      if(!snapshot.canOpen)return {ok:false,error:'no-session'};
      if(!snapshot.canEdit||!snapshot.canSetTheme||snapshot.theme===null)return {ok:false,error:'appearance-unavailable'};
      fieldErrors.theme=null;
      try{
        if(snapshot.theme!==value)controller.set('theme',value);
        else if(snapshot.activeTheme!==value)ctx.theme.setTheme(themeIds[value]);
        if(controller.getSettingsSnapshot()?.theme!==value||activeTheme()!==value)throw Error('theme-update-unconfirmed');
        refresh();return {ok:true,value};
      }catch{fieldErrors.theme='暂时无法切换主题，请重试';refresh();return {ok:false,error:'theme-update-failed'};}
    },
    setPalette(value) {
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      if(!validPalette(value))return {ok:false,error:'invalid-palette'};
      refresh();
      if(!snapshot.canOpen)return {ok:false,error:'no-session'};
      if(!snapshot.canEdit||snapshot.palette===null||snapshot.theme!=='abyss'||snapshot.activeTheme!=='abyss')return {ok:false,error:'appearance-unavailable'};
      fieldErrors.palette=null;
      try{
        if(snapshot.palette!==value)controller.set('palette',value);
        if(controller.getSettingsSnapshot()?.palette!==value)throw Error('appearance-update-rejected');
        refresh();return {ok:true,value};
      }catch{fieldErrors.palette='暂时无法更改配色，请重试';refresh();return {ok:false,error:'palette-update-failed'};}
    },
    setAccent(key,value) {
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      if(!(key==='accentMode'&&['theme','custom'].includes(value)||key==='accentColor'&&validAccentColor(value)))return {ok:false,error:'invalid-accent-value'};
      refresh();
      if(!snapshot.canOpen)return {ok:false,error:'no-session'};
      if(!snapshot.canEdit||snapshot.accentMode===null||snapshot.accentColor===null||snapshot.theme===null||snapshot.activeTheme!==snapshot.theme||
        key==='accentColor'&&snapshot.accentMode!=='custom')return {ok:false,error:'appearance-unavailable'};
      const normalized=key==='accentColor'?value.toLowerCase():value;
      fieldErrors[key]=null;
      if(key==='accentColor')accentColorRetry=null;
      try{
        if(snapshot[key]!==normalized)controller.set(key,normalized);
        if(controller.getSettingsSnapshot()?.[key]!==normalized)throw Error('appearance-update-rejected');
        refresh();return {ok:true,value:normalized};
      }catch{
        fieldErrors[key]='暂时无法更改强调色，请重试';
        if(key==='accentColor'){
          try{const actual=controller.getSettingsSnapshot();accentColorRetry={value:normalized,actual:actual?.accentColor,mode:actual?.accentMode,theme:actual?.theme,active:activeTheme(),session:right.mounted.getSnapshot()};}catch{accentColorRetry=null;}
        }
        refresh();return {ok:false,error:'accent-update-failed'};
      }
    },
    retryAccentColor(){
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      refresh();
      if(!accentColorRetry)return {ok:false,error:'retry-unavailable'};
      return api.setAccent('accentColor',accentColorRetry.value);
    },
    setSidebarDepth(value) {
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      if(!['balanced','deep'].includes(value))return {ok:false,error:'invalid-sidebar-depth'};
      refresh();
      if(!snapshot.canOpen)return {ok:false,error:'no-session'};
      if(!snapshot.canEdit||snapshot.sidebar===null||snapshot.theme===null||snapshot.activeTheme!==snapshot.theme)return {ok:false,error:'appearance-unavailable'};
      fieldErrors.sidebar=null;
      try{
        if(snapshot.sidebar!==value)controller.set('sidebar',value);
        if(controller.getSettingsSnapshot()?.sidebar!==value)throw Error('appearance-update-rejected');
        refresh();return {ok:true,value};
      }catch{fieldErrors.sidebar='暂时无法更改侧栏层次，请重试';refresh();return {ok:false,error:'sidebar-depth-update-failed'};}
    },
    setCanvasDepth(value) {
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      if(!['soft','clear'].includes(value))return {ok:false,error:'invalid-canvas-depth'};
      refresh();
      if(!snapshot.canOpen)return {ok:false,error:'no-session'};
      if(!snapshot.canEdit||snapshot.canvas===null||snapshot.theme===null||snapshot.activeTheme!==snapshot.theme)return {ok:false,error:'appearance-unavailable'};
      fieldErrors.canvas=null;
      try{
        if(snapshot.canvas!==value)controller.set('canvas',value);
        if(controller.getSettingsSnapshot()?.canvas!==value)throw Error('appearance-update-rejected');
        refresh();return {ok:true,value};
      }catch{fieldErrors.canvas='暂时无法更改背景层次，请重试';refresh();return {ok:false,error:'canvas-depth-update-failed'};}
    },
    setVideoMotion(value) {
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      if(!['focus','always'].includes(value))return {ok:false,error:'invalid-video-motion'};
      refresh();
      if(!snapshot.canOpen)return {ok:false,error:'no-session'};
      if(!snapshot.canSetVideoMotion)return {ok:false,error:'appearance-unavailable'};
      fieldErrors.motion=null;
      try{
        if(snapshot.videoMotion!==value)controller.set('motion',value);
        const actual=controller.getSettingsSnapshot();
        if(actual?.motion!==value||actual.background!=='video')throw Error('appearance-update-rejected');
        refresh();return {ok:true,value};
      }catch{fieldErrors.motion='暂时无法更改播放策略，请重试';refresh();return {ok:false,error:'video-motion-update-failed'};}
    },
    setGlassStrength(value) {
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      if(!['standard','restrained'].includes(value))return {ok:false,error:'invalid-glass-strength'};
      refresh();
      if(!snapshot.canOpen)return {ok:false,error:'no-session'};
      if(!snapshot.canEdit||snapshot.glass===null||snapshot.theme===null||snapshot.activeTheme!==snapshot.theme)return {ok:false,error:'appearance-unavailable'};
      fieldErrors.glass=null;
      try{
        if(snapshot.glass!==value)controller.set('glass',value);
        if(controller.getSettingsSnapshot()?.glass!==value)throw Error('appearance-update-rejected');
        refresh();return {ok:true,value};
      }catch{fieldErrors.glass='暂时无法更改玻璃强度，请重试';refresh();return {ok:false,error:'glass-strength-update-failed'};}
    },
    setOpaqueSidebar(value) {
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      if(typeof value!=='boolean')return {ok:false,error:'invalid-opaque-sidebar'};
      refresh();
      if(!snapshot.canOpen)return {ok:false,error:'no-session'};
      if(!snapshot.canEdit||snapshot.opaqueSidebar===null||snapshot.backgroundMode===null||snapshot.backgroundMode==='none'||
        snapshot.theme===null||snapshot.activeTheme!==snapshot.theme)return {ok:false,error:'appearance-unavailable'};
      fieldErrors.opaqueSidebar=null;
      try{
        if(snapshot.opaqueSidebar!==value)controller.set('opaqueSidebar',value);
        if(controller.getSettingsSnapshot()?.opaqueSidebar!==value)throw Error('appearance-update-rejected');
        refresh();return {ok:true,value};
      }catch{fieldErrors.opaqueSidebar='暂时无法更改左侧栏底色，请重试';refresh();return {ok:false,error:'opaque-sidebar-update-failed'};}
    },
    setTextContrast(value) {
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      if(!['standard','enhanced'].includes(value))return {ok:false,error:'invalid-text-contrast'};
      refresh();
      if(!snapshot.canOpen)return {ok:false,error:'no-session'};
      if(!snapshot.canEdit||snapshot.textContrast===null)return {ok:false,error:'appearance-unavailable'};
      fieldErrors.textContrast=null;
      try{
        if(snapshot.textContrast!==value)controller.set('textContrast',value);
        if(controller.getSettingsSnapshot()?.textContrast!==value)throw Error('appearance-update-rejected');
        refresh();return {ok:true,value};
      }catch{fieldErrors.textContrast='暂时无法调整，请重试';refresh();return {ok:false,error:'appearance-update-failed'};}
    },
    setAppearance(key,value) {
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      if(!validValue(key,value))return {ok:false,error:'invalid-appearance-value'};
      refresh();
      if(!snapshot.canOpen)return {ok:false,error:'no-session'};
      if(!snapshot.canEdit || snapshot[key]===null)return {ok:false,error:'appearance-unavailable'};
      fieldErrors[key]=null;
      try {
        // The existing set() is synchronous: projects CSS/backdrop, persists locally, notifies all views.
        // Read the authoritative snapshot even after an exception; never invent a rollback or saved claim.
        if(snapshot[key]!==value)controller.set(key,value);
        if(controller.getSettingsSnapshot()?.[key]!==value)throw Error('appearance-update-rejected');
        refresh();
        return {ok:true,value};
      } catch {
        fieldErrors[key]='暂时无法调整，请重试';refresh();
        return {ok:false,error:'appearance-update-failed'};
      }
    },
    open() {
      if(disposed) return {ok:false,error:'disposed'};
      if(editorGate){const result=editorGate.prepareNative();if(!result.ok)return result;}
      refresh();
      if(!snapshot.canOpen) {failure='请先打开一个会话';refresh();return {ok:false,error:'no-session'};}
      try { right.openTab(kind); failure=null;catalogRead.ensure();refresh(); return {ok:true}; }
      catch {failure='暂时无法打开外观侧栏';refresh();return {ok:false,error:'open-failed'};}
    },
    dispose,
  };
  function actPreset(op,ticket,token,lease,confirmed) {
    if(disposed)return {ok:false,error:'disposed'};
    if(!admitted())return {ok:false,error:'editor-suspended'};
    refresh();const p=snapshot.preset,view=presetViews.get(token);
    if(!['save','apply','remove'].includes(op)||!view?.visible||!lease||view.lease!==lease||!p?.safe)return {ok:false,error:'preset-unavailable'};
    if(ticket!==p.ticket||!Number.isSafeInteger(ticket))return {ok:false,error:'preset-stale'};
    if(!(op==='save'?p.canSave:op==='apply'?p.canApply:p.canRemove))return {ok:false,error:'preset-unavailable'};
    if(op==='remove'||op==='save'&&p.saved){
      if(!confirmed){presetConfirmation=Object.freeze({op,ticket,owner:token,lease});presetError=null;refresh();return {ok:false,confirm:true};}
      if(confirmed!==presetConfirmation||confirmed.owner!==token||confirmed.lease!==lease)return {ok:false,error:'preset-confirmation-stale'};
    }
    const target=p.target,expected=op==='apply'?p.saved:p.current;
    presetKey=null;presetEpoch++;presetConfirmation=null;presetError=null;
    try{
      const before=controller.getSettingsSnapshot();
      const result=controller.presets[op](target);refresh();
      if(result?.ok!==true){presetError=result?.error==='storage-failed'?'本机存储未能更新':'预设操作未确认，请核对当前状态';refresh();return {ok:false,error:'preset-operation-failed'};}
      const actual=controller.presets.getSnapshot(),actualSettings=controller.getSettingsSnapshot();
      if(result.targetId!==target||snapshot.preset.target!==target||!snapshot.preset.safe||
        (op==='remove'?Object.hasOwn(actual.entries,target):op==='save'?!sameFour(four(actual.entries[target]),expected):!sameFour(four(actualSettings),expected))||
        Object.keys(before).some(key=>!(op==='apply'&&presetFields.includes(key))&&!Object.is(before[key],actualSettings[key])))throw Error('preset-result-unconfirmed');
      return {ok:true,operation:op};
    }catch{refresh();presetError='预设操作未确认，请核对当前状态';refresh();return {ok:false,error:'preset-operation-unknown'};}
  }
  function admitted(){return !editorGate||editorGate.getSnapshot().nativeAllowed;}
  function mediaAction(kind,action,file,ticket,token){
    if(disposed)return {ok:false,error:'disposed'};
    if(!admitted())return {ok:false,error:'editor-suspended'};
    refresh();
    const type=kind==='image'?'Image':'Video';
    if(!snapshot['canEdit'+type]||!['replace','use','remove'].includes(action))return {ok:false,error:kind+'-unavailable'};
    if(ticket!==snapshot[kind+'Ticket'])return {ok:false,error:kind+'-stale'};
    if(action==='replace'&&!file)return {ok:false,error:kind+'-cancelled'};
    return sourceAction(kind,token,options=>controller['editBackground'+type](action,file,options));
  }
  function localMediaError(kind,result){
    const name=kind==='image'?'图片':'视频',error=result?.error;
    if(error===kind+'-remove-storage')return name+'未能移除，请重试';
    if(result?.applied)return '设置已保存，请核对当前状态';
    if(result?.mediaSaved)return name+'已保存，背景尚未启用';
    return ({[kind+'-file-invalid']:kind==='image'?'请选择64MB以内的常见格式图片':'请选择1GB以内的MP4或WebM视频',
      [kind+'-decode']:kind==='image'?'图片无法读取，请换一张':'视频无法读取，请换一个',[kind+'-missing']:'没有已保存的'+name,
      [kind+'-source-active']:'请先停止并关闭壁纸背景',[kind+'-storage']:name+'未能保存，请重试',
      [kind+'-busy']:kind==='image'?'另有图片操作尚未结束':'另有本地背景操作尚未结束'}[error]??name+'更新未确认，请重试');
  }
  function sourceAction(kind,token,work){
    const view=presetViews.get(token);
    if(!view?.visible)return {ok:false,error:'background-view-unavailable'};
    const session=right.mounted.getSnapshot(),theme=activeTheme(),abort=new AbortController();
    const current=()=>!disposed&&!abort.signal.aborted&&admitted()&&right.mounted.getSnapshot()===session&&activeTheme()===theme&&presetViews.get(token)===view&&view.visible;
    if(!current()||sourceJob)return {ok:false,error:'background-view-unavailable'};
    const job={kind,abort,current},field=['image','video'].includes(kind)?kind:'background';sourceJob=job;sourceEnableKey=null;sourceEnableEpoch++;imageKey=null;imageEpoch++;videoKey=null;videoEpoch++;fieldErrors[field]=null;refresh();
    // Source APIs have their own bounded IO; this lane neither retries nor releases early.
    return Promise.resolve().then(()=>current()?work({signal:abort.signal,isCurrent:current,timeoutMs:['image','video'].includes(kind)?6000:3500}):{ok:false,error:'background-view-unavailable'}).then(result=>{
      if(current()&&result?.ok!==true)fieldErrors[field]=['image','video'].includes(kind)?localMediaError(kind,result):
        result?.applied?(result.error==='background-projection-failed'?'设置已保存，显示更新未完成':'设置已保存，请核对当前状态'):
        result?.error==='background-close-pending'?'尚未关闭，请稍后检查':result?.error==='background-storage-conflict'?'设置已变化，请重新打开侧栏':'背景更新未确认，请核对当前状态';
      return result;
    },()=>{if(current())fieldErrors[field]=['image','video'].includes(kind)?localMediaError(kind,null):'背景更新未确认，请核对当前状态';return {ok:false,error:'background-update-failed',value:controller.getSettingsSnapshot()?.background};})
      .finally(()=>{if(sourceJob===job)sourceJob=null;refresh();});
  }
  const h = (type,props,...children)=>React.createElement(type,typeof type==='function'&&children.length?{...props,children}:props,...children);
  // The popover stays in Whale's DOM/theme scope but uses the browser top layer,
  // so the independently scrolling sidebar cannot clip it. One owner per adapter.
  let openChoice=null;
  function Select({presentation='menu',...props}) {
    return presentation==='segments'||presentation==='swatches'?h(Choice,{...props,swatches:presentation==='swatches'}):h(SelectMenu,props);
  }
  function Choice({children=[],onChange,value,disabled,swatches=false,...props}) {
    const root=React.useRef(null),name=React.useId();
    const choices=(Array.isArray(children)?children:[children]).flat(Infinity).filter(Boolean).map(node=>({value:String(node.props.value),label:node.props.children??node.children,disabled:node.props.disabled===true,hint:node.props.title}));
    const context=()=>{const v=api.getSnapshot(),owner=root.current?.closest?.('[data-whale-native-sidebar]');return JSON.stringify([right.mounted.getSnapshot(),v.theme,v.activeTheme,v.canEdit,owner?.dataset.whaleSettingsPage]);};
    const snapshot=api.getSnapshot(),stamp=JSON.stringify([right.mounted.getSnapshot(),snapshot.theme,snapshot.activeTheme,snapshot.canEdit,'interface']);
    const choose=(entry,event)=>{
      if(disabled||entry.disabled||!entry.value||!root.current?.isConnected||!root.current.checkVisibility()||context()!==stamp)return;
      if(!root.current.contains(event.currentTarget)||!event.currentTarget.checked)return;
      onChange?.({currentTarget:event.currentTarget,value:entry.value});
    };
    const swatchColors={ocean:['#0b111d','#8c72f2'],graphite:['#16161a','#7f9cc7'],violet:['#19121f','#b07cf0'],jade:['#0e1d18','#56c79d']};
    return h('div',{...props,ref:root,role:'radiogroup','aria-disabled':disabled===true,'data-whale-choice-segments':swatches?'swatches':'segments'},
      ...choices.filter(entry=>entry.value).map((entry,index)=>{
        const selected=String(value)===entry.value,colors=swatchColors[entry.value],hintId=entry.hint?name+'-hint-'+index:undefined;
        return h('label',{key:entry.value,'data-whale-choice-segment':entry.value,title:entry.hint||(Array.isArray(entry.label)?entry.label.join(''):String(entry.label??''))},
          h('input',{type:'radio',name,value:entry.value,checked:selected,disabled:disabled||entry.disabled,
            'aria-invalid':props['aria-invalid'],'aria-describedby':[props['aria-describedby'],hintId].filter(Boolean).join(' ')||undefined,
            onChange:event=>choose(entry,event),onClick:event=>{if(selected)choose(entry,event);}}),
          h('span',{'data-whale-segment-face':true},
            swatches&&colors?h('span',{'data-whale-palette-swatch':entry.value,'aria-hidden':true,style:{background:`linear-gradient(135deg, ${colors[0]} 0 65%, ${colors[1]} 65% 100%)`}}):null,
            h('span',{'data-whale-segment-text':true},entry.label),h('span',{'data-whale-segment-check':true,'aria-hidden':true},selected?'✓':'')),entry.hint?h('span',{id:hintId,hidden:true},entry.hint):null);
      }),
      !choices.some(entry=>entry.value&&entry.value===String(value))?h('span',{'data-whale-choice-unavailable':true},'暂不可用'):null);
  }
  function SelectMenu({children=[],onChange,value,disabled,choiceScope=null,...props}) {
    const trigger=React.useRef(null),popup=React.useRef(null),session=React.useRef(null),latest=React.useRef(null);
    const [open,setOpen]=React.useState(false),[cursor,setCursor]=React.useState(-1),uid=React.useId();
    const choices=(Array.isArray(children)?children:[children]).flat(Infinity).filter(Boolean).map(node=>({value:String(node.props.value),label:node.props.children??node.children,disabled:node.props.disabled===true}));
    const text=entry=>Array.isArray(entry.label)?entry.label.join(''):String(entry.label??'');
    const signature=JSON.stringify(choices.map(c=>[c.value,text(c),c.disabled]));
    const context=()=>{const v=api.getSnapshot(),owner=trigger.current?.closest?.('[data-whale-native-sidebar]');return JSON.stringify([right.mounted.getSnapshot(),v.activeId,v.selectedId,v.playGeneration,v.theme,v.activeTheme,v.galleryOpen,v.authorContext,v.canEdit,owner?.dataset.whaleSettingsPage,owner?.dataset.whaleGalleryOpen]);};
    latest.current={choices,signature,value:String(value),disabled,context:context(),onChange,scope:choiceScope};
    const close=(focus=false,notify=true)=>{
      session.current=null;if(openChoice?.token===trigger)openChoice=null;
      try{if(popup.current?.matches(':popover-open'))popup.current.hidePopover();}catch{}
      if(notify){setOpen(false);setCursor(-1);}if(focus)trigger.current?.focus();
    };
    const admissible=()=>{
      const node=trigger.current,owner=node?.closest?.('[data-whale-native-sidebar]'),tab=node?.closest?.('[data-tab-id]');
      if(latest.current.disabled||author?.read?.().editing)return false;
      // DOM validity is checked at the actual user gesture, not by an old render.
      if(node?.isConnected===false||owner?.hidden||tab?.hidden)return false;
      if(node?.closest?.('[data-whale-page-panel]')?.hidden)return false;
      try{if(typeof right.focusedTarget==='function'&&right.focusedTarget(node)===undefined)return false;}catch{return false;}
      return true;
    };
    const place=()=>{
      const node=trigger.current,list=popup.current;if(!node?.getBoundingClientRect||!list)return;
      const rect=node.getBoundingClientRect(),win=node.ownerDocument.defaultView,w=win.innerWidth,h=win.innerHeight;
      const width=Math.max(0,Math.min(Math.max(rect.width,180),w-16)),below=Math.max(0,h-rect.bottom-12),above=Math.max(0,rect.top-12);
      const up=below<Math.min(240,list.scrollHeight)&&above>below,space=up?above:below,height=Math.min(240,space);
      Object.assign(list.style,{position:'fixed',inset:'auto',margin:'0',left:Math.max(8,Math.min(rect.left,w-width-8))+'px',width:width+'px',maxHeight:height+'px',top:up?'auto':Math.max(8,rect.bottom+4)+'px',bottom:up?Math.max(8,h-rect.top+4)+'px':'auto'});
    };
    const begin=node=>{
      if(node)trigger.current=node;if(!admissible())return false;
      if(session.current)return true;
      openChoice?.close();const index=choices.findIndex(c=>c.value===String(value)&&!c.disabled);
      session.current={context:context(),signature,scope:choiceScope,index:index>=0?index:choices.findIndex(c=>!c.disabled),prefix:'',at:0};
      openChoice={token:trigger,close:()=>close(false)};setOpen(true);setCursor(session.current.index);
      try{popup.current?.showPopover();}catch{close();return false;}place();return true;
    };
    const choose=index=>{
      const task=session.current,current=latest.current,choice=current.choices[index];
      if(!task||!admissible()||task.context!==context()||task.signature!==current.signature||task.scope!==current.scope||!choice||choice.disabled){close();return;}
      const changed=choice.value!==current.value;close(true);
      if(changed)current.onChange?.({currentTarget:trigger.current,value:choice.value});
    };
    const move=(key)=>{
      const task=session.current;if(!task)return;const usable=latest.current.choices.map((c,i)=>c.disabled?-1:i).filter(i=>i>=0);if(!usable.length)return;
      const at=usable.indexOf(task.index);task.index=key==='Home'?usable[0]:key==='End'?usable.at(-1):usable[(at+(key==='ArrowUp'?-1:1)+usable.length)%usable.length];setCursor(task.index);
      popup.current?.querySelector('[data-whale-choice-value="'+task.index+'"]')?.scrollIntoView?.({block:'nearest'});
    };
    React.useEffect(()=>{if(open&&(!admissible()||session.current?.context!==context()||session.current?.signature!==signature||session.current?.scope!==choiceScope))close();});
    React.useEffect(()=>{
      if(!open)return;const node=trigger.current,list=popup.current,doc=node?.ownerDocument,win=doc?.defaultView;if(!doc||!win)return;
      const outside=e=>{if(!node.contains(e.target)&&!list?.contains(e.target))close();};
      const focus=e=>{if(!node.contains(e.target)&&!list?.contains(e.target))close();};
      const hidden=()=>{if(doc.hidden)close();};const blur=()=>close();
      doc.addEventListener('pointerdown',outside,true);doc.addEventListener('focusin',focus,true);doc.addEventListener('visibilitychange',hidden);
      doc.addEventListener('scroll',place,true);win.addEventListener('resize',place);win.addEventListener('blur',blur);
      const observer=typeof ResizeObserver==='function'?new ResizeObserver(place):null;observer?.observe(node);place();
      return()=>{doc.removeEventListener('pointerdown',outside,true);doc.removeEventListener('focusin',focus,true);doc.removeEventListener('visibilitychange',hidden);doc.removeEventListener('scroll',place,true);win.removeEventListener('resize',place);win.removeEventListener('blur',blur);observer?.disconnect();};
    },[open]);
    React.useEffect(()=>()=>close(false,false),[]);
    const selected=choices.find(c=>c.value===String(value));
    return h('span',{'data-whale-choice-root':true},
      h('button',{...props,ref:trigger,type:'button',role:'combobox','data-whale-choice':true,value:String(value),disabled,
        'aria-expanded':open,'aria-haspopup':'listbox','aria-controls':uid+'-list','aria-activedescendant':open&&cursor>=0?uid+'-'+cursor:undefined,
        onPointerDown:event=>{if(event.button===0)event.preventDefault();},
        onClick:event=>{if(session.current)close();else if(begin(event.currentTarget))event.currentTarget.focus?.();},
        onKeyDown:event=>{
          if(event.isComposing)return;const key=event.key;
          if(['Enter',' ','ArrowDown','ArrowUp','Home','End'].includes(key)){
            event.preventDefault();const wasOpen=!!session.current;if(!begin(event.currentTarget))return;
            if(wasOpen&&(key==='Enter'||key===' '))choose(session.current.index);
            else if(['ArrowDown','ArrowUp','Home','End'].includes(key))move(key);return;
          }
          if(key==='Escape'){if(session.current){event.preventDefault();event.stopPropagation?.();close(true);}return;}
          if(key==='Tab'){close();return;}
          if(key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
            event.preventDefault();if(!begin(event.currentTarget))return;const task=session.current,now=Date.now();task.prefix=now-task.at<700?task.prefix+key:key;task.at=now;
            const index=choices.findIndex(c=>!c.disabled&&text(c).toLocaleLowerCase().startsWith(task.prefix.toLocaleLowerCase()));
            if(index>=0){task.index=index;setCursor(index);popup.current?.querySelector('[data-whale-choice-value="'+index+'"]')?.scrollIntoView?.({block:'nearest'});}
          }
        }},h('span',{'data-whale-choice-label':true},selected?text(selected):'暂不可用'),h('span',{'aria-hidden':true,'data-whale-choice-chevron':true,'data-whale-chevron':'down'})),
      h('div',{ref:popup,popover:'manual',id:uid+'-list',role:'listbox','aria-label':props['aria-label']??props.title??'选择设置','data-whale-choice-list':true},
        ...choices.map((choice,index)=>h('div',{key:choice.value,id:uid+'-'+index,role:'option',tabIndex:-1,
          'data-whale-choice-value':index,'data-value':choice.value,'aria-selected':choice.value===String(value),'aria-disabled':choice.disabled||undefined,
          'data-active':cursor===index?'true':undefined,onPointerDown:e=>e.preventDefault(),onClick:()=>choose(index)},
          h('span',{'aria-hidden':true,'data-whale-choice-check':true},choice.value===String(value)?'✓':''),h('span',null,text(choice))))));
  }

  function LocalMedia({kind,view,token}){
    const type=kind==='image'?'Image':'Video',name=kind==='image'?'图片':'视频';
    const info=view[kind+'Info'],busy=view[kind+'Busy'],error=view[kind+'Error'],enabled=view['canEdit'+type],ticket=view[kind+'Ticket'];
    const action=(op,file,t)=>api[kind+'Action'](op,file,t,token);
    const input=React.useRef(null),choice=React.useRef(null),errorId=React.useId();
    return h('fieldset',{['data-whale-local-'+kind]:true,'aria-busy':busy,style:{border:0,padding:0,margin:'16px 0',minWidth:0}},
      h('legend',{style:{padding:0,fontWeight:600}},'本地'+name),
      info?h('div',{title:info.name,style:{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',margin:'8px 0'}},info.name||'已保存的'+name):null,
      h('input',{ref:input,type:'file',hidden:true,accept:kind==='image'?'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif':'video/mp4,video/webm',disabled:!enabled,['data-whale-'+kind+'-file']:true,
        onChange:event=>{const file=event.currentTarget.files?.[0],ticket=choice.current;event.currentTarget.value='';choice.current=null;if(file&&ticket!==null)void action('replace',file,ticket);},onCancel:()=>{choice.current=null;}}),
      h('div',{'data-whale-local-actions':true},
        h('button',{type:'button',className:'dsw-btn',['data-whale-'+kind+'-choose']:true,disabled:!enabled,'aria-describedby':error?errorId:undefined,
          onClick:()=>{choice.current=ticket;input.current?.click();}},busy?'处理中…':info?'更换'+name:'选择'+name),
        info&&view.backgroundMode==='none'?h('button',{type:'button',className:'dsw-btn',['data-whale-'+kind+'-use']:true,disabled:!enabled,onClick:()=>action('use',null,ticket)},'使用已存'+name):null,
        info||view.backgroundMode===kind?h(ActionMenu,{name:kind,label:'本地'+name+'更多操作',text:'更多',scope:ticket,entries:[{key:'remove',label:'移除'+name,disabled:!enabled,danger:true,attributes:{['data-whale-'+kind+'-remove']:true},action:()=>action('remove',null,ticket)}]}):null),
      kind==='video'&&view.backgroundMode==='video'?h(Fold,{name:'video-playback',title:'播放选项',error:view.motionError},h(VideoMotionControl,{view})):null,
      error?h('span',{id:errorId,['data-whale-'+kind+'-error']:true,role:'alert'},error):null);
  }
  function Preview({row,visible,version}) {
    const [near,setNear]=React.useState(false),[resource,setResource]=React.useState(null),[failed,setFailed]=React.useState(false);
    const element=React.useRef(null),owned=React.useRef(null);
    React.useEffect(()=>{if(!visible)return;if(typeof IntersectionObserver!=='function'){setNear(true);return;}
      const observer=new IntersectionObserver(entries=>setNear(entries.some(entry=>entry.isIntersecting)),{rootMargin:'64px'});
      if(element.current)observer.observe(element.current);return()=>observer.disconnect();},[visible]);
    React.useEffect(()=>{setResource(null);setFailed(false);if(!visible||!near||!row.hasPreview)return;
      let live=true,created=null;const abort=new AbortController();
      previews.request(row.id,{signal:abort.signal}).then(blob=>{if(!live)return;created={url:URL.createObjectURL(blob),rowId:row.id,version};owned.current=created;setResource(created);},()=>{if(live)setFailed(true);});
      return()=>{live=false;abort.abort();if(created&&owned.current===created){owned.current=null;URL.revokeObjectURL(created.url);}};
    },[row.id,row.hasPreview,visible,near,version]);
    // Withdraw stale DOM consumers during render, before passive effect cleanup frees
    // their URL. React may batch a preview response with a viewport/visibility change.
    const current=visible&&near&&row.hasPreview&&!failed&&resource&&owned.current===resource&&resource.rowId===row.id&&resource.version===version;
    return h('div',{ref:element,style:{aspectRatio:'16 / 9',overflow:'hidden',display:'grid',placeItems:'center',background:'var(--dsw-alias-bg-layer-2)'}},
      current?h('img',{key:resource.url,src:resource.url,alt:'',style:{width:'100%',height:'100%',objectFit:'cover'},onError:event=>{
        if(owned.current!==resource)return;
        event?.currentTarget?.removeAttribute('src');owned.current=null;URL.revokeObjectURL(resource.url);setFailed(true);
      }}):h('span',{style:{fontSize:'12px',opacity:0.65}},'无预览'));
  }
  function Gallery({view,visible}) {
    const uid=React.useId();
    return h('div',{'data-whale-gallery':true,style:{minWidth:0,display:'grid',gap:'12px'}},
      h('input',{type:'search','aria-label':'搜索壁纸',placeholder:'搜索壁纸',maxLength:200,value:view.galleryQuery,style:{width:'100%',minWidth:0,boxSizing:'border-box'},onChange:event=>api.search(event.currentTarget.value)}),
      h('fieldset',{style:{display:'flex',flexWrap:'wrap',gap:'12px',padding:0,margin:0,border:0},'aria-label':'年龄分级'},
        ...[['Everyone','全年龄'],['Questionable','敏感'],['Mature','成人']].map(([rating,label])=>h('label',{key:rating,title:rating,style:{display:'flex',alignItems:'center',gap:'4px'}},
          h('input',{type:'checkbox','data-whale-rating':rating,checked:view.galleryRatings.split(',').includes(rating),onChange:event=>api.setRating(rating,event.currentTarget.checked)}),label))),
      view.selectionError?h('p',{role:'alert'},view.selectionError):null,
      view.catalogLoading?h('span',{role:'status'},'正在读取壁纸目录…'):null,
      h('span',{'data-whale-gallery-count':true,role:'status'},`${view.galleryCount} 张`),
      h('div',{'data-whale-gallery-grid':true},
        ...view.galleryRows.map((row,index)=>{
          const selected=view.selectedId===row.id,playing=view.state==='playing'&&!view.playBusy&&view.activeId===row.id;
          const type={scene:'场景',video:'视频',web:'网页',unknown:'暂不可用'}[row.type],description=uid+'-item-'+index;
          return h('button',{key:row.id,type:'button','data-whale-gallery-item':row.id,'aria-pressed':selected,'aria-label':row.title,'aria-describedby':description,disabled:!row.selectable,
            title:row.title,className:'dsw-btn',onClick:()=>api.selectWallpaper(row.id)},
            h('div',{'data-whale-gallery-thumbnail':true},
              h(Preview,{key:row.id+':'+view.galleryVersion,row,visible,version:view.galleryVersion}),
              h('span',{'data-whale-gallery-type':true,'aria-hidden':true},type),
              playing?h('span',{'data-whale-gallery-playing':true,'aria-hidden':true,title:'正在播放'},'▶'):null),
            h('span',{'data-whale-gallery-caption':true},h('span',{'data-whale-gallery-title':true},row.title),
              selected?h('span',{'data-whale-gallery-selected':true,'aria-hidden':true,title:'已选中'},'✓'):null),
            h('span',{id:description,hidden:true},[type,!row.selectable?'当前不可选择':null,selected?'已选中':null,playing?'正在播放':null].filter(Boolean).join('，')));
        })),
      !view.galleryRows.length&&!view.catalogLoading&&!view.catalogError?h('p',{role:'status'},!view.galleryRatings?'请选择至少一个分级':view.galleryQuery?'没有匹配的壁纸':'此分级下暂无壁纸'):null,
      view.galleryPages>1?h('nav',{'data-whale-gallery-pagination':true,'aria-label':'壁纸分页'},
        h('button',{type:'button',className:'dsw-btn','aria-label':'上一页',title:'上一页',disabled:view.galleryPage===0,onClick:()=>api.changePage(-1)},h('span',{'data-whale-chevron':'left','aria-hidden':true})),
        h('output',{'aria-label':'图库页码'},`${view.galleryPage+1} / ${view.galleryPages}`),h('button',{type:'button',className:'dsw-btn','aria-label':'下一页',title:'下一页',disabled:view.galleryPage+1>=view.galleryPages,onClick:()=>api.changePage(1)},h('span',{'data-whale-chevron':'right','aria-hidden':true}))):null);
  }
  function RangeControl({setting,label,hint,value,view}) {
    const id=React.useId();
    const unit=setting==='blur'?'px':'%';
    const error=view[setting+'Error'];
    const disabled=!view.canOpen || !view.canEdit || value===null;
    return h('div',{'data-whale-appearance-field':setting,style:{display:'grid',gap:'8px',minWidth:0}},
      h('div',{style:{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:'12px'}},
        h('label',{htmlFor:id,title:hint},label),
        h('output',{htmlFor:id,style:{fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'}},value===null?'—':`${value}${unit}`)),
      h('input',{id,type:'range',min:ranges[setting][0],max:ranges[setting][1],step:1,value:value??ranges[setting][0],disabled,
        'data-whale-appearance-range':setting,'aria-valuetext':value===null?'暂不可用':`${value}${unit}`,'aria-invalid':error?true:undefined,
        'aria-describedby':error?id+'-error':undefined,title:hint,
        style:{width:'100%',minWidth:0,minHeight:'24px',margin:0,accentColor:'var(--dsw-alias-brand-primary, #8c72f2)',opacity:disabled?0.5:1},
        onChange:event=>api.setAppearance(setting,event.currentTarget.valueAsNumber)}),
      error?h('span',{id:id+'-error',role:'alert'},error):null);
  }
  function ThemeControl({view}) {
    const id=React.useId(),disabled=!view.canOpen||!view.canEdit||!view.canSetTheme||view.theme===null;
    return h('div',{'data-whale-interface-theme':true,style:{display:'grid',gap:'8px',minWidth:0}},
      h('span',{id:id+'-label'},'主题'),
      h(Select,{id,presentation:'segments','aria-labelledby':id+'-label','data-whale-interface-option':'theme',value:view.theme??'',disabled,title:'切换鲸系主题，保留其它外观设置',
        'aria-invalid':view.themeError?true:undefined,'aria-describedby':view.themeError?id+'-error':undefined,
        style:{width:'100%',maxWidth:'100%',minWidth:0,boxSizing:'border-box',font:'inherit',opacity:disabled?0.5:1},
        onChange:event=>api.setTheme(event.value)},
        view.theme===null?h('option',{value:'',disabled:true},'暂不可用'):null,
        h('option',{value:'mist'},'鲸雾'),h('option',{value:'abyss'},'鲸渊')),
      view.themeError?h('span',{id:id+'-error',role:'alert'},view.themeError):null);
  }
  function PaletteControl({view}) {
    const id=React.useId();
    if(view.theme!=='abyss')return null;
    const disabled=!view.canOpen||!view.canEdit||view.activeTheme!=='abyss'||view.palette===null;
    return h('div',{'data-whale-interface-palette':true,style:{display:'grid',gap:'8px',minWidth:0}},
      h('span',{id:id+'-label'},'深色配色'),
      h(Select,{id,presentation:'swatches','aria-labelledby':id+'-label','data-whale-interface-option':'palette',value:view.palette??'',disabled,
        title:'鲸渊的主题底色；跟随主题时同时决定强调色',
        'aria-invalid':view.paletteError?true:undefined,'aria-describedby':view.paletteError?id+'-error':undefined,
        style:{width:'100%',maxWidth:'100%',minWidth:0,boxSizing:'border-box',font:'inherit',opacity:disabled?0.5:1},
        onChange:event=>api.setPalette(event.value)},
        view.palette===null?h('option',{value:'',disabled:true},'暂不可用'):null,
        ...paletteOptions.map(([value,label])=>h('option',{key:value,value},label))),
      view.paletteError?h('span',{id:id+'-error',role:'alert'},view.paletteError):null);
  }
  function AccentControl({view}) {
    const id=React.useId(),colorId=id+'-color';
    const disabled=!view.canOpen||!view.canEdit||view.accentMode===null||view.accentColor===null||view.theme===null||view.activeTheme!==view.theme;
    return h('div',{'data-whale-interface-accent':true,style:{display:'grid',gap:'8px',minWidth:0}},
      h('span',{id:id+'-label'},'强调色'),
      h(Select,{id,presentation:'segments','aria-labelledby':id+'-label','data-whale-interface-option':'accentMode',value:view.accentMode??'',disabled,
        title:'跟随主题配色，或自定义交互元素的强调色',
        'aria-invalid':view.accentModeError?true:undefined,'aria-describedby':view.accentModeError?id+'-error':undefined,
        style:{width:'100%',maxWidth:'100%',minWidth:0,boxSizing:'border-box',font:'inherit',opacity:disabled?0.5:1},
        onChange:event=>api.setAccent('accentMode',event.value)},
        view.accentMode===null?h('option',{value:'',disabled:true},'暂不可用'):null,
        h('option',{value:'theme'},'跟随主题'),h('option',{value:'custom'},'自定义')),
      view.accentModeError?h('span',{id:id+'-error',role:'alert'},view.accentModeError):null,
      view.accentMode==='custom'?h('div',{style:{display:'grid',gap:'8px',minWidth:0}},
        h('label',{htmlFor:view.accentColor===null?undefined:colorId},'自定义颜色'),
        view.accentColor===null?h('span',{'data-whale-accent-unavailable':true},'暂不可用'):
          h('div',{style:{display:'flex',alignItems:'center',gap:'12px',minWidth:0}},
            h('input',{id:colorId,type:'color','data-whale-interface-color':'accentColor',value:view.accentColor,disabled,
              'aria-invalid':view.accentColorError?true:undefined,'aria-describedby':view.accentColorError?colorId+'-error':undefined,
              style:{width:'44px',height:'32px',padding:'2px',border:'1px solid var(--dsw-alias-border-default, currentColor)',borderRadius:'4px',background:'transparent',opacity:disabled?0.5:1},
              onChange:event=>api.setAccent('accentColor',event.currentTarget.value)}),
            h('output',{htmlFor:colorId,'data-whale-accent-hex':true,style:{fontVariantNumeric:'tabular-nums'}},view.accentColor)),
        view.accentColorError?h('div',{style:{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}},
          h('span',{id:colorId+'-error',role:'alert'},view.accentColorError),
          view.canRetryAccentColor?h('button',{type:'button',className:'dsw-btn','data-whale-accent-retry':true,disabled,onClick:()=>api.retryAccentColor()},'重试'):null):null):null);
  }
  function SidebarDepthControl({view}) {
    const id=React.useId(),disabled=!view.canOpen||!view.canEdit||view.sidebar===null||view.theme===null||view.activeTheme!==view.theme;
    return h('div',{'data-whale-interface-sidebar':true,style:{display:'grid',gap:'8px',minWidth:0}},
      h('span',{id:id+'-label'},'侧栏层次'),
      h(Select,{id,presentation:'segments','aria-labelledby':id+'-label','data-whale-interface-option':'sidebar',value:view.sidebar??'',disabled,title:'只改变侧栏与会话区的明度关系',
        'aria-invalid':view.sidebarError?true:undefined,'aria-describedby':view.sidebarError?id+'-error':undefined,
        style:{width:'100%',maxWidth:'100%',minWidth:0,boxSizing:'border-box',font:'inherit',opacity:disabled?0.5:1},
        onChange:event=>api.setSidebarDepth(event.value)},
        view.sidebar===null?h('option',{value:'',disabled:true},'暂不可用'):null,
        h('option',{value:'balanced',title:'保持侧栏与会话区接近的明度'},'均衡'),h('option',{value:'deep',title:'加深侧栏底色，与会话区拉开层次'},'加深')),
      view.sidebarError?h('span',{id:id+'-error',role:'alert'},view.sidebarError):null);
  }
  function CanvasDepthControl({view}) {
    const id=React.useId(),disabled=!view.canOpen||!view.canEdit||view.canvas===null||view.theme===null||view.activeTheme!==view.theme;
    return h('div',{'data-whale-interface-canvas':true,style:{display:'grid',gap:'8px',minWidth:0}},
      h('span',{id:id+'-label'},'背景层次'),
      h(Select,{id,presentation:'segments','aria-labelledby':id+'-label','data-whale-interface-option':'canvas',value:view.canvas??'',disabled,title:'控制主画布的雾感与边界清晰度',
        'aria-invalid':view.canvasError?true:undefined,'aria-describedby':view.canvasError?id+'-error':undefined,
        style:{width:'100%',maxWidth:'100%',minWidth:0,boxSizing:'border-box',font:'inherit',opacity:disabled?0.5:1},
        onChange:event=>api.setCanvasDepth(event.value)},
        view.canvas===null?h('option',{value:'',disabled:true},'暂不可用'):null,
        h('option',{value:'soft',title:'主画布保留柔和的雾感'},'柔雾'),h('option',{value:'clear',title:'主画布使用更明确的底色层次'},'清晰')),
      view.canvasError?h('span',{id:id+'-error',role:'alert'},view.canvasError):null);
  }
  function VideoMotionControl({view}) {
    const id=React.useId(),disabled=!view.canSetVideoMotion;
    return h('div',{'data-whale-video-motion':true,style:{display:'grid',gap:'8px',minWidth:0,marginTop:'12px'}},
      h('label',{htmlFor:id},'播放策略'),
      h(Select,{id,'data-whale-video-option':'motion',value:view.videoMotion??'',disabled,
        title:'仅控制本地视频；页面隐藏或系统要求减少动态时仍暂停',
        'aria-invalid':view.motionError?true:undefined,'aria-describedby':view.motionError?id+'-error':undefined,
        style:{width:'100%',maxWidth:'100%',minWidth:0,boxSizing:'border-box',font:'inherit',opacity:disabled?0.5:1},
        onChange:event=>api.setVideoMotion(event.value)},
        view.videoMotion===null?h('option',{value:'',disabled:true},'暂不可用'):null,
        h('option',{value:'focus'},'失焦暂停'),h('option',{value:'always'},'始终播放')),
      view.motionError?h('span',{id:id+'-error','data-whale-video-motion-error':true,role:'alert'},view.motionError):null);
  }
  function GlassControl({view}) {
    const id=React.useId(),disabled=!view.canOpen||!view.canEdit||view.glass===null||view.theme===null||view.activeTheme!==view.theme;
    return h('div',{'data-whale-interface-glass':true,style:{display:'grid',gap:'8px',minWidth:0}},
      h('span',{id:id+'-label'},'玻璃强度'),
      h(Select,{id,presentation:'segments','aria-labelledby':id+'-label','data-whale-interface-option':'glass',value:view.glass??'',disabled,title:'影响浮层和菜单，不影响输入卡片',
        'aria-invalid':view.glassError?true:undefined,'aria-describedby':view.glassError?id+'-error':undefined,
        style:{width:'100%',maxWidth:'100%',minWidth:0,boxSizing:'border-box',font:'inherit',opacity:disabled?0.5:1},
        onChange:event=>api.setGlassStrength(event.value)},
        view.glass===null?h('option',{value:'',disabled:true},'暂不可用'):null,
        h('option',{value:'standard',title:'保留浮层和菜单的玻璃感'},'标准'),h('option',{value:'restrained',title:'浮层和菜单更接近实色，不改变输入卡片'},'偏实色')),
      view.glassError?h('span',{id:id+'-error',role:'alert'},view.glassError):null);
  }
  function OpaqueSidebarControl({view}) {
    const id=React.useId();
    if(view.backgroundMode==='none')return null;
    const disabled=!view.canOpen||!view.canEdit||view.opaqueSidebar===null||view.backgroundMode===null||view.theme===null||view.activeTheme!==view.theme;
    return h('div',{'data-whale-interface-opaque-sidebar':true,style:{display:'grid',gap:'8px',minWidth:0}},
      h('label',{htmlFor:id,title:'勾选后左侧项目／会话栏使用主题实色；关闭后沿用界面不透明度',style:{display:'flex',alignItems:'flex-start',gap:'8px',minWidth:0}},
        h('input',{id,type:'checkbox','data-whale-interface-toggle':'opaqueSidebar',checked:view.opaqueSidebar===true,disabled,
          ref:node=>{if(node)node.indeterminate=view.opaqueSidebar===null;},'aria-checked':view.opaqueSidebar===null?'mixed':view.opaqueSidebar,
          'aria-invalid':view.opaqueSidebarError?true:undefined,'aria-describedby':view.opaqueSidebarError?id+'-error':undefined,
          style:{marginTop:'3px',flexShrink:0,accentColor:'var(--dsw-alias-brand-primary, #8c72f2)'},
          onChange:event=>api.setOpaqueSidebar(event.currentTarget.checked)}),
        h('span',null,'左侧项目／会话栏不透明底色')),
      view.opaqueSidebar===null||view.backgroundMode===null?h('span',null,'暂不可用'):null,
      view.opaqueSidebarError?h('span',{id:id+'-error',role:'alert'},view.opaqueSidebarError):null);
  }
  function ReadabilityControl({view}) {
    const id=React.useId(),disabled=!view.canOpen||!view.canEdit||view.textContrast===null;
    return h('div',{'data-whale-interface-readability':true,style:{display:'grid',gap:'8px',minWidth:0}},
      h('span',{id:id+'-label'},'文字可读性'),
      h(Select,{id,presentation:'segments','aria-labelledby':id+'-label','data-whale-interface-option':'textContrast',value:view.textContrast??'',disabled,
        title:view.textContrast==='enhanced'?'增强正文和普通说明，不改变状态含义':'保持主题原有文字，跟随系统高对比度',
        'aria-invalid':view.textContrastError?true:undefined,'aria-describedby':view.textContrastError?id+'-error':undefined,
        style:{width:'100%',maxWidth:'100%',minWidth:0,boxSizing:'border-box',font:'inherit',opacity:disabled?0.5:1},
        onChange:event=>api.setTextContrast(event.value)},
        view.textContrast===null?h('option',{value:'',disabled:true},'暂不可用'):null,
        h('option',{value:'standard'},'标准'),h('option',{value:'enhanced'},'增强')),
      view.textContrastError?h('span',{id:id+'-error',role:'alert'},view.textContrastError):null);
  }
  function PresetControl({view,token,visible}) {return view.preset?.available?h(PresetEditor,{view,token,visible}):null;}
  function PresetEditor({view,token,visible}) {
    const [done,setDone]=React.useState(null),lease=React.useRef(null),primary=React.useRef(null),returnFocus=React.useRef(false),id=React.useId(),p=view.preset;
    React.useEffect(()=>{if(!visible){lease.current=null;api.setPresetOpen(token,false);}return()=>{lease.current=null;api.setPresetOpen(token,false);};},[token,visible]);
    React.useEffect(()=>{if(!visible){setDone(null);return;}if(!done)return;const timer=setTimeout(()=>setDone(null),1200);return()=>clearTimeout(timer);},[done,visible]);
    const complete=res=>{if(res.ok)setDone({ticket:api.getSnapshot().preset.ticket,operation:res.operation});return res;};
    const confirmation=p.confirmation?.owner===token&&p.confirmation.lease===lease.current?p.confirmation:null;
    React.useEffect(()=>{if(returnFocus.current&&!confirmation){returnFocus.current=false;primary.current?.focus();}},[confirmation]);
    // A visible row alone grants no action. Acquire the existing view lease only at an explicit gesture.
    const action=op=>{lease.current=api.setPresetOpen(token,visible);return complete(api.presetAction(op,p.ticket,token,lease.current));};
    const gesture=event=>visible&&event.currentTarget?.isConnected!==false&&authorViewCurrent(event.currentTarget)&&!author.read().editing;
    const keepEditor=event=>{if(event.button===0)event.preventDefault();};
    const cancel=()=>{returnFocus.current=true;api.cancelPreset(token,lease.current);};
    const operation=p.saved?'apply':'save',enabled=p.saved?p.canApply:p.canSave;
    return h('section',{'data-whale-presets':true,'aria-label':'此壁纸预设',onKeyDown:event=>{if(event.key==='Escape'&&confirmation){event.preventDefault();event.stopPropagation();cancel();}}},
      h('div',{'data-whale-preset-row':true},
        h('span',{'data-whale-preset-label':true},'此壁纸预设'),
        h('span',{'data-whale-preset-state':true},p.safe?(p.saved?(p.matching?'已保存':'有改动'):'未保存'):'暂不可用'),
        h('span',{'data-whale-preset-feedback':true,role:'status'},done?.ticket===p.ticket?h('span',{'aria-label':done.operation==='save'?'预设已保存':done.operation==='remove'?'预设已删除':'当前外观已恢复'},'✓'):null),
        h('button',{ref:primary,type:'button',className:'dsw-btn','data-whale-preset-action':operation,disabled:!enabled||!!confirmation,
          'aria-label':p.saved?'恢复此壁纸预设':'保存此壁纸预设','aria-describedby':id+'-scope'+(p.error?' '+id+'-error':''),
          onPointerDown:keepEditor,onClick:event=>{if(gesture(event))action(operation);}},p.saved?'恢复':'保存'),
        p.saved?h(ActionMenu,{name:'preset',label:'更多预设操作',scope:p.ticket,entries:[
          {key:'save',label:'更新预设…',disabled:!p.canSave||!!confirmation,attributes:{'data-whale-preset-action':'save'},action:()=>action('save')},
          {key:'remove',label:'删除预设…',disabled:!p.canRemove||!!confirmation,danger:true,attributes:{'data-whale-preset-action':'remove'},action:()=>action('remove')}]}):null),
      h('span',{id:id+'-scope','data-whale-preset-scope':true},'保存：亮度、遮罩、模糊、界面不透明度'),
      !p.safe?h('span',{role:'status','data-whale-preset-unavailable':true},p.reason):null,
      confirmation?h('div',{'data-whale-preset-confirm':confirmation.op,role:'group','aria-label':confirmation.op==='remove'?'确认删除预设':'确认覆盖预设'},
        h('p',null,confirmation.op==='remove'?`删除“${p.title}”的预设？`:`用当前四项覆盖“${p.title}”的预设？`),
        confirmation.op==='save'?h('dl',{'data-whale-preset-values':true,'aria-label':'将保存的四项'},
          ...[['brightness','亮度','%'],['mask','遮罩','%'],['blur','背景模糊','px'],['surface','界面不透明度','%']].flatMap(([key,label,unit])=>[
            h('dt',{key:key+'-label'},label),h('dd',{key},`${p.current[key]}${unit}`)])):null,
        h('div',{'data-whale-preset-confirm-actions':true},
          h('button',{type:'button',className:'dsw-btn','data-whale-preset-confirm-yes':true,onPointerDown:keepEditor,onClick:event=>{if(gesture(event)){returnFocus.current=true;complete(api.confirmPreset(confirmation,token,lease.current));}}},confirmation.op==='remove'?'确认删除':'确认覆盖'),
          h('button',{type:'button',className:'dsw-btn','data-whale-preset-cancel':true,onPointerDown:keepEditor,onClick:cancel},'取消'))):null,
      p.error?h('span',{id:id+'-error',role:'alert','data-whale-preset-error':true},p.error):null);
  }
  function PlaybackOptions({view}) {
    const id=React.useId(),node=React.useRef(null),error=view.modeError||view.autoStartError;
    React.useEffect(()=>{if(error&&node.current)node.current.open=true;},[error]);
    return h('details',{ref:node,'data-whale-playback-options':true,style:{marginTop:'16px',minWidth:0}},
      h('summary',{style:{cursor:'pointer'}},'播放选项',error?h('span',{'data-whale-group-error':true,'aria-label':'此组有问题'},' !'):null),
      h('div',{style:{display:'grid',gap:'12px',marginTop:'12px',minWidth:0}},
        h('div',{style:{display:'grid',gap:'6px',minWidth:0}},
          h('label',{htmlFor:id+'-mode'},'播放模式'),
          h(Select,{id:id+'-mode','data-whale-playback-option':'weMode',value:view.playMode??'',disabled:!view.canSetMode,
            title:'对下次播放生效',style:{width:'100%',minWidth:0,boxSizing:'border-box',font:'inherit',opacity:view.canSetMode?1:0.5},
            'aria-invalid':view.modeError?true:undefined,'aria-describedby':view.modeError?id+'-mode-error':undefined,
            onChange:event=>api.setPlaybackOption('weMode',event.value)},
            view.playMode===null?h('option',{value:'',disabled:true},'请选择模式'):null,
            h('option',{value:'daily'},'日常（持续播放）'),h('option',{value:'preview'},'预览（限时）')),
          view.modeError?h('span',{id:id+'-mode-error',role:'alert'},view.modeError):null),
        h('div',{style:{display:'grid',gap:'6px',minWidth:0}},
          h('label',{htmlFor:id+'-auto',style:{display:'flex',alignItems:'center',gap:'8px'}},
            h('input',{id:id+'-auto',type:'checkbox','data-whale-playback-option':'weAutoStart',checked:view.autoStart===true,disabled:!view.canSetAutoStart,
              'aria-invalid':view.autoStartError?true:undefined,'aria-describedby':id+'-auto-hint'+(view.autoStartError?' '+id+'-auto-error':''),
              style:{accentColor:'var(--dsw-alias-brand-primary, #8c72f2)'},onChange:event=>api.setPlaybackOption('weAutoStart',event.currentTarget.checked)}),'随DSH启动自动播放'),
          h('span',{id:id+'-auto-hint',style:{fontSize:'12px',opacity:0.7}},view.autoStart===null?'自动播放设置未确认':'仅Lucy的日常模式可自动播放'),
          view.autoStartError?h('span',{id:id+'-auto-error',role:'alert'},view.autoStartError):null)));
  }
  // Host focus continuity may blur an input before React delivers tab.visible=false.
  // Read the live SDK target from that input instead of committing a stale render's blur.
  function authorViewCurrent(node){try{
    const owner=node?.closest?.('[data-whale-native-sidebar]');
    if(owner&&(owner.dataset.whaleSettingsPage!=='wallpaper'||owner.dataset.whaleGalleryOpen==='true'))return false;
    return typeof right.focusedTarget==='function'&&right.focusedTarget(node)!==undefined;
  }catch{return false;}}
  function authorLabel(field) {
    const names={'粒子/Particles':'粒子','光照/illumination':'光照','水袋/Water bag':'水袋','开场动画Opening animation':'开场动画','开关/Switch':'开关','关闭作者营销词 Hide marketing words':'隐藏作者营销文字'};
    if(Object.hasOwn(names,field.label))return names[field.label];
    if(/^ui_[A-Za-z0-9_]+$/.test(field.label))return '未命名设置 '+(author.read().fields.findIndex(item=>item.key===field.key)+1);
    return field.label;
  }
  function InfoPopover({name,label,scope=null,attributes={},children}) {
    return h(ActionMenu,{name,label,scope,attributes,disabled:author.read().editing,description:children,
      text:h('svg',{'data-whale-info-icon':true,'aria-hidden':true,viewBox:'0 0 16 16'},
        h('circle',{cx:8,cy:8,r:6,fill:'none',stroke:'currentColor'}),h('path',{d:'M8 7v5M8 4v1',fill:'none',stroke:'currentColor',strokeWidth:1.5}))});
  }
  function AuthorName({field,htmlFor}) {
    const label=authorLabel(field);
    return h('span',{'data-whale-author-name':field.key},
      h('label',{htmlFor,title:field.label,style:{overflowWrap:'anywhere'}},label),
      label!==field.label?h(InfoPopover,{name:'author-original-'+field.key,label:label+'：查看原始名称',scope:field.label},
        h('p',null,'原始名称'),h('p',{'data-whale-author-original':field.key},field.label)):null);
  }
  function AuthorFeedback({field,mark,id}) {
    const status={busy:['…','正在处理修改'],sent:['✓','下发已确认，效果请观察'],
      error:['!','修改未完成，请查看本组提示'],unknown:['?','本轮修改结果未确认']}[mark];
    const label=status?.[1]??'显示作者默认值或本机记录，未读取壁纸实际值';
    return h('span',{id,'data-whale-author-feedback':field.key,'data-state':status?mark:'record',title:label},
      h('span',{'aria-hidden':true},status?.[0]??''),h('span',{'data-whale-author-feedback-text':true},label));
  }
  function AuthorSlider({field,state,view,visible,signal,id,colorChannel=null,feedbackId=id+'-feedback'}) {
    const owner=React.useRef(Symbol('author-slider')).current,interaction=React.useRef(null),node=React.useRef(null),numberEditor=React.useRef(null);
    const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'];
    function finish(commit){commit=commit&&authorViewCurrent(node.current);const item=interaction.current;interaction.current=null;if(!item)return;
      if(commit)void author.editEnd(item.ticket);else author.editCancel(item.ticket);
      if(item.pointerId!==undefined&&node.current?.hasPointerCapture?.(item.pointerId))node.current.releasePointerCapture(item.pointerId);}
    function begin(mode,pointerId){if(interaction.current&&!author.editCurrent(interaction.current.ticket))finish(false);if(interaction.current)return mode==='keyboard'&&interaction.current.mode===mode;
      if(colorChannel===null&&authorViewCurrent(node.current))void numberEditor.current?.complete('blur');
      const ticket=author.editStart(field.key,owner,view);if(!ticket)return false;interaction.current={ticket,mode,pointerId};return true;}
    React.useEffect(()=>{const cancel=()=>finish(false);globalThis.addEventListener('blur',cancel);signal?.addEventListener('abort',cancel,{once:true});
      return()=>{globalThis.removeEventListener('blur',cancel);signal?.removeEventListener('abort',cancel);cancel();};},[view,signal]);
    React.useEffect(()=>{if(!visible||!state.canEdit)finish(false);},[visible,state.canEdit]);
    const mark=state.marks[field.key],isColor=colorChannel!==null;
    const value=isColor?Math.round(nativeAuthorColor(state.values[field.key]).rgb[colorChannel]*255):state.values[field.key];
    return h('div',{'data-whale-author-slider':field.key,style:{display:'grid',gap:'6px',minWidth:0}},
      h('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',minWidth:0}},
        h(AuthorName,{field,htmlFor:id}),
        h('div',{style:{display:'flex',gap:'6px',alignItems:'center',minWidth:0}},
          !isColor?h(AuthorFeedback,{field,mark,id:feedbackId}):null,
          isColor?h('output',{htmlFor:id,style:{overflowWrap:'anywhere'}},String(value)):h(AuthorNumber,{field,state,view,visible,signal,id:id+'-number',editorRef:numberEditor,feedbackId}))),
      h('input',{id,ref:node,type:'range',min:isColor?0:field.rangeMin,max:isColor?255:field.rangeMax,step:isColor?1:field.rangeStep,value,disabled:!state.canEdit,
        'data-whale-author-key':isColor?undefined:field.key,'data-whale-author-channel':isColor?field.key+'-'+colorChannel:undefined,'aria-busy':mark==='busy','aria-describedby':feedbackId,
        title:!mark?'初始为作者默认值或插件记录，尚未读取实际值':'松手或结束按键后应用',
        style:{width:'100%',minWidth:0,margin:0,accentColor:'var(--dsw-alias-brand-primary, #8c72f2)'},
        onPointerDown:event=>{if(event.button!==0||!begin('pointer',event.pointerId))event.preventDefault();else event.currentTarget.setPointerCapture(event.pointerId);},
        onPointerUp:event=>{if(interaction.current?.mode==='pointer'&&interaction.current.pointerId===event.pointerId)finish(true);},
        onPointerCancel:event=>{if(interaction.current?.pointerId===event.pointerId)finish(false);},
        onLostPointerCapture:event=>{if(interaction.current?.pointerId===event.pointerId)finish(false);},
        onKeyDown:event=>{if(event.key==='Escape'){event.preventDefault();finish(false);}else if(keys.includes(event.key)&&!begin('keyboard'))event.preventDefault();},
        onKeyUp:event=>{if(keys.includes(event.key)&&interaction.current?.mode==='keyboard')finish(true);},
        onBlur:()=>finish(interaction.current?.mode==='keyboard'),
        onChange:event=>{const item=interaction.current;let next=event.currentTarget.valueAsNumber;
          if(isColor){const rgb=nativeAuthorColor(author.read().values[field.key]).rgb;rgb[colorChannel]=next/255;next=rgb.join(' ');}
          if(!item||!author.editPreview(item.ticket,next))event.currentTarget.value=String(value);}}));
  }
  function AuthorNumber({field,state,view,visible,signal,id,editorRef,feedbackId}) {
    const node=React.useRef(null);
    const editor=React.useMemo(()=>createNativeAuthorNumberEditor({author,field,view,isCurrent:()=>!signal?.aborted&&authorViewCurrent(node.current)}),[field,view,signal]);
    const local=React.useSyncExternalStore(editor.subscribe,editor.read,editor.read),mark=state.marks[field.key];
    React.useEffect(()=>{editorRef.current=editor;const cancel=()=>editor.cancel();globalThis.addEventListener('blur',cancel);signal?.addEventListener('abort',cancel,{once:true});return()=>{if(editorRef.current===editor)editorRef.current=null;globalThis.removeEventListener('blur',cancel);signal?.removeEventListener('abort',cancel);cancel();};},[editor,signal,editorRef]);
    React.useEffect(()=>{if(!visible||!state.canEdit)editor.cancel();},[editor,visible,state.canEdit]);
    const keyInfo=event=>({key:event.key,isComposing:event.nativeEvent?.isComposing===true,keyCode:event.nativeEvent?.keyCode??event.keyCode});
    return h('div',{'data-whale-author-number-field':field.key,style:{display:'grid',gap:'4px',minWidth:0,maxWidth:'100%'}},
      h('input',{id,ref:node,type:'text',inputMode:'decimal',value:local.text,autoComplete:'off',spellCheck:false,disabled:!state.canEdit,
        'data-whale-author-number':field.key,'aria-label':authorLabel(field)+'数值','aria-busy':mark==='busy','aria-invalid':local.error?true:undefined,'aria-describedby':[feedbackId,local.error?id+'-error':null].filter(Boolean).join(' '),
        title:'Enter或移开焦点后应用；Esc取消',style:{width:'6em',maxWidth:'100%',minWidth:0,boxSizing:'border-box',color:'inherit',font:'inherit',fontVariantNumeric:'tabular-nums',textAlign:'right',background:'transparent',border:'1px solid var(--dsw-alias-border-l2, #ffffff44)',borderRadius:'4px',padding:'4px 6px'},
        onFocus:()=>editor.focus(),onPointerDown:()=>editor.focus(),onPaste:()=>editor.paste(),onChange:event=>editor.input(event.currentTarget.value),onBlur:()=>{void editor.complete('blur');},
        onCompositionStart:()=>editor.compositionStart(),onCompositionEnd:event=>editor.compositionEnd(event.currentTarget.value),
        onKeyDown:event=>{const action=editor.keyDown(keyInfo(event));if(action.prevent)event.preventDefault();if(action.stop)event.stopPropagation();},onKeyUp:event=>editor.keyUp(keyInfo(event))}),
      local.error?h('span',{id:id+'-error',role:'alert',style:{fontSize:'12px',overflowWrap:'anywhere',maxWidth:'12em'}},local.error):null);
  }
  function AuthorColor({field,state,view,visible,signal,id}) {
    const owner=React.useRef(Symbol('author-color')).current,editing=React.useRef(null),input=React.useRef(null);
    const color=nativeAuthorColor(state.values[field.key]),[text,setText]=React.useState(color.hex),[open,setOpen]=React.useState(false),[error,setError]=React.useState(null);
    function reset(){setText(nativeAuthorColor(author.read().values[field.key])?.hex??'');}
    function finish(commit){commit=commit&&authorViewCurrent(input.current);const ticket=editing.current;editing.current=null;if(!ticket)return;
      const valid=nativeAuthorColorFromHex(input.current?.value);
      if(commit&&valid!==null){void author.editEnd(ticket);setError(null);}else{author.editCancel(ticket);setError(commit?'颜色格式无效，未应用':null);}reset();}
    React.useEffect(()=>{if(!editing.current)setText(color.hex);},[color.hex]);
    React.useEffect(()=>{const cancel=()=>finish(false);globalThis.addEventListener('blur',cancel);signal?.addEventListener('abort',cancel,{once:true});
      return()=>{globalThis.removeEventListener('blur',cancel);signal?.removeEventListener('abort',cancel);cancel();};},[view,signal]);
    React.useEffect(()=>{if(!visible||!state.canEdit){finish(false);setOpen(false);}},[visible,state.canEdit]);
    React.useEffect(()=>{if(editing.current&&!author.editCurrent(editing.current))finish(false);},[state]);
    const mark=state.marks[field.key];
    return h('div',{'data-whale-author-color':field.key,style:{display:'grid',gap:'8px',minWidth:0}},
      h('div',{style:{display:'flex',alignItems:'center',gap:'8px',minWidth:0}},
        h(AuthorName,{field,htmlFor:id+'-hex'}),
        h(AuthorFeedback,{field,mark,id:id+'-feedback'}),
        h('button',{type:'button',className:'dsw-btn','data-whale-author-color-toggle':field.key,'aria-label':authorLabel(field)+'调色','aria-expanded':open,'aria-controls':id+'-channels',disabled:!state.canEdit,
          title:open?'收起颜色调节':'展开颜色调节',onClick:()=>setOpen(!open),style:{padding:'5px',flexShrink:0}},
          h('span',{'aria-hidden':true,style:{display:'block',width:'24px',height:'20px',background:color.hex,border:'1px solid var(--dsw-alias-border-l2, #ffffff44)',borderRadius:'3px'}})),
        h('input',{id:id+'-hex',ref:input,type:'text',value:author.editCurrent(editing.current)?text:color.hex,maxLength:7,spellCheck:false,autoComplete:'off','data-whale-author-key':field.key,
          'aria-label':authorLabel(field)+'色值','aria-busy':mark==='busy','aria-invalid':error?true:undefined,'aria-describedby':[id+'-feedback',error?id+'-error':null].filter(Boolean).join(' '),
          disabled:!state.canEdit,title:'六位色值；Enter或移开焦点后应用',style:{width:'8ch',minWidth:0,flexShrink:0,color:'inherit',font:'inherit',background:'transparent',border:'1px solid var(--dsw-alias-border-l2, #ffffff44)',borderRadius:'4px',padding:'5px'},
          onFocus:()=>{editing.current=author.editStart(field.key,owner,view);setText(color.hex);},
          onChange:event=>{if(!author.editCurrent(editing.current)){reset();return;}const next=event.currentTarget.value;setText(next);const value=nativeAuthorColorFromHex(next);setError(value===null?'请输入六位色值，如 #336699':null);if(value!==null)author.editPreview(editing.current,value);},
          onPaste:()=>{if(!author.editCurrent(editing.current))editing.current=author.editStart(field.key,owner,view);},
          onBlur:()=>finish(true),onKeyDown:event=>{if(event.key==='Escape'){event.preventDefault();finish(false);}else if(event.key==='Enter'){event.preventDefault();if(nativeAuthorColorFromHex(event.currentTarget.value)===null)setError('请输入六位色值，如 #336699');else finish(true);}else if(!author.editCurrent(editing.current)&&(event.key.length===1||['Backspace','Delete'].includes(event.key)))editing.current=author.editStart(field.key,owner,view);}})),
      error?h('span',{id:id+'-error',role:'alert',style:{fontSize:'12px'}},error):null,
      open?h('div',{id:id+'-channels',style:{display:'grid',gap:'10px',minWidth:0,padding:'4px 0'}},...['红 R','绿 G','蓝 B'].map((label,channel)=>h(AuthorSlider,{key:channel,field:{...field,label},state,view,visible,signal,id:id+'-channel-'+channel,colorChannel:channel,feedbackId:id+'-feedback'}))):null);
  }
  function AuthorSelect({field,state,view,id}) {
    const mark=state.marks[field.key],index=field.options.findIndex(option=>Object.is(option.value,state.values[field.key]));
    return h('div',{'data-whale-author-select':field.key,style:{display:'grid',gap:'6px',minWidth:0}},
      h('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',minWidth:0}},
        h(AuthorName,{field,htmlFor:id}),
        h(AuthorFeedback,{field,mark,id:id+'-feedback'})),
      h(Select,{id,choiceScope:field,'data-whale-author-key':field.key,value:String(index),disabled:!state.canEdit,
        'aria-busy':mark==='busy','aria-describedby':id+'-feedback',
        title:!mark?'初始为作者默认值或插件记录，尚未读取实际值':'选定即应用',
        style:{width:'100%',maxWidth:'100%',minWidth:0,boxSizing:'border-box',font:'inherit',opacity:state.canEdit?1:0.5},
        onChange:event=>{if(authorViewCurrent(event.currentTarget))void author.select(field.key,event.value,field,view);}},
        ...field.options.map((option,i)=>h('option',{key:i,value:String(i)},option.label))));
  }
  function AuthorText({field,state,view,visible,signal,id}) {
    const node=React.useRef(null);
    const editor=React.useMemo(()=>createNativeAuthorTextEditor({author,field,view,isCurrent:()=>!signal?.aborted&&authorViewCurrent(node.current)}),[field,view,signal]);
    const local=React.useSyncExternalStore(editor.subscribe,editor.read,editor.read),mark=state.marks[field.key];
    React.useEffect(()=>{const cancel=()=>editor.cancel();globalThis.addEventListener('blur',cancel);signal?.addEventListener('abort',cancel,{once:true});return()=>{globalThis.removeEventListener('blur',cancel);signal?.removeEventListener('abort',cancel);cancel();};},[editor,signal]);
    React.useEffect(()=>{if(!visible||!state.canEdit)editor.cancel();},[editor,visible,state.canEdit]);
    const keyInfo=event=>({key:event.key,isComposing:event.nativeEvent?.isComposing===true,keyCode:event.nativeEvent?.keyCode??event.keyCode});
    return h('div',{'data-whale-author-text':field.key,style:{display:'grid',gap:'6px',minWidth:0}},
      h('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',minWidth:0}},h(AuthorName,{field,htmlFor:id}),
        h(AuthorFeedback,{field,mark,id:id+'-feedback'})),
      h('input',{id,ref:node,type:'text',value:local.text,autoComplete:'off',spellCheck:false,disabled:!state.canEdit,'data-whale-author-key':field.key,
        'aria-busy':mark==='busy','aria-invalid':local.error?true:undefined,'aria-describedby':[id+'-feedback',local.error?id+'-error':null].filter(Boolean).join(' '),
        title:'Enter或移开焦点后应用；Esc取消',style:{width:'100%',minWidth:0,boxSizing:'border-box',color:'inherit',font:'inherit',background:'transparent',border:'1px solid var(--dsw-alias-border-l2, #ffffff44)',borderRadius:'4px',padding:'6px'},
        onFocus:()=>editor.focus(),onPaste:()=>editor.paste(),onPointerDown:()=>editor.focus(),onChange:event=>editor.input(event.currentTarget.value),
        onCompositionStart:()=>editor.compositionStart(),onCompositionEnd:event=>editor.compositionEnd(event.currentTarget.value),
        onBlur:()=>{void editor.complete('blur');},onKeyDown:event=>{const action=editor.keyDown(keyInfo(event));if(action.prevent)event.preventDefault();if(action.stop)event.stopPropagation();},onKeyUp:event=>editor.keyUp(keyInfo(event))}),
      local.error?h('span',{id:id+'-error',role:'alert',style:{fontSize:'12px'}},local.error):null);
  }
  function AuthorSwitches({visible,signal,autoEligible=false}) {
    const state=React.useSyncExternalStore(author.subscribe,author.read,author.read),token=React.useRef(Symbol('author-view')).current,id=React.useId();
    const [confirmed,setConfirmed]=React.useState(false);
    React.useEffect(()=>{setConfirmed(false);},[state.recovery,visible]);
    React.useEffect(()=>{const remove=()=>author.remove(token);signal?.addEventListener('abort',remove,{once:true});return()=>{signal?.removeEventListener('abort',remove);remove();};},[token,signal]);
    React.useEffect(()=>{author.view(token,visible&&!signal?.aborted);},[token,visible,signal]);
    React.useEffect(()=>{if(visible&&autoEligible&&!signal?.aborted)void author.ensureLoaded?.();},[visible,autoEligible,signal,state.phase,state.busy,state.canRead]);
    return h('fieldset',{'data-whale-author-switches':true,'aria-label':'作者参数','aria-busy':state.busy,style:{border:0,padding:0,margin:'16px 0 0',minWidth:0,display:'grid',gap:'10px'}},
      h('legend',{'data-whale-author-heading':true},
        h('span',null,'作者参数'),
        h(InfoPopover,{name:'author-source',label:'作者参数说明',attributes:{'data-whale-author-source':true}},
          h('p',null,'这里显示作者默认值或本机记录，未读取壁纸实际值。修改后直接下发，无需额外保存。'),
          h('p',null,'重新读取只更新设置结构和本机记录，不读取壁纸实际值，不重复下发。')),
        h('button',{type:'button',className:'dsw-btn','data-whale-author-read':true,'data-whale-quiet':true,disabled:!state.canRead,'aria-busy':state.loading,
          'aria-label':state.loading?'正在读取作者参数':state.phase==='idle'?'读取作者参数':state.editing?'取消编辑并重新读取作者参数':state.phase==='blocked'&&!state.fields.length?'重试读取作者参数':'重新读取作者参数',
          title:state.editing?'取消未完成编辑后读取设置结构和本机记录；不读取壁纸实际值，不重复下发':'读取设置结构和本机记录；不读取壁纸实际值，不重复下发',
          onPointerDown:event=>{if(event.button===0)event.preventDefault();},onClick:()=>author.load()},state.loading?'…':state.phase==='idle'?'读取':state.editing?'取消编辑并重读':state.phase==='blocked'&&!state.fields.length?'重试读取':'↻')),
      ...state.fields.map(field=>field.type==='textinput'?h(AuthorText,{key:field.key,field,state,view:token,visible,signal,id:id+'-'+field.key}):field.type==='combo'?h(AuthorSelect,{key:field.key,field,state,view:token,id:id+'-'+field.key}):field.type==='color'?h(AuthorColor,{key:field.key,field,state,view:token,visible,signal,id:id+'-'+field.key}):field.type==='slider'?h(AuthorSlider,{key:field.key,field,state,view:token,visible,signal,id:id+'-'+field.key}):h('div',{key:field.key,'data-whale-author-bool-row':true,style:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',minWidth:0}},
        h(AuthorName,{field,htmlFor:id+'-'+field.key}),h('span',{style:{display:'flex',alignItems:'center',gap:'6px'}},
          h(AuthorFeedback,{field,mark:state.marks[field.key],id:id+'-'+field.key+'-feedback'}),
          h('input',{id:id+'-'+field.key,type:'checkbox','data-whale-author-key':field.key,checked:state.values[field.key]===true,disabled:!state.canEdit,
            'aria-label':authorLabel(field),'aria-busy':state.marks[field.key]==='busy','aria-describedby':id+'-'+field.key+'-feedback',
            title:!state.marks[field.key]?'初始为作者默认值或插件记录，尚未读取实际值':state.marks[field.key]==='unknown'?'本轮修改结果未确认':'修改即应用',
            style:{accentColor:'var(--dsw-alias-brand-primary, #8c72f2)'},onChange:event=>author.change(field.key,event.currentTarget.checked)})))),
      state.phase==='ready'&&!state.fields.length?h('span',null,'暂无可直接应用的参数'):null,
      state.message?h('span',{role:'alert'},Object.values(state.marks).includes('unknown')&&state.message==='下发结果未确认，请观察后重新读取'?'本轮修改结果未确认，请观察画面后重新读取':state.message):null,
      state.recovery?h('div',{'data-whale-author-recovery':true,style:{display:'grid',gap:'8px',minWidth:0}},
        state.recovery.stale?h('span',null,'作者设置已变化，旧待处理记录已保留'):null,
        h('span',null,state.recovery.stale?`${state.recovery.keys.length}项旧参数记录`:`${state.recovery.keys.length}项待发送修改（${state.recovery.own?'本次修改':'其它或未确认来源'}）`),
        h('span',{style:{fontSize:'12px',overflowWrap:'anywhere'}},state.recovery.labels.join('、')),
        h('span',{role:'status'},state.recovery.pending?'命令仍待结束，请稍后重新读取':state.recovery.unknown?'可能已发送，请先观察画面':'这些修改尚未发送'),
        !state.recovery.pending?h('details',null,h('summary',null,state.recovery.stale?'处理旧结构记录':'清除待发送记录'),
          h('label',{style:{display:'flex',gap:'8px',alignItems:'center'}},h('input',{type:'checkbox','data-whale-author-discard-confirm':true,checked:confirmed,disabled:!state.canDiscard,onChange:event=>setConfirmed(event.currentTarget.checked)}),
            state.recovery.stale?(state.recovery.unknown?'我已观察画面，确认清除旧记录并刷新，不回退壁纸':'确认清除旧记录并刷新，不改变壁纸'):state.recovery.unknown?'我已观察画面，确认仅清除记录，不回退壁纸':'确认仅清除记录，不改变壁纸'),
          h('button',{type:'button',className:'dsw-btn','data-whale-author-discard':true,disabled:!confirmed||!state.canDiscard,onClick:event=>{if(!state.recovery.stale||authorViewCurrent(event.currentTarget))void author.discard({confirm:confirmed,observed:confirmed,expected:state.recovery,view:token});}},state.recovery.stale?'清除旧记录并刷新':'确认清除记录')):null):null,
      null);
  }
  function Body(props) {
    if(editorGate){const state=React.useSyncExternalStore(editorGate.subscribe,editorGate.getSnapshot,editorGate.getSnapshot);
      if(!state.nativeAllowed)return h('div',{'data-whale-native-suspended':true,role:'status',style:{padding:'16px'}},state.message??'旧外观窗口尚未关闭');}
    return h(EditorBody,props);
  }
  function Group({title,children}) {
    return h('fieldset',{'data-whale-control-group':title},h('legend',null,title),...(Array.isArray(children)?children:children==null?[]:[children]));
  }
  function Fold({title,name,error,children}) {
    const [open,setOpen]=React.useState(false);
    React.useEffect(()=>{if(error)setOpen(true);},[error]);
    return h('details',{'data-whale-fold':name,open,onToggle:event=>setOpen(event.currentTarget.open)},
      h('summary',null,title,error?h('span',{'aria-label':'此组有问题','data-whale-group-error':true},' !'):null),
      h('div',{'data-whale-fold-body':true},...(Array.isArray(children)?children:children==null?[]:[children])));
  }
  // Commands reuse their existing tickets. Opening/dismissing this menu never invokes a command.
  function ActionMenu({name,label,text='⋯',scope=null,entries=[],description=null,attributes={},disabled=false}) {
    if(description)entries=[{key:'dismiss',label:'关闭说明'}];
    const trigger=React.useRef(null),popup=React.useRef(null),session=React.useRef(null),latest=React.useRef(null);
    const [open,setOpen]=React.useState(false),uid=React.useId();
    const context=()=>{const v=api.getSnapshot(),owner=trigger.current?.closest?.('[data-whale-native-sidebar]');return JSON.stringify([right.mounted.getSnapshot(),v.activeId,v.selectedId,v.playGeneration,v.theme,v.activeTheme,v.backgroundMode,v.authorContext,v.state,owner?.dataset.whaleSettingsPage,owner?.dataset.whaleGalleryOpen]);};
    const signature=JSON.stringify([!!description,disabled,entries.map(e=>[e.key,e.label,e.disabled])]);
    latest.current={entries,signature,scope};
    const close=(focus=false,notify=true)=>{
      session.current=null;if(openChoice?.token===trigger)openChoice=null;
      try{if(popup.current?.matches(':popover-open'))popup.current.hidePopover();}catch{}
      if(notify)setOpen(false);if(focus)trigger.current?.focus();
    };
    const admissible=()=>{const node=trigger.current,owner=node?.closest?.('[data-whale-native-sidebar]');
      if(disabled||author?.read?.().editing||node?.isConnected===false||owner?.hidden||node?.closest?.('[data-tab-id]')?.hidden||node?.closest?.('[data-whale-page-panel]')?.hidden)return false;
      try{if(typeof right.focusedTarget==='function'&&right.focusedTarget(node)===undefined)return false;}catch{return false;}return true;};
    const valid=()=>session.current&&admissible()&&session.current.context===context()&&session.current.signature===latest.current.signature&&session.current.scope===latest.current.scope;
    const place=()=>{const node=trigger.current,list=popup.current;if(!node?.getBoundingClientRect||!list)return;
      const rect=node.getBoundingClientRect(),win=node.ownerDocument.defaultView,w=win.innerWidth,h=win.innerHeight;
      const owner=node.closest('[data-whale-native-sidebar]')?.getBoundingClientRect(),leftEdge=Math.max(8,(owner?.left??0)+8),rightEdge=Math.min(w-8,(owner?.right??w)-8);
      const width=Math.max(0,Math.min(description?300:220,rightEdge-leftEdge)),below=Math.max(0,h-rect.bottom-12),above=Math.max(0,rect.top-12),up=below<Math.min(160,list.scrollHeight)&&above>below;
      Object.assign(list.style,{position:'fixed',inset:'auto',margin:'0',left:Math.max(leftEdge,Math.min(rect.right-width,rightEdge-width))+'px',width:width+'px',maxHeight:Math.min(240,up?above:below)+'px',top:up?'auto':Math.max(8,rect.bottom+4)+'px',bottom:up?Math.max(8,h-rect.top+4)+'px':'auto'});};
    const focusItem=(last=false)=>{const items=[...(popup.current?.querySelectorAll('button:not(:disabled)')??[])];(last?items.at(-1):items[0])?.focus();};
    const begin=()=>{if(!admissible())return;openChoice?.close();trigger.current?.focus();session.current={context:context(),signature,scope};openChoice={token:trigger,close:()=>close()};setOpen(true);
      try{popup.current?.showPopover();}catch{close();return;}place();};
    const choose=key=>{const entry=latest.current.entries.find(e=>e.key===key);if(!valid()||!entry||entry.disabled){close();return;}close(true);return entry.action?.();};
    React.useEffect(()=>{if(open&&!valid())close();});
    React.useEffect(()=>{if(!open)return;const node=trigger.current,list=popup.current,doc=node?.ownerDocument,win=doc?.defaultView;if(!doc||!win)return;
      place();if(description){list.scrollTop=0;list.focus({preventScroll:true});}else focusItem();
      const outside=e=>{if(!node.contains(e.target)&&!list.contains(e.target))close();};
      const hidden=()=>{if(doc.hidden)close();},blur=()=>close();
      doc.addEventListener('pointerdown',outside,true);doc.addEventListener('focusin',outside,true);doc.addEventListener('visibilitychange',hidden);doc.addEventListener('scroll',place,true);win.addEventListener('resize',place);win.addEventListener('blur',blur);
      const observer=typeof ResizeObserver==='function'?new ResizeObserver(place):null;observer?.observe(node);observer?.observe(list);
      return()=>{doc.removeEventListener('pointerdown',outside,true);doc.removeEventListener('focusin',outside,true);doc.removeEventListener('visibilitychange',hidden);doc.removeEventListener('scroll',place,true);win.removeEventListener('resize',place);win.removeEventListener('blur',blur);observer?.disconnect();};
    },[open]);
    React.useEffect(()=>()=>close(false,false),[]);
    return h('span',{...attributes,'data-whale-action-menu':name,'data-whale-object-more':name==='object'?true:undefined,'data-whale-media-more':name==='object'?undefined:name},
      h('button',{ref:trigger,type:'button',disabled,'data-whale-menu-trigger':name,'data-whale-quiet':true,'aria-label':label,title:label,'aria-haspopup':description?'dialog':'menu','aria-expanded':open,'aria-controls':uid,
        onPointerDown:e=>{if(e.button===0)e.preventDefault();},onClick:()=>open?close(true):begin(),onKeyDown:e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();if(!open)begin();else focusItem(e.key==='ArrowUp');}else if(e.key==='Escape'&&open){e.preventDefault();close(true);}}},text),
      h('div',{ref:popup,id:uid,popover:'manual',role:description?'dialog':'menu',tabIndex:description?-1:undefined,'aria-describedby':description?uid+'-help':undefined,'aria-modal':description?'false':undefined,'aria-label':label,'data-whale-action-menu-popup':name,onKeyDown:e=>{
        if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);}else if(e.key==='Tab'){close(true);}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const items=[...popup.current.querySelectorAll('button:not(:disabled)')],at=items.indexOf(e.target);(e.key==='Home'?items[0]:e.key==='End'?items.at(-1):items[(at+(e.key==='ArrowUp'?-1:1)+items.length)%items.length])?.focus();}}},
        description?h('div',{id:uid+'-help','data-whale-help-content':true},description):null,
        ...entries.map(entry=>h('button',{...entry.attributes,key:entry.key,type:'button',role:description?'button':'menuitem',tabIndex:-1,disabled:entry.disabled,'data-danger':entry.danger?'true':undefined,
          onPointerDown:e=>{if(e.button===0)e.preventDefault();},onClick:()=>choose(entry.key)},entry.label))));
  }
  function PlaybackHeader({view,viewToken,sourceErrorId,showGallery,hideGallery,visible}) {
    const openedByPointer=React.useRef(false);
    if(['image','video'].includes(view.backgroundMode)){
      const media=view.backgroundMode==='image'?view.imageInfo:view.videoInfo;
      return h('header',{'data-whale-playback-header':true},
        h('div',{'data-whale-object-title':true},media?.name||(view.backgroundMode==='image'?'本地图片':'本地视频')));
    }
    const closeButton=()=>h('button',{type:'button','data-whale-close-wallpaper':true,disabled:!view.canCloseWallpaper,
      'aria-busy':view.sourceBusy,'aria-describedby':view.backgroundEnableError?sourceErrorId:undefined,
      onClick:()=>api.closeWallpaper(view.closeWallpaperTicket,viewToken)},view.closeWallpaperLabel);
    const recoveryClose=view.showCloseWallpaper&&view.closeWallpaperAction!=='prepare';
    return h('header',{'data-whale-playback-header':true},
      h('div',{'data-whale-object-row':true},h('div',{'data-whale-current-object':true},
        h('div',{'data-whale-object-preview':view.objectPreview?.id??'', 'aria-hidden':true},
          view.objectPreview?h(Preview,{row:view.objectPreview,visible,version:view.galleryVersion}):h('span',{'data-whale-preview-placeholder':true})),
        h('div',{'data-whale-object-summary':true},
          h('div',{'data-whale-object-title':true,title:view.activeId?view.title:view.selectedTitle},view.state==='unknown'?'壁纸状态待确认':view.activeId?view.title:view.selectedTitle),
          h('span',{'data-whale-object-status':true,'data-playing':view.playAction==='stop'&&!view.playBusy?'true':'false','aria-live':'polite'},view.playBusy?view.playLabel:view.showEnableWallpaper?'背景已关闭':view.statusLabel))),
      h('div',{'data-whale-header-actions':true},
        view.showEnableWallpaper?h('button',{type:'button','data-whale-playback-action':'enable-background','data-whale-enable-wallpaper':true,
          disabled:!view.canEnableWallpaper,'aria-busy':view.sourceBusy,'aria-describedby':view.backgroundEnableError?sourceErrorId:undefined,
          title:'启用后仍需手动开始播放','aria-label':view.sourceBusy?'正在启用…':'启用壁纸背景',onClick:()=>api.enableWallpaper(view.enableWallpaperTicket,viewToken)},h('span',{'aria-hidden':true},'+')):
          h('button',{type:'button','data-whale-playback-action':view.playAction,'data-whale-playback-recovery':view.state==='cleanup-failed'?'true':undefined,disabled:!view.canPlay,'aria-busy':view.playBusy,
            'aria-describedby':view.backgroundEnableError?sourceErrorId:undefined,'aria-label':view.playLabel,title:view.playLabel,
            onClick:()=>api.play(view.playAction,view.selectedId,view.playMode,view.activeId,view.playGeneration)},view.state==='cleanup-failed'?view.playLabel:h('svg',{'data-whale-play-icon':true,'aria-hidden':true,viewBox:'0 0 16 16'},h('path',{d:view.playAction==='stop'?'M3 3h10v10H3z':'M4 2l10 6-10 6z'}))),
        h('button',{type:'button','data-whale-change-wallpaper':true,'data-whale-quiet':true,'aria-expanded':view.galleryOpen,
          onPointerDown:event=>{if(event.button===0){openedByPointer.current=!view.galleryOpen;if(openedByPointer.current)showGallery();}},onPointerCancel:()=>{openedByPointer.current=false;},
          onClick:event=>{const opened=openedByPointer.current;openedByPointer.current=false;if(event.detail>0&&opened)return;if(view.galleryOpen)hideGallery();else showGallery();},
          'aria-label':view.galleryOpen?'返回当前壁纸':'更换壁纸',title:view.galleryOpen?'返回当前壁纸':'更换壁纸'},view.galleryOpen?'返回':'更换'),
        view.showCloseWallpaper&&!recoveryClose?h(ActionMenu,{name:'object',label:'壁纸更多操作',scope:view.closeWallpaperTicket,entries:[{key:'close',label:view.closeWallpaperLabel,disabled:!view.canCloseWallpaper,attributes:{'data-whale-close-wallpaper':true,'aria-busy':view.sourceBusy},action:()=>api.closeWallpaper(view.closeWallpaperTicket,viewToken)}]}):null)),
      recoveryClose?h('div',{'data-whale-close-recovery':true},closeButton()):null,
      view.activeId&&view.activeId!==view.selectedId?h('div',{'data-whale-selected-target':true},`所选：${view.selectedTitle}`):null,
      view.backgroundEnableError?h('span',{id:sourceErrorId,'data-whale-background-error':true,role:'alert'},view.backgroundEnableError):null,
      view.catalogLoading?h('p',{'data-whale-catalog-loading':true,role:'status'},'正在读取壁纸目录…'):
        view.catalogError?h('div',{'data-whale-catalog-error':true},h('span',{role:'status'},view.catalogError),
          h('button',{type:'button','data-whale-quiet':true,'aria-label':'重试加载壁纸目录',onClick:()=>api.retryCatalog()},'重试')):null,
      view.playHint&&!view.catalogLoading&&!view.catalogError?h('p',{'data-whale-playback-hint':true,role:view.state==='cleanup-failed'?'alert':'status'},view.playHint):null);
  }
  function EditorBody({useTabInfo}) {
    const {tab}=useTabInfo();
    const viewToken=React.useRef(Symbol('whale-header-view')).current;
    const contentToken=React.useRef(Symbol('whale-content-view')).current;
    const rootNode=React.useRef(null),sectionRef=React.useRef('wallpaper');
    const [section,setSection]=React.useState('wallpaper');
    const sourceErrorId=React.useId(),sectionId=React.useId();
    const view=React.useSyncExternalStore(api.subscribe,api.getSnapshot,api.getSnapshot);
    const wallpaperVisible=tab.visible===true&&section==='wallpaper'&&!view.galleryOpen;
    React.useEffect(()=>{
      const removeHeader=api.registerView(viewToken,tab.signal),removeContent=api.registerView(contentToken,tab.signal);
      return()=>{removeContent();removeHeader();};
    },[viewToken,contentToken,tab.signal]);
    React.useEffect(()=>{api.viewVisible(viewToken,tab.visible);},[viewToken,tab.visible]);
    React.useEffect(()=>{api.viewVisible(contentToken,wallpaperVisible);},[contentToken,wallpaperVisible]);
    function selectSection(next){
      if(!['wallpaper','interface'].includes(next)||sectionRef.current===next)return;
      sectionRef.current=next;
      if(rootNode.current)rootNode.current.dataset.whaleSettingsPage=next;
      api.viewVisible(contentToken,tab.visible===true&&next==='wallpaper'&&!api.getSnapshot().galleryOpen);
      setSection(next);
    }
    function hideGallery(){selectSection('wallpaper');api.showGallery(false);}
    function showGallery(){
      selectSection('wallpaper');
      if(api.getSnapshot().galleryOpen)return;
      if(rootNode.current)rootNode.current.dataset.whaleGalleryOpen='true';
      api.viewVisible(contentToken,false);api.showGallery(true);
    }
    const sectionButton=(key,label)=>h('button',{type:'button',role:'tab',id:sectionId+'-'+key,
      'data-whale-settings-section':key,'aria-selected':section===key,'aria-controls':sectionId+'-'+key+'-panel',tabIndex:section===key?0:-1,
      onPointerDown:event=>{if(event.button===0)selectSection(key);},onClick:()=>selectSection(key),
      onKeyDown:event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        event.preventDefault();const next=event.key==='Home'?'wallpaper':event.key==='End'?'interface':key==='wallpaper'?'interface':'wallpaper';
        selectSection(next);event.currentTarget.parentElement?.querySelector('[data-whale-settings-section="'+next+'"]')?.focus();}},label);
    return h('section',{ref:rootNode,'data-whale-native-sidebar':true,'data-tab-id':tab.id,'data-whale-settings-page':section,
      'data-whale-gallery-open':String(view.galleryOpen),'aria-label':'Whale 外观',style:{color:'var(--dsw-alias-label-primary)',minWidth:0}},
      h('style',{'data-whale-native-controls-style':true},NATIVE_APPEARANCE_CONTROLS_CSS),
      h('div',{'data-whale-settings-navigation':true,role:'tablist','aria-label':'外观分区'},sectionButton('wallpaper','壁纸'),sectionButton('interface','界面')),
      h(PlaybackHeader,{view,viewToken,sourceErrorId,showGallery,hideGallery,visible:tab.visible===true}),
      h('div',{key:view.galleryOpen?'gallery':'details','data-whale-page-panel':'wallpaper',role:'tabpanel',id:sectionId+'-wallpaper-panel',
        'aria-labelledby':sectionId+'-wallpaper',hidden:section!=='wallpaper'},
        view.galleryOpen?h(Gallery,{view,visible:tab.visible===true&&section==='wallpaper'}):h(React.Fragment,null,
          view.authorContext?h(AuthorSwitches,{visible:wallpaperVisible,signal:tab.signal,autoEligible:view.state==='playing'}):null,
      view.showLocalImage?h(LocalMedia,{kind:'image',view,token:contentToken}):null,
      view.showLocalVideo?h(LocalMedia,{kind:'video',view,token:contentToken}):null,
      h(Group,{title:'画面效果'},
        h(RangeControl,{setting:'brightness',label:'亮度',hint:'100%为原始亮度',value:view.brightness,view}),
        h(RangeControl,{setting:'mask',label:'遮罩',hint:'数值越大，主题底色覆盖越强',value:view.mask,view}),
        h(RangeControl,{setting:'blur',label:'背景模糊',hint:'只影响背景画面，0px不模糊',value:view.blur,view})),
      h(Group,{title:'界面透出'},
        h(RangeControl,{setting:'surface',label:'界面不透明度',hint:'数值越低，侧栏和卡片透出越多；菜单与输入卡片保持可读',value:view.surface,view}),
        h(RangeControl,{setting:'chatBackdrop',label:'聊天底色',hint:'0%保留壁纸，100%使用主题实色；不包含在壁纸预设中',value:view.chatBackdrop,view})),
      ['image','video'].includes(view.backgroundMode)?null:h(PlaybackOptions,{view}),
      h(PresetControl,{view,token:contentToken,visible:wallpaperVisible})),
        view.galleryOpen&&view.catalogError?h('div',{role:'status'},view.catalogError,h('button',{type:'button',onClick:()=>api.retryCatalog()},'重试')):null),
      h('div',{'data-whale-page-panel':'interface',role:'tabpanel',id:sectionId+'-interface-panel',
        'aria-labelledby':sectionId+'-interface',hidden:section!=='interface'},
        h('section',{'data-whale-interface-controls':true},
          h(Group,{title:'主题与配色'},h(ThemeControl,{view}),h(PaletteControl,{view}),h(AccentControl,{view})),
          h(Group,{title:'文字'},h(ReadabilityControl,{view})),
          h(Fold,{name:'interface',title:'更多外观',error:view.opaqueSidebarError||view.sidebarError||view.canvasError||view.glassError},
            h(OpaqueSidebarControl,{view}),h(SidebarDepthControl,{view}),h(CanvasDepthControl,{view}),h(GlassControl,{view})))));
  }
  function Title() {return h('span',{'data-whale-sidebar-title':true,title:'Whale 外观','aria-label':'Whale 外观'},'外观');}
  function Trigger() {
    const view=React.useSyncExternalStore(api.subscribe,api.getSnapshot,api.getSnapshot);
    return h('span',null,h('button',{type:'button',id:'whale-appearance-header-btn','data-whale-native-trigger':true,disabled:!view.canOpen,
      className:'dsw-btn dsw-header-action-btn',title:!view.canOpen?'请先打开一个会话':'打开Whale外观侧栏',onClick:()=>api.open()},'Whale 外观'),
      h('style',{'data-whale-native-trigger-style':true},NATIVE_APPEARANCE_TRIGGER_CSS),view.error ? h('span',{role:'alert'},view.error) : null);
  }
  api.Body=Body;api.Title=Title;api.Trigger=Trigger;
  // Install transactionally: failed later registration unwinds earlier registrations/subscriptions.
  try {
    refresh();
    releases.push(ctx.sidebarRightTabs.register({id,kind,title:()=> 'Whale 外观'}));
    releases.push(ctx.slots.inject('sidebar.right.pane.tab',()=>ctx.slots.register({name:'sidebar.right.pane.tab',key:id},Body)));
    releases.push(ctx.slots.inject('sidebar.right.pane.tab.title',()=>ctx.slots.register({name:'sidebar.right.pane.tab.title',key:id},Title)));
    releases.push(controller.subscribeSettings(refresh));
    if(typeof controller.media?.subscribe==='function')releases.push(controller.media.subscribe(refresh));
    if(typeof controller.presets?.subscribe==='function')releases.push(controller.presets.subscribe(refresh));
    releases.push(controller.wallpaper.subscribeStatus(refresh));
    if(typeof controller.wallpaper.subscribeCloseFence==='function')releases.push(controller.wallpaper.subscribeCloseFence(refresh));
    if(typeof controller.wallpaper.subscribeLibrary==='function')releases.push(controller.wallpaper.subscribeLibrary(refresh));
    releases.push(transport.subscribe(refresh));
    releases.push(catalogRead.subscribe(refresh));
    if(typeof ctx.on==='function')releases.push(ctx.on('theme/change',refresh));
    if(editorGate)releases.push(editorGate.subscribe(()=>{if(!admitted())catalogRead.cancel();refresh();}));
    releases.push(right.mounted.subscribe(()=>{failure=null;catalogRead.cancel();refresh();}));
  } catch(error) {dispose();throw error;}
  return Object.freeze(api);
}

/** Keep sidebar provider replacement local: never make the whole theme/player depend on it. */
function attachNativeAppearanceSidebar({ctx,React,controller,playbackOptions,catalogOptions,loadPreview,previewOptions,requestAuthor,validateValue,editorGate=null}) {
  const listeners=new Set();
  const playback=createNativePlaybackGate(playbackOptions);
  const author=typeof requestAuthor==='function'?createNativeAuthorSwitches({request:requestAuthor,validateValue}):null;
  let disposed=false,active=null;
  let snapshot=Object.freeze({ready:false,canOpen:false,error:null});
  function publish() {
    if(disposed)return;
    const current=active?.getSnapshot();
    const gate=editorGate?.getSnapshot();
    const next={ready:active!==null,canOpen:current?.canOpen===true&&(!gate||gate.canRequestNative),error:gate?.message??current?.error??null};
    if(Object.keys(next).every(key=>Object.is(next[key],snapshot[key])))return;
    snapshot=Object.freeze(next);
    for(const fn of [...listeners])fn();
  }
  const api={
    getSnapshot:()=>snapshot,
    subscribe(fn){if(disposed)return()=>{};listeners.add(fn);return()=>listeners.delete(fn);},
    open(){if(disposed)return{ok:false,error:'disposed'};return active?.open()??{ok:false,error:'native-sidebar-unavailable'};},
    async dispose(){if(disposed)return;disposed=true;offGate?.();listeners.clear();playback.dispose();author?.dispose();await dependency.dispose();},
  };
  const offGate=editorGate?.subscribe(publish);
  const dependency=ctx.inject(['sidebarRightTabs','sidebarRight'],child=>{
    if(disposed)return;
    const instance=createNativeAppearanceSidebar({ctx:child,React,controller,playback,catalogOptions,loadPreview,previewOptions,author,editorGate});
    active=instance;
    const off=instance.subscribe(()=>{if(active===instance)publish();});
    publish();
    child.effect(()=>()=>{
      off();
      if(active===instance){active=null;publish();}
      instance.dispose();
    },'whale: native sidebar dependency generation');
  });
  function Trigger(){
    const state=React.useSyncExternalStore(api.subscribe,api.getSnapshot,api.getSnapshot);
    return React.createElement('span',null,React.createElement('button',{
      type:'button',id:'whale-appearance-header-btn','data-whale-native-trigger':true,className:'dsw-btn dsw-header-action-btn',disabled:!state.canOpen,
      title:state.error??(!state.ready?'外观侧栏尚未就绪':!state.canOpen?'请先打开一个会话':'打开Whale外观侧栏'),
      onClick:()=>api.open(),
    },'Whale 外观'),React.createElement('style',{'data-whale-native-trigger-style':true},NATIVE_APPEARANCE_TRIGGER_CSS),state.error?React.createElement('span',{role:'alert'},state.error):null);
  }
  return Object.freeze({...api,Trigger});
}

return {createNativeAppearanceSidebar,attachNativeAppearanceSidebar,createAppearanceEditorGate,createLegacyAppearanceBoundary};
    })();
    /* WM_NATIVE_SIDEBAR_END */

    const inject = ["theme", "slots"];

    function apply(ctx) {
      let appearanceStorageInitiallyMissing = false;
      let settings = readSettings(result => { appearanceStorageInitiallyMissing = result.missing; });
      const initialAppearanceSettings = settings;
      const query = new URLSearchParams(window.location.search);
      const qaEnabled = query.has("wm-status-qa");
      const qaTheme = query.get("wm-theme-qa");
      if (qaEnabled && ALLOWED_SETTINGS.theme.includes(qaTheme)) {
        settings = normalizeSettings({ ...settings, theme: qaTheme });
      }
      const themeSignal = createBooleanSignal(false);
      // The Host injects nothing here; this only lets the isolated QA page shorten the
      // bounded waits so the same production code paths are checked without waiting them out.
      const wallpaperTimeouts = window.__WM_WALLPAPER_TIMEOUTS__ ?? {};
      const wallpaper = createWallpaperEngine({
        firstFrameTimeoutMs: wallpaperTimeouts.firstFrameTimeoutMs,
        idleTimeoutMs: wallpaperTimeouts.idleTimeoutMs,
        retryDelayMs: wallpaperTimeouts.retryDelayMs,
        hostStatusTimeoutMs: wallpaperTimeouts.hostStatusTimeoutMs,
      });
      const backdrop = createBackdrop(wallpaper);
      let disposed = false;
      let selectionRevision = 0;
      // Bumped by every explicit playback action and by leaving the source. The automatic
      // start checks it before and after its host query, so a late answer from an older
      // intent can never start a run the user stopped or never asked for.
      let userActionRevision = 0;
      let backgroundCloseContextRevision = 0;
      /**
       * Bumped by every playback-mode change. The automatic start captures it when the session
       * begins, so a trip to preview and back cancels the pending request instead of letting a
       * late host answer through: checking only the final mode value would miss that.
       */
      let playbackModeRevision = 0;
      /** How many bounded host-readiness checks auto playback may make before giving up. */
      const AUTO_START_MAX_ATTEMPTS = 5;
      /** Total window for the automatic readiness checks, so a dead host cannot stall it. */
      const AUTO_START_WINDOW_MS = 12000;
      /** Read limit for one readiness check, used to shrink it when the window is nearly over. */
      const HOST_STATUS_READ_MS = Number.isFinite(wallpaperTimeouts.hostStatusTimeoutMs) && wallpaperTimeouts.hostStatusTimeoutMs > 0
        ? wallpaperTimeouts.hostStatusTimeoutMs
        : 4000;

      let presets = readPresets();
      const presetListeners = new Set();
      const notifyPresetListeners = () => {
        for (const listener of presetListeners) {
          try { listener(); } catch {}
        }
      };

      let settingsSnapshot = Object.freeze({ ...settings });
      const settingsListeners = new Set();
      const notifySettingsListeners = () => {
        settingsSnapshot = Object.freeze({ ...settings });
        for (const listener of settingsListeners) {
          try { listener(settingsSnapshot); } catch {}
        }
      };

      const checkSceneAvailability = (sceneId) => {
        if (!sceneId || !isSceneId(sceneId)) return { ok: false, error: "invalid-scene" };
        const wp = (typeof controller?.wallpaper?.getStatus === "function") ? controller.wallpaper : wallpaper;
        const status = wp.getStatus();
        const snapshot = typeof wp.getLibrarySnapshot === "function" ? wp.getLibrarySnapshot() : null;

        if (sceneId === "lucy") {
          if (Array.isArray(status?.host?.scenes)) {
            const lucyHost = status.host.scenes.find(s => s?.id === "lucy");
            if (lucyHost && lucyHost.available === false) {
              return { ok: false, error: "scene-unavailable", sceneId: "lucy" };
            }
          }
          if (snapshot && Array.isArray(snapshot.items)) {
            const lucyLib = snapshot.items.find(s => s?.id === "lucy");
            if (lucyLib && lucyLib.available === false) {
              return { ok: false, error: "scene-unavailable", sceneId: "lucy" };
            }
          }
          if (status?.host && status.host.available === false && status.host.unavailableReason === "scene") {
            return { ok: false, error: "scene-unavailable", sceneId: "lucy" };
          }
          return { ok: true, targetId: "lucy" };
        }

        if (!snapshot || !snapshot.loaded || snapshot.state !== "ready") {
          return { ok: false, error: "scene-unconfirmed", sceneId };
        }
        const item = Array.isArray(snapshot.items) ? snapshot.items.find(s => s?.id === sceneId) : null;
        if (!item || item.available !== true) {
          return { ok: false, error: "scene-unavailable", sceneId };
        }
        return { ok: true, targetId: sceneId };
      };

      const resolvePresetTarget = () => {
        if (disposed) return { ok: false, error: "disposed" };
        const wp = (typeof controller?.wallpaper?.getStatus === "function") ? controller.wallpaper : wallpaper;
        const status = wp.getStatus();
        if (status.cleanupPending || (typeof wp.hasPendingCleanup === "function" && wp.hasPendingCleanup())) {
          return { ok: false, error: "transition", state: "stopping" };
        }
        if (["starting", "connecting", "waiting"].includes(status.state)) {
          return { ok: false, error: "transition", state: status.state };
        }
        if (status.state === "cleanup-failed") {
          return { ok: false, error: "cleanup-failed" };
        }
        if (status.state === "error") {
          return { ok: false, error: "error" };
        }
        if (status.state === "playing") {
          const activeId = status.host?.activeSceneId;
          if (!activeId || !isSceneId(activeId)) return { ok: false, error: "unknown-scene" };
          if (activeId !== settings.weScene) return { ok: false, error: "mismatch", activeId, selectedId: settings.weScene };
          const avail = checkSceneAvailability(activeId);
          if (!avail.ok) return avail;
          return { ok: true, targetId: activeId, isPlaying: true };
        }
        if (["idle", "stopped"].includes(status.state)) {
          if (!isSceneId(settings.weScene)) return { ok: false, error: "invalid-scene" };
          const avail = checkSceneAvailability(settings.weScene);
          if (!avail.ok) return avail;
          return { ok: true, targetId: settings.weScene, isPlaying: false };
        }
        return { ok: false, error: "state-disallowed", state: status.state };
      };

      const checkPresetTarget = (expectedSceneId) => {
        const target = resolvePresetTarget();
        if (!target.ok) return target;
        if (expectedSceneId && expectedSceneId !== target.targetId) {
          return { ok: false, error: "target-mismatch", expected: expectedSceneId, actual: target.targetId };
        }
        return target;
      };

      let backgroundCommitSequence = 0;
      let backgroundFenceRevision = 0;
      let backgroundCommitPermit = null;
      let pendingBackgroundSave = null;
      const backgroundFenceAction = (action, options = {}) => {
        let signal, timeoutMs, guard;
        try {
          if (!options || typeof options !== "object" || Array.isArray(options)) throw Error();
          ({ signal, timeoutMs, isCurrent: guard = () => true } = options);
          if (typeof guard !== "function") throw Error();
        } catch { return Promise.resolve(Object.freeze({ ok: false, error: "fence-invalid-options" })); }
        backgroundCommitPermit = null;
        const fenceRevision = ++backgroundFenceRevision;
        if (action === "prepareCloseFence") userActionRevision++;
        const preferences = settings, intent = userActionRevision, selection = selectionRevision, context = backgroundCloseContextRevision;
        const isCurrent = () => { try { return !disposed && settings === preferences && !signal?.aborted
          && intent === userActionRevision && selection === selectionRevision && context === backgroundCloseContextRevision && guard() === true; } catch { return false; } };
        return wallpaper[action]({ signal, timeoutMs, isCurrent }).then(result => {
          if (action !== "activateCloseFence" && result.ok && result.snapshot?.state === "ready"
            && result.snapshot === wallpaper.getCloseFenceSnapshot() && fenceRevision === backgroundFenceRevision
            && preferences.background === "wallpaper" && isCurrent()) {
            const permit = Object.freeze({ version: 1, id: ++backgroundCommitSequence });
            backgroundCommitPermit = { permit, proof: result.snapshot, preferences, intent, selection, context,
              isCurrent: () => fenceRevision === backgroundFenceRevision && isCurrent() };
            return Object.freeze({ ...result, permit });
          }
          return result;
        });
      };

      const commitBackgroundClose = (permit) => {
        const entry = backgroundCommitPermit;
        const reply = (ok, error, stage, applied = false, persisted = "not-attempted") => Object.freeze({
          ok, ...(error ? { error } : {}), stage, value: settings.background, applied, persisted,
        });
        let current = false;
        try { current = !!entry && entry.permit === permit && entry.isCurrent() && settings.background === "wallpaper"; } catch {}
        if (!current) return reply(false, disposed ? "background-close-disposed" : "background-close-stale", "permission");
        backgroundCommitPermit = null; // Even a failed save consumes this exact permission.
        if (!wallpaper.consumeCloseFence(entry.proof)) return reply(false, "background-close-stale", "permission");
        return saveBackgroundSource(entry, "none");
      };

      // Shared strict single-field persistence for the paired native source actions.
      const saveBackgroundSource = (entry, value) => {
        const stale = value === "none" ? "background-close-stale" : "background-enable-stale";
        const reply = (ok, error, stage, applied = false, persisted = "not-attempted") => Object.freeze({
          ok, ...(error ? { error } : {}), stage, value: settings.background, applied, persisted,
        });
        const valid = () => { try { return entry.isCurrent(); } catch { return false; } };
        if (!valid()) return reply(false, stale, "permission");
        let storage, beforeRaw, stored, targetRaw, writeFailed = false, recovered = false;
        const nextSettings = { ...entry.preferences, background: value };
        try { storage = localStorage; beforeRaw = storage.getItem(STORAGE_KEY); }
        catch { return reply(false, "background-storage-unavailable", "storage-read", false, "unknown"); }
        if (!valid()) return reply(false, stale, "storage-read");
        // Only an exact previously attempted save, with its original context still current,
        // may be adopted on an explicit fresh check. A random external 'none' is not authority.
        const pending = pendingBackgroundSave;
        recovered = !!pending && pending.preferences === settings && pending.intent === userActionRevision
          && pending.selection === selectionRevision && pending.context === backgroundCloseContextRevision && pending.value === value && pending.targetRaw === beforeRaw;
        if (recovered) targetRaw = pending.targetRaw;
        else {
          try {
            stored = beforeRaw === null && appearanceStorageInitiallyMissing && entry.preferences === initialAppearanceSettings
              ? { ...entry.preferences } : JSON.parse(beforeRaw);
            if (!stored || typeof stored !== "object" || Array.isArray(stored)) throw Error();
            const normalized = normalizeSettings(stored);
            if (!Object.keys(entry.preferences).every(key => Object.is(normalized[key], entry.preferences[key]))) throw Error();
            targetRaw = JSON.stringify({ ...stored, background: value });
          } catch { return reply(false, "background-storage-conflict", "storage-conflict", false, "different"); }
          if (!valid()) return reply(false, stale, "storage-conflict");
          pendingBackgroundSave = { preferences: entry.preferences, intent: entry.intent, selection: entry.selection, context: entry.context, value, targetRaw };
          try { storage.setItem(STORAGE_KEY, targetRaw); } catch { writeFailed = true; }
          let observed;
          try { observed = storage.getItem(STORAGE_KEY); }
          catch { return reply(false, valid() ? "background-storage-unconfirmed" : stale, "storage-verify", false, "unknown"); }
          if (!valid()) return reply(false, stale, "storage-verify", false, "superseded");
          if (observed !== targetRaw) {
            pendingBackgroundSave = null;
            return reply(false, writeFailed ? "background-storage-write" : "background-storage-unconfirmed", "storage-verify", false,
              observed === beforeRaw ? "unchanged" : "different");
          }
        }
        if (!valid()) return reply(false, stale, "storage-verify", false, "superseded");
        pendingBackgroundSave = null;
        settings = nextSettings;
        selectionRevision++;
        userActionRevision++;
        let projectionFailed = false;
        try { projectSettings(nextSettings); } catch { projectionFailed = true; }
        if (settings === nextSettings && !disposed) {
          try { backdrop.update(nextSettings, themeSignal.getSnapshot()); } catch { projectionFailed = true; }
        }
        // Publish the actual current state even when persistence or projection threw, and
        // never restore old preferences over a reentrant newer user choice.
        notifySettingsListeners();
        if (disposed || settings !== nextSettings) return reply(false, stale, "superseded", true, "superseded");
        if (writeFailed) return reply(false, "background-storage-write", "storage-write", true, "confirmed");
        if (projectionFailed) return reply(false, "background-projection-failed", "projection", true, "confirmed");
        return reply(true, null, recovered ? "recovered" : "complete", true, "confirmed");
      };

      let sourceEnablePending = false, localMediaPending = false;
      const enableBackgroundSource = async (options = {}) => {
        const fail = error => Object.freeze({ ok: false, error, value: settings.background, applied: false, persisted: "not-attempted" });
        let signal, guard, timeoutMs;
        try {
          if (!options || typeof options !== "object" || Array.isArray(options)) throw Error();
          ({ signal, isCurrent: guard = () => true, timeoutMs = 4000 } = options);
          if (typeof guard !== "function" || !Number.isFinite(timeoutMs) || timeoutMs <= 0
            || signal != null && (typeof signal.aborted !== "boolean" || typeof signal.addEventListener !== "function" || typeof signal.removeEventListener !== "function")) throw Error();
        } catch { return fail("background-enable-invalid-options"); }
        if (sourceEnablePending || localMediaPending || disposed || settings.background !== "none") return fail("background-enable-unavailable");
        const preferences = settings, intent = userActionRevision, selection = selectionRevision, context = backgroundCloseContextRevision;
        const revision = ++backgroundFenceRevision;
        backgroundCommitPermit = null;
        const isCurrent = () => { try { return !disposed && settings === preferences && !signal?.aborted && guard() === true
          && userActionRevision === intent && selectionRevision === selection && backgroundCloseContextRevision === context && revision === backgroundFenceRevision; } catch { return false; } };
        if (!isCurrent()) return fail("background-enable-stale");
        sourceEnablePending = true;
        const end = performance.now() + Math.min(timeoutMs, 4000);
        const opts = () => ({ signal, isCurrent, timeoutMs: Math.max(1, end - performance.now()) });
        try {
          if (!wallpaper.canEnableBackgroundSource()) {
            // A fresh explicit inspection rebinds the consumed close proof to this intent.
            const checked = await wallpaper.inspectCloseFence(opts());
            if (!checked.ok) return fail(checked.error);
            if (!isCurrent() || performance.now() >= end) return fail("background-enable-stale");
            if (checked.snapshot.state !== "ready") return fail("background-enable-not-ready");
            const activated = await wallpaper.activateCloseFence(opts());
            if (!activated.ok) return fail(activated.error);
          } else {
            // Cold none and a previous confirmed activation both need a fresh Host read.
            const checked = await wallpaper.readHostCloseState(opts());
            if (!checked.ok || !checked.snapshot.bothQuiescent) return fail(checked.error ?? "background-enable-not-ready");
          }
          const valid = () => isCurrent() && performance.now() < end && wallpaper.canEnableBackgroundSource();
          if (!valid()) return fail("background-enable-stale");
          return saveBackgroundSource({ preferences, intent, selection, context, isCurrent: valid }, "wallpaper");
        } finally { sourceEnablePending = false; }
      };

      const editBackgroundMedia = async (kind, action, file, options = {}) => {
        let sourceApplied = false;
        const fail = (error, extra = {}) => Object.freeze({ ok: false, error, value: settings.background, applied: sourceApplied, ...extra });
        let signal, guard, timeoutMs;
        try {
          if (!options || typeof options !== "object" || Array.isArray(options)) throw Error();
          ({ signal, isCurrent: guard = () => true, timeoutMs = 6000 } = options);
          if (typeof guard !== "function" || !Number.isFinite(timeoutMs) || timeoutMs <= 0
            || signal != null && (typeof signal.aborted !== "boolean" || typeof signal.addEventListener !== "function" || typeof signal.removeEventListener !== "function")) throw Error();
        } catch { return fail(`${kind}-invalid-options`); }
        if (disposed || localMediaPending || sourceEnablePending || !Object.hasOwn(MEDIA_LIMITS, kind) || !["none", kind].includes(settings.background)
          || !["replace", "use", "remove"].includes(action)) return fail(`${kind}-unavailable`);
        if (action === "replace" && !validLocalMedia(kind, file)) return fail(`${kind}-file-invalid`);
        const abort = new AbortController(), end = performance.now() + Math.min(timeoutMs, 6000);
        const cancel = () => abort.abort(); signal?.addEventListener("abort", cancel, { once: true });
        let preferences = settings, intent = userActionRevision, selection = selectionRevision;
        const context = backgroundCloseContextRevision, revision = ++backgroundFenceRevision;
        const storageCurrent = () => {
          try {
            const raw = localStorage.getItem(STORAGE_KEY), pending = pendingBackgroundSave;
            if (raw === null && appearanceStorageInitiallyMissing && preferences === initialAppearanceSettings) return true;
            if (pending?.preferences === preferences && pending.intent === intent && pending.selection === selection
              && pending.context === context && pending.targetRaw === raw) return true;
            const stored = JSON.parse(raw);
            if (!stored || typeof stored !== "object" || Array.isArray(stored)) return false;
            const normalized = normalizeSettings(stored);
            return Object.keys(preferences).every(key => Object.is(normalized[key], preferences[key]));
          } catch { return false; }
        };
        const current = () => { try { return !disposed && !signal?.aborted && !abort.signal.aborted && guard() === true && performance.now() < end
          && preferences === settings && intent === userActionRevision && selection === selectionRevision && context === backgroundCloseContextRevision && revision === backgroundFenceRevision; } catch { return false; } };
        const opts = () => ({ signal: abort.signal, isCurrent: current, timeoutMs: Math.max(1, end - performance.now()) });
        if (!current()) { signal?.removeEventListener("abort", cancel); return fail(`${kind}-cancelled`); }
        if (!storageCurrent()) { signal?.removeEventListener("abort", cancel); return fail(`${kind}-settings-unconfirmed`); }
        localMediaPending = true; backgroundCommitPermit = null;
        try {
          // Never silently stop a running or foreign source to import a local file.
          const observed = await wallpaper.readHostCloseState(opts());
          if (!observed.ok || !observed.snapshot.bothQuiescent || !current()) return fail(observed.error ?? `${kind}-source-active`);
          let proof;
          if (wallpaper.canEnableBackgroundSource()) proof = await wallpaper.prepareCloseFence(opts());
          else proof = await wallpaper.inspectCloseFence(opts());
          if (proof.ok && proof.snapshot?.state === "pending" && current()) proof = await wallpaper.inspectCloseFence(opts());
          if (!proof.ok || !current() || !wallpaper.consumeCloseFence(proof.snapshot)) return fail(proof.error ?? `${kind}-source-unconfirmed`);
          const engineGeneration = wallpaper.getStatus().generation;
          const valid = () => current() && storageCurrent() && current() && wallpaper.getStatus().generation === engineGeneration
            && !wallpaper.getCloseSnapshot().uncertain && wallpaper.getCloseSnapshot().pendingCount === 0;
          if (action === "remove" && settings.background === kind) {
            const saved = saveBackgroundSource({ preferences, intent, selection, context, isCurrent: valid }, "none");
            if (!saved.ok) return saved; // Keep the cached file when the source save is unconfirmed.
            sourceApplied = true;
            preferences = settings; intent = userActionRevision; selection = selectionRevision;
          }
          const changed = await backdrop.changeLocalMedia(kind, action, file, { ...opts(), isCurrent: valid });
          if (!changed.ok) return fail(action === "remove" && changed.error === `${kind}-storage` ? `${kind}-remove-storage` : changed.error, { mediaSaved: changed.mediaSaved });
          if (!valid() || !backdrop.mediaRevisionCurrent(kind, changed.revision)) return fail(`${kind}-cancelled`, { mediaSaved: changed.mediaSaved });
          if (action === "remove") return Object.freeze({ ok: true, value: settings.background, applied: true, mediaSaved: true });
          if (settings.background === kind) return Object.freeze({ ok: true, value: kind, applied: true, mediaSaved: changed.mediaSaved });
          const saved = saveBackgroundSource({ preferences, intent, selection, context,
            isCurrent: () => valid() && backdrop.mediaRevisionCurrent(kind, changed.revision) }, kind);
          return Object.freeze({ ...saved, mediaSaved: changed.mediaSaved });
        } finally { localMediaPending = false; signal?.removeEventListener("abort", cancel); }
      };

      const editBackgroundImage = (action, file, options) => editBackgroundMedia("image", action, file, options);
      const editBackgroundVideo = (action, file, options) => editBackgroundMedia("video", action, file, options);

      const controller = {
        media: backdrop,
        // Observations only: neither reading API commits preferences or sends stop.
        readBackgroundCloseState: () => Object.freeze({
          ...wallpaper.getCloseSnapshot(), background: settings.background,
          selectedSceneId: settings.weScene, intentRevision: userActionRevision,
          selectionRevision, controllerDisposed: disposed, hostRead: wallpaper.getHostCloseSnapshot(),
          fence: wallpaper.getCloseFenceSnapshot(),
        }),
        prepareBackgroundClose: options => backgroundFenceAction("prepareCloseFence", options),
        inspectBackgroundClose: options => backgroundFenceAction("inspectCloseFence", options),
        retryBackgroundClose: options => backgroundFenceAction("retryCloseFence", options),
        activateBackgroundSource: options => backgroundFenceAction("activateCloseFence", options),
        commitBackgroundClose,
        enableBackgroundSource,
        editBackgroundImage,
        editBackgroundVideo,
        refreshBackgroundCloseState: (options = {}) => {
          if (!options || typeof options !== "object" || Array.isArray(options)) return Promise.resolve(Object.freeze({ ok: false, error: "host-read-invalid-options" }));
          const preferences = settings, intent = userActionRevision, selection = selectionRevision, context = backgroundCloseContextRevision;
          return wallpaper.readHostCloseState({ signal: options.signal, timeoutMs: options.timeoutMs,
            isCurrent: () => !disposed && settings === preferences && intent === userActionRevision
              && selection === selectionRevision && context === backgroundCloseContextRevision });
        },
        wallpaper: {
          // The settings UI talks to the public controller only. Every explicit action marks
          // the user's intent, which is what cancels a pending automatic start.
          ...wallpaper,
          start: (scene = "lucy", mode = DEFAULT_PLAYBACK_MODE) => {
            userActionRevision++;
            return wallpaper.start(scene, mode);
          },
          restart: (scene = "lucy", mode = DEFAULT_PLAYBACK_MODE) => {
            userActionRevision++;
            return wallpaper.restart(scene, mode);
          },
          stop: (reason = "user") => {
            userActionRevision++;
            return wallpaper.stop(reason);
          },
        },
        presets: {
          getSnapshot: () => presets,
          subscribe: (listener) => {
            presetListeners.add(listener);
            return () => presetListeners.delete(listener);
          },
          get: (sceneId) => {
            if (!sceneId || !isSceneId(sceneId)) return null;
            const entry = presets.entries[sceneId];
            return entry ? { ...entry } : null;
          },
          getAll: () => {
            const result = {};
            for (const [k, v] of Object.entries(presets.entries)) {
              result[k] = { ...v };
            }
            return result;
          },
          resolveTarget: resolvePresetTarget,
          save: (sceneId) => {
            const target = checkPresetTarget(sceneId);
            if (!target.ok) return target;
            const entry = {
              brightness: clampRange("brightness", settings.brightness),
              mask: clampRange("mask", settings.mask),
              blur: clampRange("blur", settings.blur),
              surface: clampRange("surface", settings.surface),
            };
            const nextEntries = { ...presets.entries, [target.targetId]: Object.freeze(entry) };
            const nextPresets = Object.freeze({ version: 1, entries: Object.freeze(nextEntries) });
            if (!persistPresets(nextPresets)) {
              return { ok: false, error: "storage-failed" };
            }
            presets = nextPresets;
            notifyPresetListeners();
            return { ok: true, targetId: target.targetId, preset: entry };
          },
          apply: (sceneId) => {
            const target = checkPresetTarget(sceneId);
            if (!target.ok) return target;
            const entry = presets.entries[target.targetId];
            if (!entry) return { ok: false, error: "preset-missing" };
            const nextSettings = normalizeSettings({
              ...settings,
              brightness: entry.brightness,
              mask: entry.mask,
              blur: entry.blur,
              surface: entry.surface,
            });
            const hasChanges = Object.keys(nextSettings).some((k) => nextSettings[k] !== settings[k]);
            settings = nextSettings;
            persistSettings(settings);
            try {
              projectSettings(settings);
              backdrop.update(settings, themeSignal.getSnapshot());
            } finally {
              // Restore can change real preferences before projection fails.
              if (hasChanges) notifySettingsListeners();
            }
            return { ok: true, targetId: target.targetId, preset: entry, settings: { ...settings } };
          },
          remove: (sceneId) => {
            const target = checkPresetTarget(sceneId);
            if (!target.ok) return target;
            if (!presets.entries[target.targetId]) return { ok: false, error: "preset-missing" };
            const nextEntries = { ...presets.entries };
            delete nextEntries[target.targetId];
            const nextPresets = Object.freeze({ version: 1, entries: Object.freeze(nextEntries) });
            if (!persistPresets(nextPresets)) {
              return { ok: false, error: "storage-failed" };
            }
            presets = nextPresets;
            notifyPresetListeners();
            return { ok: true, targetId: target.targetId };
          },
        },
        read: () => ({ ...settings }),
        getSettingsSnapshot: () => settingsSnapshot,
        subscribeSettings: (listener) => {
          settingsListeners.add(listener);
          return () => settingsListeners.delete(listener);
        },
        set: (key, value) => {
          if (disposed || !isValidSetting(key, value)) return { ...settings };
          // Picking the next scene is manual intent; a late automatic-start answer must not apply it.
          if (key === "weScene") userActionRevision++;
          if (key === "background") selectionRevision++;
          let patch = { [key]: value };
          if (key === "opaqueChat") {
            patch = { opaqueChat: value, chatBackdrop: value ? 100 : 0 };
          } else if (key === "chatBackdrop") {
            const clamped = clampRange("chatBackdrop", value);
            patch = { chatBackdrop: clamped, opaqueChat: clamped === 100 };
          }
          const nextSettings = normalizeSettings({ ...settings, ...patch });
          const hasChanges = Object.keys(nextSettings).some((k) => nextSettings[k] !== settings[k]);

          // A mode change cancels any automatic start that is still waiting for the host; it
          // does not restart the run that is already active (that keeps its own mode).
          if (key === "weMode") playbackModeRevision++;
          // Leaving the Wallpaper Engine source stops this round's window before any
          // other background is presented; switching back never auto-restarts it.
          if (key === "background") {
            userActionRevision++;
            if (value !== "wallpaper") wallpaper.stop("background-changed").catch(() => {});
          }

          if (!hasChanges) {
            return { ...settings };
          }

          settings = nextSettings;
          persistSettings(settings);
          projectSettings(settings);
          try {
            if (key === "theme") ctx.theme.setTheme(selectedThemeId(settings));
            backdrop.update(settings, themeSignal.getSnapshot());
          } finally {
            // Runtime failure must not leave the published snapshot behind the saved preference.
            notifySettingsListeners();
          }
          return { ...settings };
        },
        reset: () => {
          if (disposed) return { ...settings };
          selectionRevision++;
          userActionRevision++;
          wallpaper.stop("reset").catch(() => {});
          settings = { ...DEFAULT_SETTINGS };
          persistSettings(settings);
          projectSettings(settings);
          ctx.theme.setTheme(selectedThemeId(settings));
          backdrop.update(settings, themeSignal.getSnapshot());
          notifySettingsListeners();
          return { ...settings };
        },
        async importMedia(kind, file) {
          const revision = selectionRevision;
          const saved = await backdrop.store(kind, file);
          if (saved && !disposed && revision === selectionRevision) return controller.set("background", kind);
          return { ...settings };
        }
      };
      const syncActiveMarker = (snapshot) => {
        backgroundCloseContextRevision++;
        const mistActive = snapshot.active.id === THEME_ID;
        const abyssActive = snapshot.active.id === ABYSS_THEME_ID;
        document.body.classList.toggle(ACTIVE_CLASS, mistActive);
        document.body.classList.toggle(ABYSS_ACTIVE_CLASS, abyssActive);
        themeSignal.set(MANAGED_THEME_IDS.has(snapshot.active.id));
        backdrop.update(settings, themeSignal.getSnapshot());
      };

      ctx.effect(() => () => { disposed = true; selectionRevision++; presetListeners.clear(); settingsListeners.clear(); }, "whale: controller lifetime");

      // The sidebar's optional dependency generation must not own the shared player/theme.
      const editorGate = WM_NATIVE_SIDEBAR.createAppearanceEditorGate({
        readBridge: () => {
          const state = appearanceBridge.getSnapshot();
          return state.windowStateKnown ? state : null;
        },
        dock: () => appearanceBridge.requestDock(),
      });
      ctx.effect(() => () => editorGate.dispose(), "whale: editor admission lifetime");
      const nativeSidebar = WM_NATIVE_SIDEBAR.attachNativeAppearanceSidebar({ ctx, React, controller, editorGate,
        loadPreview: (id, options) => appearanceBridge.fetchPreviewBlob(id, options),
        requestAuthor: (...args) => appearanceBridge.requestAuthor(...args),validateValue:WM_AUTHOR_PANEL.validateAuthorValue });
      ctx.effect(() => nativeSidebar.dispose, "whale: native sidebar lifetime");

      // Auto playback: the persisted choice is only a statement about the NEXT DSH start.
      // This effect fires at most once per page lifetime, only when the source and the theme
      // still apply and the host says the scene is available. A manual stop stays stopped:
      // nothing here re-runs on a settings change, a theme re-sync or a re-mounted component.
      ctx.effect(() => {
        // The choice is frozen here, at the start of this DSH session: toggling the checkbox
        // later only saves the NEXT launch and must never start playback in this one.
        const autoStartWanted = settings.weAutoStart === true && settings.weMode === "daily"
          // An unverified library wallpaper is manual-only: it must never start by itself on the
          // strength of one successful run. Only the accepted sample keeps its automatic path.
          && VERIFIED_SCENE_IDS.includes(settings.weScene);
        let cancelled = false;
        let starting = false;
        let started = false;
        // Any explicit user action invalidates the automatic request that is still waiting,
        // so a late host answer can never restart what the user just stopped. Leaving the daily
        // mode also counts as intent: a trip to preview and back must cancel the old request,
        // because checking only the final mode would let it through again.
        const actionsAtStart = userActionRevision;
        const modeAtStart = playbackModeRevision;
        let retry = 0;
        const timers = new Set();
        const deadline = Date.now() + AUTO_START_WINDOW_MS;
        const eligible = () => !cancelled && !disposed && !started && autoStartWanted
          && userActionRevision === actionsAtStart && playbackModeRevision === modeAtStart
          && settings.background === "wallpaper" && settings.weMode === "daily"
          && themeSignal.getSnapshot();
        /** The declared window is the whole budget: nothing may start after it has passed. */
        const windowOpen = () => Date.now() < deadline;
        const remainingMs = () => Math.max(0, deadline - Date.now());
        const clearTimers = () => {
          for (const timer of timers) clearTimeout(timer);
          timers.clear();
        };
        const schedule = (delay) => {
          const timer = setTimeout(() => { timers.delete(timer); attempt().catch(() => {}); }, delay);
          timers.add(timer);
        };
        // A host that answers "not ready" gets another bounded try inside the total window, so
        // a late-ready host still starts exactly one run and a dead one gives up cleanly. The
        // backoff keeps its usual interval but never reaches past the window.
        const scheduleRetry = () => {
          if (!eligible() || retry >= AUTO_START_MAX_ATTEMPTS || !windowOpen()) return;
          retry += 1;
          schedule(Math.min(1500, remainingMs()));
        };
        const attempt = async () => {
          // The deadline also bounds the attempt itself: a timer that fired just before the
          // window closed must not begin a new query.
          if (!eligible() || starting || !windowOpen()) return;
          starting = true;
          try {
            // A readiness query is bounded twice over: by the read limit and by what is left of
            // the total window, so a query started inside the window cannot answer after it.
            const host = await wallpaper.loadHostStatus({ timeoutMs: Math.min(HOST_STATUS_READ_MS, remainingMs()) });
            if (!eligible()) return;
            // A reply that arrives after the window (the read was cut at the deadline) is too
            // late to start anything, and there is nothing left to retry.
            if (!windowOpen()) { clearTimers(); return; }
            if (!host || host.available !== true) { scheduleRetry(); return; }
            started = true;
            await wallpaper.start(settings.weScene, settings.weMode);
          } finally { starting = false; }
        };
        const run = () => {
          if (!eligible() || starting || timers.size > 0) return;
          if (retry >= AUTO_START_MAX_ATTEMPTS || !windowOpen()) return;
          retry += 1;
          schedule(retry === 1 ? 300 : 1500);
        };
        // The theme becomes active slightly after boot, so wait for its signal instead of
        // polling; the retries cover a host that answers "not ready" for a little while.
        const unsubscribeTheme = themeSignal.subscribe(run);
        run();
        return () => {
          cancelled = true;
          unsubscribeTheme();
          clearTimers();
        };
      }, "whale: wallpaper auto playback");

      ctx.effect(() => {
        const disposeMist = ctx.theme.register(theme);
        const disposeAbyss = ctx.theme.register(abyssTheme);
        ctx.theme.setTheme(selectedThemeId(settings));
        return () => {
          disposeAbyss();
          disposeMist();
        };
      }, "whale: theme registration");

      ctx.effect(() => {
        // Current Harness releases may re-apply their persisted preference when
        // model settings change. Retain the selected Whale theme for the whole
        // plugin lifetime instead of only during the first paint.
        let queued = false;
        const off = ctx.on("theme/change", (snapshot) => {
          const desiredThemeId = selectedThemeId(settings);
          if (snapshot.active.id === desiredThemeId || queued) return;
          queued = true;
          queueMicrotask(() => {
            queued = false;
            if (disposed) return;
            let current = ctx.theme.getTheme();
            const currentDesiredThemeId = selectedThemeId(settings);
            if (current.active.id !== currentDesiredThemeId) {
              ctx.theme.setTheme(currentDesiredThemeId);
              current = ctx.theme.getTheme();
            }
            syncActiveMarker(current);
          });
        });
        const receiveThemeReset = (event) => {
          if (qaEnabled) ctx.theme.setTheme(event.detail || "dark");
        };
        window.addEventListener("dsh-whale-mist:qa-theme-reset", receiveThemeReset);
        return () => {
          window.removeEventListener("dsh-whale-mist:qa-theme-reset", receiveThemeReset);
          off();
        };
      }, "whale: active theme retention");

      ctx.effect(() => {
        const previous = document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`);
        previous?.remove();
        const tag = document.createElement("style");
        tag.dataset.plugin = "dsh-whale-mist";
        tag.dataset.pluginCss = STYLE_ID;
        tag.textContent = css + Object.entries(PALETTES).map(([id, palette]) => paletteCss(id, palette)).join("\n") + backdropCss;
        document.head.appendChild(tag);
        return () => tag.remove();
      }, "whale-mist: glass material stylesheet");

      ctx.effect(() => {
        syncActiveMarker(ctx.theme.getTheme());
        const off = ctx.on("theme/change", syncActiveMarker);
        return () => {
          off();
          document.body.classList.remove(ACTIVE_CLASS);
          document.body.classList.remove(ABYSS_ACTIVE_CLASS);
          themeSignal.set(false);
        };
      }, "whale: active theme marker");

      ctx.effect(() => {
        projectSettings(settings);
        return clearProjection;
      }, "whale-mist: appearance projection");

      ctx.effect(() => {
        backdrop.start(settings, themeSignal.getSnapshot());
        return () => backdrop.stop();
      }, "whale: local image and video background");

      ctx.effect(() => {
        // Ask the Host once whether the preview can run at all, so the settings row can
        // explain a missing helper or a missing sample instead of failing on first click.
        wallpaper.loadHostStatus().catch(() => {});
        return () => wallpaper.dispose();
      }, "whale: wallpaper engine preview lifetime");

      // Detachable Appearance Seam & Bridge State
      const bridgeListeners = new Set();
      let bridgeClientInstance = null;
      const bridgeState = {
        mode: DETACHABLE_MODES.DOCKED,
        isOpen: false,
        unconfirmedCleanup: false,
        windowStateKnown: false,
        lastError: null,
      };
      let cachedBridgeSnapshot = Object.freeze({ ...bridgeState });

      const notifyBridge = () => {
        cachedBridgeSnapshot = Object.freeze({ ...bridgeState });
        for (const l of bridgeListeners) {
          try { l(cachedBridgeSnapshot); } catch {}
        }
      };

      let catalogReadRequest = null;
      const cancelCatalogRead = () => {
        const req = catalogReadRequest;
        if (!req) return;
        catalogReadRequest = null;
        clearTimeout(req.timer);
        req.abort.abort();
      };
      const ensureCatalogRead = () => {
        if (disposed || bridgeState.mode !== DETACHABLE_MODES.DOCKED || typeof controller.wallpaper?.readLibrary !== "function" || catalogReadRequest) return;
        const cache = controller.wallpaper.getLibrarySnapshot?.();
        if (cache?.loading === true || (cache?.state === "ready" && cache?.loaded === true)) return;
        const req = { abort: new AbortController(), timer: null };
        catalogReadRequest = req;
        req.timer = setTimeout(() => {
          if (catalogReadRequest === req) cancelCatalogRead();
        }, 4000);
        try {
          Promise.resolve(controller.wallpaper.readLibrary({ ensure: true, signal: req.abort.signal })).catch(() => {}).finally(() => {
            clearTimeout(req.timer);
            if (catalogReadRequest === req) catalogReadRequest = null;
          });
        } catch {
          clearTimeout(req.timer);
          if (catalogReadRequest === req) catalogReadRequest = null;
        }
      };
      ctx.effect(() => () => cancelCatalogRead());
      const appearanceBridge = {
        getSnapshot: () => cachedBridgeSnapshot,
        subscribe: (listener) => {
          bridgeListeners.add(listener);
          return () => bridgeListeners.delete(listener);
        },
        togglePanel: () => {
          bridgeState.isOpen = !bridgeState.isOpen;
          if (bridgeState.isOpen) ensureCatalogRead();
          else cancelCatalogRead();
          notifyBridge();
        },
        openPanel: () => {
          if (!bridgeState.isOpen) {
            bridgeState.isOpen = true;
            ensureCatalogRead();
            notifyBridge();
          }
        },
        closePanel: () => {
          cancelCatalogRead();
          if (bridgeState.isOpen) {
            bridgeState.isOpen = false;
            notifyBridge();
          }
        },
        requestDetach: async () => {
          if (!bridgeClientInstance) return { ok: false, error: 'bridge-not-connected' };
          return await bridgeClientInstance.requestDetach();
        },
        requestDock: async () => {
          if (!bridgeClientInstance) return { ok: false, error: 'bridge-not-connected' };
          return await bridgeClientInstance.requestDock();
        },
        fetchPreviewBlob: (sceneId, options) => {
          if (!bridgeClientInstance) return Promise.reject(new Error('bridge-not-connected'));
          return bridgeClientInstance.fetchPreviewBlob(sceneId, options);
        },
        requestAuthor: (route,payload,options) => bridgeClientInstance ? bridgeClientInstance.requestAuthor(route,payload,options) : Promise.reject(new Error('author-disconnected')),
        getClient: () => bridgeClientInstance,
      };

      const initBridge = async () => {
        let boot = typeof globalThis !== 'undefined' ? globalThis.__WHALE_DETACHABLE_BOOT__ : null;
        let port = boot?.port;
        let mainToken = boot?.mainToken;

        if (!mainToken && typeof fetch === 'function') {
          try {
            const resp = await fetch('/whale-appearance/bootstrap', { cache: 'no-store' });
            if (resp.ok) {
              const data = await resp.json();
              if (data.ok && data.port && data.mainToken) {
                port = data.port;
                mainToken = data.mainToken;
              }
            }
          } catch {}
        }

        if (port && mainToken && !disposed) {
          const baseUrl = `http://127.0.0.1:${port}`;
          const instanceId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `main-${Date.now()}`;
          bridgeClientInstance = createMainRendererBridgeClient({
            baseUrl,
            instanceId,
            mainToken,
            controller,
          });

          bridgeClientInstance.subscribe((state) => {
            bridgeState.generation = state.generation;
            bridgeState.revision = state.revision;
            bridgeState.mode = state.mode;
            bridgeState.unconfirmedCleanup = Boolean(state.unconfirmedCleanup);
            bridgeState.lastError = state.lastError;
            bridgeState.windowStateKnown = state.windowStateKnown === true && bridgeClientInstance.authorConnected === true;
            notifyBridge();
            editorGate.refresh();
          });

          await bridgeClientInstance.connect().catch(() => {});
        }
      };

      initBridge().catch(() => {});

      ctx.effect(() => () => {
        if (bridgeClientInstance) {
          bridgeClientInstance.dispose().catch(() => {});
        }
      }, "whale: detachable bridge lifetime");

      const ExclusiveAppearanceSettings = WM_NATIVE_SIDEBAR.createLegacyAppearanceBoundary({
        React, editorGate, Component: WhaleAppearanceSettings,
      });
      ctx.slots.inject("settings.general.item", () => ctx.slots.register({
        name: "settings.general.item",
        id: "whale-mist",
        order: 45,
        inject: () => ({ controller, editorGate })
      }, ExclusiveAppearanceSettings));

      ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
        name: "conversation.session.header.actions",
        id: "whale-session-status",
        order: -5,
        inject: () => ({ statusController: { theme: themeSignal, qaEnabled } })
      }, WhaleSessionStatus));

      ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
        name: "conversation.session.header.actions",
        id: "whale-appearance-trigger",
        order: -4,
      }, nativeSidebar.Trigger));
    }

    exports.WhaleAuthorProperties = WhaleAuthorProperties;
    exports.WM_AUTHOR_PANEL = WM_AUTHOR_PANEL;
    exports.createWallpaperEngine = createWallpaperEngine;
    exports.createBackdrop = createBackdrop;
    exports.inject = inject;
    exports.apply = apply;
    exports.deriveAccentValues = deriveAccentValues;
    exports.deriveButtonForeground = deriveButtonForeground;
    exports.deriveButtonHover = deriveButtonHover;
    exports.deriveInkColor = deriveInkColor;
    exports.contrastRatio = contrastRatio;
    exports.relativeLuminance = relativeLuminance;
    exports.HEX_COLOR_PATTERN = HEX_COLOR_PATTERN;
    exports.createMainRendererBridgeClient = createMainRendererBridgeClient;
    exports.executeAuthoritativeAction = executeAuthoritativeAction;
    exports.buildAppearanceSnapshot = buildAppearanceSnapshot;
    exports.WhaleHeaderAppearanceTrigger = WhaleHeaderAppearanceTrigger;
    exports.WhaleDockedAppearancePanel = WhaleDockedAppearancePanel;
    exports.DETACHABLE_MODES = DETACHABLE_MODES;
    return module.exports;
  }
});
