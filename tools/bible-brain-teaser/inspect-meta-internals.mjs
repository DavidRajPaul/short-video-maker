
const API="https://meetdavidraj7.n8n-wsk.com/api/v1",key=process.env.N8N_API_KEY;
if(!key)throw Error("secret missing");
const r=await fetch(API+"/workflows/TCMiKoaj2xkNvK1L",{headers:{"X-N8N-API-KEY":key}});
if(!r.ok)throw Error("API "+r.status);
const wf=await r.json();
const names=["FB Reel Build Finish Payload","FB Reel Finish Upload","FB Reel Store ID","FB Store Reel ID","FB Reel Ready?","FB Check Reel Status","FB Normalize Reel Status","IG Create Container","IG Store Container ID","IG Check Status","IG Normalize Status","IG Container Ready?","IG Publish","IG Read Published Reel Permalink","IG Store Result","PUBLISHER SETTINGS - EDIT CLOUDINARY HERE"];
const strip=s=>String(s).replace(/(\b(?:EAA|IGQ)[A-Za-z0-9_-]{15,})/g,"[REDACTED]").replace(/(access_token[=:"']\s*)[A-Za-z0-9_-]{20,}/gi,"$1[REDACTED]");
for(const name of names){
 const n=wf.nodes.find(n=>n.name===name);
 if(!n){console.log("MISSING",name);continue;}
 const p=n.parameters??{};
 const out={name,type:n.type,keys:Object.keys(p),credentials:Object.keys(n.credentials??{}),disabled:n.disabled};
 if(name==="PUBLISHER SETTINGS - EDIT CLOUDINARY HERE"){
  out.jsCode=String(p.jsCode??"").split("\n").filter(l=>/publisherSettings|facebook|instagram|ig|fb|token|pageId/i.test(l)).map(l=>l.replace(/(?<=[:=])\s*['"][^'"]{24,}['"]/g," '[REDACTED]'")).slice(0,25);
 } else if(n.type==="n8n-nodes-base.code"){
  out.jsCode=strip(p.jsCode).slice(0,6500);
 }else{
  out.url=strip(p.url??"");
  out.method=p.method;
  out.options=p.options;
  out.q=p.queryParameters?.parameters?.map(x=>({name:x.name,value:/token|auth/i.test(x.name)?"[TOKEN EXPRESSION]":strip(x.value).slice(0,350)}));
  out.headers=p.headerParameters?.parameters?.map(x=>({name:x.name,value:/token|auth/i.test(x.name)?"[TOKEN EXPRESSION]":strip(x.value).slice(0,350)}));
  out.b=p.bodyParameters?.parameters?.map(x=>({name:x.name,value:/token|auth/i.test(x.name)?"[TOKEN EXPRESSION]":strip(x.value).slice(0,350)}));
  out.jsonBody=strip(p.jsonBody??"");
 }
 console.log("NODE "+JSON.stringify(out));
}
