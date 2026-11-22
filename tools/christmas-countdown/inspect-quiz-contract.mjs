const key=process.env.N8N_API_KEY;
if(!key)throw Error("N8N_API_KEY missing");
const res=await fetch("https://meetdavidraj7.n8n-wsk.com/api/v1/workflows/nB10Ub0ZIxCe5gHI",{headers:{"X-N8N-API-KEY":key},signal:AbortSignal.timeout(30000)});
if(!res.ok)throw Error("n8n returned HTTP "+res.status);
const w=await res.json();
const wanted = [
  "Choose Unused Verified Puzzle","Create PRIVATE Quiz Video — Railway","Store PRIVATE Render ID",
  "Quiz Wait for Render","Quiz Check Railway Status","Quiz Render Ready?",
  "Quiz Abort Failed or Excessive Render","Quiz Archive MP4 to ImageKit",
  "Quiz Verify Permanent MP4 URL","QUIZ NO PUBLISHING - Manual Platform QA Gate",
  "Build Shared Publisher Input - VALIDATION ONLY","Call Shared Publisher - VALIDATION ONLY",
  "Verify Shared Publisher Handshake","Prepare youtube Public Quiz Input","Record youtube Delivery Result",
];
const out=wanted.map(name=>{
 const n=w.nodes.find(n=>n.name===name);
 if(!n)return {name,error:"missing"};
 const params=n.parameters||{},js=String(params.jsCode||"");
 const refs=[...js.matchAll(/\$\(['"]([^'"]+)['"]\)/g)].map(m=>m[1]);
 const objectRefs=[...js.matchAll(/\$json(?:\.([A-Za-z_]\w*))?/g)].map(m=>m[1]);
 const fields=[...js.matchAll(/(?:\b|\.)(?:puzzleId|renderId|attempt|videoUrl|videoId|archive|title|description|status|mp4Url|url|imagekit|mode)\b/gi)].map(m=>m[0]);
 const urlValue=String(params.url||"");
 const jsonBody=String(params.jsonBody||"");
 const bodyParams=Array.isArray(params.bodyParameters?.parameters)?params.bodyParameters.parameters.map(p=>({name:p.name,valueLength:String(p.value||"").length})):[];
 const urlPath=urlValue?urlValue.replace(/(?:https?:)?\/\/[^/]+/g,"//REDACTED_HOST").slice(0,350):undefined;
 return {name,type:n.type,refs:[...new Set(refs)],jsonFields:[...new Set(objectRefs)],usedFields:[...new Set(fields)],
   paramsKeys:Object.keys(params),urlPath,bodyKeys:bodyParams,
   jsonBodyLength:jsonBody.length,jsLength:js.length,hasSecretWords:/\b(token|Authorization|apiKey|password|secret)\b/i.test(js)};
});
console.log("SAFE_CONTRACT="+JSON.stringify(out));
