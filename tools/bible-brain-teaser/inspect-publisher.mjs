const base="https://meetdavidraj7.n8n-wsk.com/api/v1";
const key=process.env.N8N_API_KEY;
if(!key)throw Error("N8N_API_KEY missing");
const ids=["TCMiKoaj2xkNvK1L","iEiu5vka5sAVMxMl"];
for(const id of ids){
 const res=await fetch(base+"/workflows/"+id,{headers:{"X-N8N-API-KEY":key},signal:AbortSignal.timeout(30000)});
 if(!res.ok)throw Error(id+" API "+res.status);
 const w=await res.json();
 console.log("\nWORKFLOW",id,JSON.stringify({id:w.id,name:w.name,active:w.active,timezone:w.settings?.timezone,nodeCount:w.nodes?.length,connectionGroupCount:Object.keys(w.connections??{}).length}));
 for(const n of w.nodes??[]){
  const p=n.parameters??{};
  const url=typeof p.url==="string" && !p.url.includes("{{")?(() =>{try{const u=new URL(p.url);return u.hostname+u.pathname}catch{return "non-static"}})():"expression";
  console.log(JSON.stringify({name:n.name,type:n.type,disabled:n.disabled??false,credentialTypes:Object.keys(n.credentials??{}),operation:p.operation??null,resource:p.resource??null,method:p.method??null,url,params:Object.keys(p).filter(k=>!/token|secret|key|password|credential/i.test(k)).slice(0,22),next:(w.connections?.[n.name]?.main??[]).flat().filter(Boolean).map(c=>c.node)}));
 }
}


const targetNames=[
"Prepare YouTube Data","Upload a video","Edit Fields",
"FB Reel Start Upload","FB Re-Download MP4","FB Reel Upload Binary","FB Reel Build Finish Payload","FB Reel Finish Upload",
"IG Create Container","IG Store Container ID","IG Check Status","IG Publish",
"Upload Scenic Background to Cloudinary","PUBLISHER SETTINGS - EDIT CLOUDINARY HERE",
"Download MP4","YT Wait for Processing",
];
const source=await fetch(base+"/workflows/TCMiKoaj2xkNvK1L",{headers:{"X-N8N-API-KEY":key},signal:AbortSignal.timeout(30000)}).then(r=>r.json());
console.log("\nNODE CONFIG SHAPES - no secrets, values, or credential IDs");
for(const name of targetNames){
 const n=source.nodes.find(x=>x.name===name);
 if(!n){console.log(JSON.stringify({name,missing:true}));continue;}
 const p=n.parameters??{};
 const expressionRefs=new Set();
 function inspect(value){
  if(typeof value==="string")for(const m of value.matchAll(/\$\(['"]([^'"]+)['"]\)|\$node\[['"]([^'"]+)['"]\]/g))expressionRefs.add(m[1]??m[2]);
  else if(Array.isArray(value))value.forEach(inspect);
  else if(value && typeof value==="object")Object.values(value).forEach(inspect);
 }
 inspect(p);
 const names = p.queryParameters?.parameters?.map(x=>x.name)??[];
 const bodies = p.bodyParameters?.parameters?.map(x=>x.name)??[];
 const headers = p.headerParameters?.parameters?.map(x=>x.name)??[];
 console.log(JSON.stringify({name,resource:p.resource??null,operation:p.operation??null,method:p.method??null,authentication:p.authentication??null,genericAuthType:p.genericAuthType??null,contentType:p.contentType??null,sendBody:p.sendBody??false,specifyBody:p.specifyBody??null,responseFormat:p.options?.response?.responseFormat??null,dataPropertyName:p.options?.response?.outputPropertyName??null,params:Object.keys(p),queryNames:names,bodyNames:bodies,headerNames:headers,references:[...expressionRefs].sort(),binary:n.type==="n8n-nodes-base.httpRequest"?JSON.stringify(p.options??{}).includes("file")||JSON.stringify(p.options??{}).includes("binary"):false}));
}
