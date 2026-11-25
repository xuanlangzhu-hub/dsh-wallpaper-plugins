// Numeric renderer metrics only; no screen position inference or automatic sampling.
const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=16384;
const revision=n=>Number.isSafeInteger(n)&&n>=0;
export function observeViewport(view,{ownerGeneration,layoutRevision},now=Date.now()){
 if(!Number.isSafeInteger(ownerGeneration)||ownerGeneration<1||!revision(layoutRevision)||!Number.isFinite(now))throw Error('viewport-binding');
 const width=view?.innerWidth,height=view?.innerHeight,dpr=view?.devicePixelRatio,v=view?.visualViewport;
 if(!positive(width)||!positive(height)||!Number.isFinite(dpr)||dpr<0.25||dpr>8||!v||!positive(v.width)||!positive(v.height)||!Number.isFinite(v.scale)||v.scale<=0||!Number.isFinite(v.offsetLeft)||!Number.isFinite(v.offsetTop))throw Error('viewport-measurement');
 return Object.freeze({scope:'fixed-canvas-renderer-viewport-v1',ownerGeneration,layoutRevision,sampledAt:now,width,height,dpr,visualWidth:v.width,visualHeight:v.height,visualScale:v.scale,offsetLeft:v.offsetLeft,offsetTop:v.offsetTop});
}
export function compareViewport(native,viewport,{ownerGeneration,layoutRevision,now=Date.now(),maxAgeMs=250}={}){
 if(!Number.isSafeInteger(ownerGeneration)||ownerGeneration<1||!revision(layoutRevision)||!Number.isFinite(now)||!Number.isFinite(maxAgeMs)||maxAgeMs<1||maxAgeMs>1000)throw Error('comparison-binding');
 if(native?.ok!==true||native.scope!=='fixed-canvas-window-geometry-v1'||native.physicalCoordinates!==true||native.localThreadDpiContextRestored!==true||native.rendererContentConfirmed!==false||viewport?.scope!=='fixed-canvas-renderer-viewport-v1')throw Error('comparison-observation');
 for(const x of [native,viewport])if(x.ownerGeneration!==ownerGeneration||x.layoutRevision!==layoutRevision)throw Error('comparison-stale-generation');
 const nativeAt=Date.parse(native.sampledAt);for(const at of [nativeAt,viewport.sampledAt])if(!Number.isFinite(at)||at>now||now-at>maxAgeMs)throw Error('comparison-stale-sample');
 // Revalidate numeric input even when it arrived by JSON rather than observeViewport.
 const checked=observeViewport({innerWidth:viewport.width,innerHeight:viewport.height,devicePixelRatio:viewport.dpr,visualViewport:{width:viewport.visualWidth,height:viewport.visualHeight,scale:viewport.visualScale,offsetLeft:viewport.offsetLeft,offsetTop:viewport.offsetTop}},{ownerGeneration,layoutRevision},viewport.sampledAt);
 const client=native.geometry?.nativeClientPhysical,dpi=native.geometry?.windowDpi;
 if(!client||!['left','top','width','height'].every(k=>Number.isSafeInteger(client[k]))||!positive(client.width)||!positive(client.height)||!Number.isSafeInteger(dpi)||dpi<24||dpi>768)throw Error('comparison-native-bounds');
 const unpanned=checked.visualScale===1&&checked.offsetLeft===0&&checked.offsetTop===0&&Math.abs(checked.visualWidth-checked.width)<=1&&Math.abs(checked.visualHeight-checked.height)<=1;
 const dimensionsMatch=unpanned&&Math.abs(client.width-checked.width*checked.dpr)<=1&&Math.abs(client.height-checked.height*checked.dpr)<=1;
 const monitorScaleMatch=Math.abs(checked.dpr-dpi/96)<0.001;
 return Object.freeze({dimensionsMatch,monitorScaleMatch,unpanned,reason:!unpanned?'visual-viewport-transformed':!dimensionsMatch?'native-client-and-viewport-size-differ':!monitorScaleMatch?'renderer-scale-differs-from-window-dpi':'size-consistent-origin-unproven',rendererContentConfirmed:false,fixedCanvasReady:false});
}
