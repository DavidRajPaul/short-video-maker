import {randomUUID} from "node:crypto";
const root="https://meetdavidraj7.n8n-wsk.com",api=root+"/api/v1",key=process.env.N8N_API_KEY;
if(!key)throw Error("Missing N8N_API_KEY");
const sleep=t=>new Promise(r=>setTimeout(r,t));
async function request(path,method="GET",data){
 const response=await fetch(api+path,{method,headers:{"X-N8N-API-KEY":key,accept:"application/json",...(data?{"content-type":"application/json"}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(30000)});
 const text=await response.text();if(!response.ok)throw Error(method+" "+path+" HTTP "+response.status+" "+text.slice(0,240));return text?JSON.parse(text):{};
}
const source=await request("/workflows/TCMiKoaj2xkNvK1L");
const src=name=>{
 const node=source.nodes.find(n=>n.name===name);
 if(!node)throw Error("Missing platform node "+name);
 return structuredClone(node);
};
const settings=src("PUBLISHER SETTINGS - EDIT CLOUDINARY HERE");
const yt=src("YT Check Processing");
const fb=src("FB Reel Start Upload");
const ig=src("IG Create Container");
const marker=randomUUID();
const webhook={id:randomUUID(),name:"QA API Webhook",type:"n8n-nodes-base.webhook",typeVersion:2.1,webhookId:randomUUID(),position:[100,200],parameters:{httpMethod:"POST",path:"bible-quiz-platform-auth-"+marker,responseMode:"onReceived",options:{}}};
settings.position=[320,200];
yt.name="QA YouTube OAuth read-only";yt.id=randomUUID();yt.position=[580,100];
yt.parameters.url="https://www.googleapis.com/youtube/v3/channels";
yt.parameters.sendQuery=true;
yt.parameters.queryParameters={parameters:[{name:"part",value:"id"},{name:"mine",value:"true"}]};
yt.parameters.options={};
const tokenFb=fb.parameters.queryParameters?.parameters?.find(x=>x.name==="access_token");
const tokenIg=ig.parameters.queryParameters?.parameters?.find(x=>x.name==="access_token");
if(!tokenFb||!tokenIg)throw Error("Meta token field expressions missing");
fb.name="QA Facebook Graph read-only";fb.id=randomUUID();fb.position=[580,300];
fb.parameters={method:"GET",url:"https://graph.facebook.com/v25.0/me",sendQuery:true,queryParameters:{parameters:[tokenFb,{name:"fields",value:"id,name"}]},options:{}};
ig.name="QA Instagram Graph read-only";ig.id=randomUUID();ig.position=[580,500];
ig.parameters={method:"GET",url:"https://graph.facebook.com/v25.0/17841432429680254",sendQuery:true,queryParameters:{parameters:[tokenIg,{name:"fields",value:"id,username"}]},options:{}};
const nodes=[webhook,settings,yt,fb,ig];
const connections={
 [webhook.name]:{main:[[{node:settings.name,type:"main",index:0}]]},
 [settings.name]:{main:[[
 {node:yt.name,type:"main",index:0},
 {node:fb.name,type:"main",index:0},
 {node:ig.name,type:"main",index:0}
 ]]}
};
let id;
try{
 const w=await request("/workflows","POST",{name:"TEMP Bible quiz platform auth read-only "+Date.now(),nodes,connections,settings:{timezone:"Asia/Kolkata",executionOrder:"v1"}});
 id=w.id;await request("/workflows/"+id+"/activate","POST");
 let res;
 for(let attempt=0;attempt<10;attempt++){
  await sleep(2500);res=await fetch(root+"/webhook/"+webhook.parameters.path,{method:"POST",headers:{"content-type":"application/json"},body:"{}",signal:AbortSignal.timeout(25000)});
  if(res.status!==404)break;
 }
 if(!res.ok)throw Error("Temp probe HTTP "+res.status);
 for(let i=0;i<35;i++){
  await sleep(2000);
  const list=await request("/executions?workflowId="+encodeURIComponent(id)+"&limit=5");const ex=list.data?.[0];
  if(!ex||!["success","error","crashed"].includes(ex.status))continue;
  const full=await request("/executions/"+ex.id+"?includeData=true");
  const all=full.data?.resultData?.runData??{};
  const successFor=name=>Boolean(all[name]?.at(-1)?.data?.main?.[0]?.[0]?.json);
  const result={youtubeOAuthResponded:successFor(yt.name),facebookGraphResponded:successFor(fb.name),instagramGraphResponded:successFor(ig.name),overallExecution:ex.status};
  console.log("PLATFORM READ-ONLY AUTH PROBE",JSON.stringify(result));
  if(ex.status!=="success") {
    const err=full.data?.resultData?.error??{};
    console.error("First OAuth/Graph error:",err.node?.name??full.data?.resultData?.lastNodeExecuted??"unknown",String(err.message??"unknown").slice(0,160));
  }
  break;
 }
}finally{
 if(id){
  try{await request("/workflows/"+id+"/deactivate","POST");}catch{}
  for(let i=0;i<12;i++){try{await request("/workflows/"+id,"DELETE");console.log("Temporary token probe deleted");break;}catch(e){if(!e.message.includes("HTTP 409"))throw e;await sleep(2000);}}
 }
}
