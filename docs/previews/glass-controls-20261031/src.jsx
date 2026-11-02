// Throwaway material comparison. Same layout and dimensions isolate the material variable.
// No DSH routes, credentials, settings storage, or wallpaper controls are connected.
import React, {useEffect, useState, useRef, useId} from 'react';
import {createRoot} from 'react-dom/client';
import LiquidGlass from 'liquid-glass-react';

const variants = [
  ['A', '轻磨砂', '柔化控件背后的纹理，保留背景透色。'],
  ['B', '薄玻璃', '更通透的表面，只用细边缘分开前后层。'],
  ['C', '液态折射', '实际使用 liquid-glass-react，降低折射和高光强度。'],
];
const initial = new URLSearchParams(location.search);
const valid = (v) => variants.some(([k]) => k === v) ? v : 'B';
const zero = {x:0,y:0};
function Icon({name}) {
  const paths = {play:'M8 5l11 7-11 7Z', stop:'M6 6h12v12H6Z', chevron:'m9 5 7 7-7 7', more:'M5 12h.01M12 12h.01M19 12h.01', close:'m6 6 12 12M18 6 6 18', back:'m14 6-6 6 6 6', refresh:'M20 8a8 8 0 1 0 0 8M20 3v5h-5', check:'m5 12 4 4L19 6', image:'M3 3h18v18H3ZM3 17l6-7 5 5 3-3 4 5'};
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill={name==='play'||name==='stop'?'currentColor':'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]}/></svg>;
}
function Glass({variant, radius=12}) {
  const host=useRef(null);
  useEffect(()=>{if(variant!=='C')return;let frame;const observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));});observer.observe(host.current);return()=>{observer.disconnect();cancelAnimationFrame(frame);};},[variant]);
  return variant==='C' ? <div ref={host} className="liquid-host" style={{clipPath:`inset(0 round ${radius}px)`}} aria-hidden="true"><LiquidGlass
    className="liquid-surface" style={{position:'absolute',top:'50%',left:'50%'}}
    displacementScale={8} blurAmount={0.025} saturation={115} aberrationIntensity={0}
    elasticity={0} cornerRadius={radius} padding="0px" globalMousePos={zero} mouseOffset={zero}
    mode="standard"><span className="glass-spacer"/></LiquidGlass></div>
    : <span className="css-glass" aria-hidden="true"/>;
}
function ControlButton({variant, children, className='', ...props}) {
  return <button className={'control '+className} {...props}><Glass variant={variant}/><span className="control-label">{children}</span></button>;
}
function Switch({variant, label, checked, onChange}) {
  return <div className="row"><span>{label}</span><button type="button" className={'switch '+(checked?'on':'')} role="switch" aria-label={label} aria-checked={checked} onClick={()=>onChange(!checked)}>
    <Glass variant={variant} radius={99}/><span className="switch-thumb"/>
  </button></div>;
}
function Slider({variant,label,value,max=100,onChange,suffix='%'}) {
  return <div className="slider-row"><div className="row"><label>{label}</label><output>{value}{suffix}</output></div>
    <div className="slider"><div className="slider-track"><Glass variant={variant} radius={99}/></div><div className="slider-fill" style={{width:`${value/max*100}%`}}/>
      <div className="slider-handle" style={{left:`calc(${value/max*100}% + ${12-value/max*24}px)`}}><Glass variant={variant} radius={99}/></div>
      <input aria-label={label} type="range" min="0" max={max} value={value} onChange={e=>onChange(+e.target.value)}/>
    </div></div>;
}
function Sidebar({variant, material, light, onThemeChange}) {
  const [playing,setPlaying]=useState(false), [particles,setParticles]=useState(true), [lightOn,setLight]=useState(true);
  const [brightness,setBrightness]=useState(100), [opacity,setOpacity]=useState(70), [page,setPage]=useState('wallpaper'), [menu,setMenu]=useState(false);
  useEffect(()=>{const h=e=>{if(e.key==='Escape')setMenu(false);};document.addEventListener('keydown',h);return()=>document.removeEventListener('keydown',h);},[]);
  return <section className={'sidebar '+(material?'frosted':'')} data-variant={variant} aria-label={`${variants.find(v=>v[0]===variant)[1]}控件样板`}>
    <div className="sidebar-top"><span>外观</span><small>材质样板</small></div>
    <nav className="tabs" aria-label="设置页"><button aria-current={page==='wallpaper'?'page':undefined} onClick={()=>setPage('wallpaper')}>壁纸</button><button aria-current={page==='interface'?'page':undefined} onClick={()=>setPage('interface')}>界面</button></nav>
    <div className="current"><div className="thumb"><span>W</span></div><div className="wallpaper-title"><strong>Whale · 蓝色潮汐</strong><small><i className={playing?'playing':''}/>{playing?'预览中':'未播放'}</small></div>
      <ControlButton variant={variant} className={'play '+(playing?'':'accent')} onClick={()=>setPlaying(!playing)}><Icon name={playing?'stop':'play'}/>{playing?'停止':'播放'}</ControlButton></div>
    <div className="panel-body">
    {page==='wallpaper'?<>
      <div className="section-title"><h2>画面</h2><div className="menu-anchor"><button className="icon-button" aria-label="更多画面选项" aria-expanded={menu} onClick={()=>setMenu(!menu)}><Icon name="more"/></button>
        {menu&&<><button className="dismiss" aria-label="关闭菜单" onClick={()=>setMenu(false)}/><div className="popover" role="menu"><button role="menuitem" onClick={()=>{setBrightness(100);setOpacity(70);setMenu(false);}}>恢复画面默认值</button><button role="menuitem" onClick={()=>{setPlaying(false);setMenu(false);}}>停止预览</button></div></>}
      </div></div>
      <Slider variant={variant} label="背景亮度" value={brightness} max={120} onChange={setBrightness}/>
      <Slider variant={variant} label="界面不透明度" value={opacity} onChange={setOpacity}/>
      <div className="divider"/><div className="section-title"><h2>作者参数</h2><button className="icon-button" aria-label="恢复样板参数" onClick={()=>{setParticles(true);setLight(true);}}><Icon name="refresh"/></button></div>
      <Switch variant={variant} label="粒子" checked={particles} onChange={setParticles}/><Switch variant={variant} label="光照" checked={lightOn} onChange={setLight}/>
      <div className="divider"/><div className="row saved"><span><Icon name="check"/>本壁纸外观</span><ControlButton variant={variant} onClick={e=>{e.currentTarget.querySelector('.save-text').textContent='已保存';}}><span className="save-text">保存预设</span></ControlButton></div>
    </>:<><div className="section-title"><h2>主题与配色</h2></div><div className="row"><span>主题</span><div className="segments"><ControlButton variant={variant} aria-pressed={!light} onClick={()=>onThemeChange('dark')}>鲸渊</ControlButton><ControlButton variant={variant} aria-pressed={light} onClick={()=>onThemeChange('light')}>鲸雾</ControlButton></div></div><p className="hint">切换明暗背景，观察控件在不同底色下的效果。</p><Switch variant={variant} label="文字增强" checked={particles} onChange={setParticles}/><Slider variant={variant} label="聊天底色" value={opacity} onChange={setOpacity}/></>}
    </div><footer className="panel-foot">仅演示控件反馈，不控制实际壁纸</footer>
  </section>;
}
function Landscape(){const id=useId();return <svg className="landscape" viewBox="0 0 1440 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
  <linearGradient id={'sky'+id} x2="0" y2="1"><stop stopColor="var(--sky-a)"/><stop offset="1" stopColor="var(--sky-b)"/></linearGradient>
  <linearGradient id={'water'+id} x2="1" y2="1"><stop stopColor="var(--water-a)"/><stop offset="1" stopColor="var(--water-b)"/></linearGradient>
  <radialGradient id={'sun'+id}><stop stopColor="var(--sun)" stopOpacity=".8"/><stop offset="1" stopColor="var(--sun)" stopOpacity="0"/></radialGradient>
  <pattern id={'lines'+id} width="44" height="44" patternUnits="userSpaceOnUse"><path d="M0 44 44 0M-22 22 22-22M22 66 66 22" stroke="var(--line)" strokeWidth="1.4" opacity=".28"/></pattern>
</defs><path fill={`url(#sky${id})`} d="M0 0h1440v1000H0Z"/><ellipse cx="1030" cy="230" rx="400" ry="500" fill={`url(#sun${id})`}/>
<path d="M-80 800C60 390 420 550 620 230S1110 120 1500-140V1000H0Z" fill={`url(#water${id})`}/>
{Array.from({length:18},(_,i)=><path key={i} d={`M${-150+i*38} 1100C${100+i*20} ${500+i*20} ${600+i*12} ${690-i*12} ${640+i*25} ${200-i*14}S${1300+i*22} 300 1540 ${-80+i*10}`} fill="none" stroke="var(--line)" strokeWidth={i%4===0?2.4:1} opacity={i%4===0?.45:.15}/>)}
<path d="M0 0h1440v1000H0Z" fill={`url(#lines${id})`} className="complex-pattern"/>
</svg>;}
function App(){
  const [variant,setVariant]=useState(valid(initial.get('variant'))),[background,setBackground]=useState('dark'),[frosted,setFrosted]=useState(false),[compare,setCompare]=useState(false),[photo,setPhoto]=useState('');
  const index=variants.findIndex(v=>v[0]===variant);
  const choose=v=>{setVariant(v);const u=new URL(location.href);u.searchParams.set('variant',v);history.replaceState(null,'',u);};
  useEffect(()=>{const h=e=>{if(['INPUT','TEXTAREA','BUTTON','SELECT'].includes(e.target.tagName)||e.target.isContentEditable)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();choose(variants[(index+(e.key==='ArrowLeft'?2:1))%3][0]);}};document.addEventListener('keydown',h);return()=>document.removeEventListener('keydown',h);},[index]);
  useEffect(()=>()=>{if(photo)URL.revokeObjectURL(photo);},[photo]);
  return <div className={`app ${background} ${compare?'compare':''}`}>
    <header className="lab-header"><div><span className="brand">Whale</span><span className="header-caption">控件材质对照</span></div><a href="https://github.com/rdev/liquid-glass-react" target="_blank" rel="noreferrer">参考资源 ↗</a></header>
    <main><div className="settings"><div className="settings-copy"><span className="eyebrow">MATERIAL STUDY / 01</span><h1>让控件像玻璃，<br/>让壁纸透出来。</h1><p>同样的字号、尺寸和布局。<br/>只比较材质，按钮和滑块可以直接试。</p></div>
      <div className="settings-group"><span className="setting-label">背景</span><div className="background-options">{[['dark','暗色'],['light','明亮'],['busy','复杂']].map(([k,t])=><button key={k} aria-pressed={background===k} onClick={()=>{setBackground(k);setPhoto('');}}><span className={'swatch '+k}/>{t}</button>)}</div><label className="image-picker"><Icon name="image"/>换一张自己的图片<input aria-label="选择背景图片" type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)setPhoto(URL.createObjectURL(f));}}/></label></div>
      <div className="settings-group"><label className="check-setting"><input type="checkbox" checked={frosted} onChange={e=>setFrosted(e.target.checked)}/>整栏毛玻璃 <small>默认通透</small></label><label className="check-setting"><input type="checkbox" checked={compare} onChange={e=>setCompare(e.target.checked)}/>并排比较三种材质</label></div>
      <p className="material-note"><strong>{variants[index][1]}</strong>{variants[index][2]}</p>
    </div><div className="stage" data-background={background}><Landscape/>{photo&&<img className="custom-bg" src={photo} alt="自选背景"/>}<div className="stage-caption"><span>Whale / Appearance</span><small>独立交互样板</small></div>
      <div className="panels">{(compare?variants:[variants[index]]).map(([k,title])=><div className="panel-wrap" key={k}>{compare&&<><Landscape/>{photo&&<img className="custom-bg" src={photo} alt="自选背景对照"/>}<div className="variant-title">{k} <strong>{title}</strong></div></>}<Sidebar key={compare?'comparison':'single'} variant={k} material={frosted} light={background==='light'} onThemeChange={setBackground}/></div>)}</div>
    </div></main>
    <nav className="prototype-switcher" aria-label="材质切换"><button aria-label="上一种材质" onClick={()=>choose(variants[(index+2)%3][0])}>←</button>{variants.map(([k,title])=><button key={k} aria-pressed={variant===k} onClick={()=>choose(k)}><small>{k}</small>{title}</button>)}<button aria-label="下一种材质" onClick={()=>choose(variants[(index+1)%3][0])}>→</button></nav>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
