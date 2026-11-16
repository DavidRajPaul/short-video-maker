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
