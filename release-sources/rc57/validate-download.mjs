export function validateDownload(text,build,validateSnapshot){
 if(typeof text!=='string'||Buffer.byteLength(text)>300000)throw Error('Diagnostic file too large');
 const v=JSON.parse(text),keys=x=>Object.keys(x??{}).sort().join(',');
 if(keys(v)!=='build,clockDomains,format,host,renderer'||v.format!=='whale-author-diagnostics-v1'||JSON.stringify(v.build)!==JSON.stringify(build)||keys(v.clockDomains)!=='crossProcessTiming,host,renderer'||v.clockDomains.renderer!=='renderer-local-monotonic'||v.clockDomains.host!=='host-local-monotonic'||v.clockDomains.crossProcessTiming!=='not-correlated')throw Error('Diagnostic envelope mismatch');
 const renderer=validateSnapshot(JSON.stringify(v.renderer),build.sources),host=validateSnapshot(JSON.stringify(v.host),build.sources);
 return{format:v.format,buildId:build.buildId,payloadVersion:build.payloadVersion,rendererTransactions:renderer.records.length,hostTransactions:host.records.length,rendererHistoryComplete:renderer.historyComplete,hostHistoryComplete:host.historyComplete,crossProcessTiming:'not-correlated',missingEventsProveNothing:true};
}
