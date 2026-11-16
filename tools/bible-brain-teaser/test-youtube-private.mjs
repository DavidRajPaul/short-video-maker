import {randomUUID} from "node:crypto";
const root="https://meetdavidraj7.n8n-wsk.com",api=root+"/api/v1",key=process.env.N8N_API_KEY;
if(!key)throw Error("Missing N8N_API_KEY");
const sleep=t=>new Promise(r=>setTimeout(r,t));
const request=async(path,method="GET",data)=>{
 const r=await fetch(api+path,{method,headers:{"X-N8N-API-KEY":key,accept:"application/json",...(data?{"content-type":"application/json"}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(30000)});
 const s=await r.text();if(!r.ok)throw Error(method+" "+path+" HTTP "+r.status+" "+s.slice(0,260));return s?JSON.parse(s):{};
};
const source=await request("/workflows/TCMiKoaj2xkNvK1L");
const clone=name=>{const n=source.nodes.find(x=>x.name===name);if(!n)throw Error("Node not found "+name);return structuredClone(n)};
const imageKitUrl="https://ik.imagekit.io/irqcgfg1j/grace-bible-quiz-jonah-great-fish-2006_GRiKf20gWe.mp4";
const webhook={id:randomUUID(),name:"QA YouTube Webhook",type:"n8n-nodes-base.webhook",typeVersion:2.1,webhookId:randomUUID(),position:[100,200],parameters:{httpMethod:"POST",path:"bible-youtube-private-"+randomUUID(),responseMode:"onReceived",options:{}}};
const download=clone("Download MP4");download.name="QA Download ImageKit MP4";download.id=randomUUID();download.position=[360,200];download.parameters.url=imageKitUrl;
const upload=clone("Upload a video");upload.name="QA Upload Private YouTube Quiz";upload.id=randomUUID();upload.position=[620,200];
if(!upload.credentials?.youTubeOAuth2Api?.id)throw Error("YouTube credential missing in original");
if(upload.parameters.operation!=="upload"||upload.parameters.resource!=="video")throw Error("Unexpected YouTube operation");
upload.parameters.binaryProperty="data";
upload.parameters.title="PRIVATE QA — Bible Brain Teaser: Jonah and the Great Fish";
upload.parameters.options={...(upload.parameters.options??{}),privacyStatus:"private",description:"PRIVATE QA ONLY. What happened to Jonah? Answer: Jonah spent three days and nights inside a great fish. Jonah 1:17. #GraceInAMinute",notifySubscribers:false,selfDeclaredMadeForKids:false};
if(upload.parameters.options.privacyStatus!=="private")throw Error("Refusing non-private upload");
const nodes=[webhook,download,upload];
const connections={
 [webhook.name]:{main:[[{node:download.name,type:"main",index:0}]]},
 [download.name]:{main:[[{node:upload.name,type:"main",index:0}]]}
};
let id;
try{
 const w=await request("/workflows","POST",{name:"TEMP Bible quiz PRIVATE YT QA "+Date.now(),nodes,connections,settings:{timezone:"Asia/Kolkata",executionOrder:"v1"}});
 id=w.id;await request("/workflows/"+id+"/activate","POST");
 let res;for(let j=0;j<10;j++){await sleep(2500);res=await fetch(root+"/webhook/"+webhook.parameters.path,{method:"POST",body:"{}",headers:{"content-type":"application/json"},signal:AbortSignal.timeout(25000)});if(res.status!==404)break;}
 if(!res.ok)throw Error("Trigger HTTP "+res.status);
 for(let j=0;j<90;j++){
  await sleep(3000);
  const list=await request("/executions?workflowId="+encodeURIComponent(id)+"&limit=5");const ex=list.data?.[0];if(!ex||!["success","error","crashed"].includes(ex.status))continue;
  const full=await request("/executions/"+ex.id+"?includeData=true");
  if(ex.status!=="success"){
   const err=full.data?.resultData?.error??{};
   throw Error("PRIVATE YouTube upload failed at "+(err.node?.name??full.data?.resultData?.lastNodeExecuted??"unknown")+": "+String(err.message??"unknown").slice(0,300));
  }
  const output=full.data?.resultData?.runData?.[upload.name]?.at(-1)?.data?.main?.[0]?.[0]?.json;
  const ytId=output?.uploadId??output?.id;
  if(typeof ytId!=="string"||ytId.length<6)throw Error("YouTube upload returned no video ID");
  console.log("PRIVATE YOUTUBE QA SUCCESS",JSON.stringify({videoId:ytId,privacy:"private",notifySubscribers:false,source:"ImageKit persistent MP4",note:"Private upload only; no public publishing"}));break;
 }
}finally{
 if(id){
  try{await request("/workflows/"+id+"/deactivate","POST")}catch{}
  for(let i=0;i<12;i++){try{await request("/workflows/"+id,"DELETE");console.log("Temporary YouTube test workflow removed");break;}catch(e){if(!e.message.includes("HTTP 409"))throw e;await sleep(2000)}}
 }
}

// Private-only upload: never configure public privacy here.
