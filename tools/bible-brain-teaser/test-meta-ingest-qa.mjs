import {randomUUID} from "node:crypto";
const apiRoot="https://meetdavidraj7.n8n-wsk.com/api/v1";
const host="https://meetdavidraj7.n8n-wsk.com";
const key=process.env.N8N_API_KEY;
const videoUrl="https://ik.imagekit.io/irqcgfg1j/grace-bible-quiz-jonah-great-fish-2006_GRiKf20gWe.mp4";
const wait=ms=>new Promise(ok=>setTimeout(ok,ms));
if(!key)throw new Error("Missing N8N_API_KEY");
const call=async(path,method="GET",data)=>{
 const res=await fetch(apiRoot+path,{method,headers:{"X-N8N-API-KEY":key,Accept:"application/json",...(data?{"Content-Type":"application/json"}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(30000)});
 const txt=await res.text();
 if(!res.ok)throw Error(method+" "+path+" HTTP "+res.status+" "+txt.slice(0,220));
 return txt?JSON.parse(txt):{};
};
const original=await call("/workflows/TCMiKoaj2xkNvK1L");
if(!original.activeVersionId)throw Error("Original 3 Slots is not published");
const clone=name=>{
 const n=original.nodes.find(n=>n.name===name);
 if(!n)throw Error("Original node missing: "+name);
 return {...structuredClone(n),id:randomUUID()};
};
const settings=clone("PUBLISHER SETTINGS - EDIT CLOUDINARY HERE");
const fbStart=clone("FB Reel Start Upload");
const fbUpload=clone("FB Reel Upload Binary");
const igCreate=clone("IG Create Container");
const h=fbUpload.parameters?.headerParameters?.parameters??[];
const fileHeader=h.find(p=>p.name==="file_url");
const authHeader=h.find(p=>p.name==="Authorization");
if(!fileHeader||!authHeader)throw Error("Existing FB hosted-upload headers not found");
fbUpload.parameters.url="={{ $('FB Reel Start Upload').first().json.upload_url }}";
fileHeader.value=videoUrl; // publicly reachable ImageKit video; never local Railway URL.
const igFields=igCreate.parameters.bodyParameters?.parameters??[];
const field=name=>igFields.find(x=>x.name===name);
if(!field("video_url")||!field("caption")||!field("media_type"))throw Error("Existing IG video container fields missing");
field("video_url").value=videoUrl;
field("caption").value="BIBLE BRAIN TEASER - Which prophet spent three days inside a great fish? A. Daniel B. Jonah C. Moses. ANSWER: B. Jonah (Jonah 1:17). #BibleQuiz #GraceInAMinute";
const cover=igFields.findIndex(x=>x.name==="cover_url");
if(cover>=0)igFields.splice(cover,1); // Don't send an empty/incompatible cover URL.
const feed=field("share_to_feed");if(feed)feed.value="false";
const webhook={name:"TEMP Meta Draft Trigger",id:randomUUID(),type:"n8n-nodes-base.webhook",typeVersion:2.1,webhookId:randomUUID(),position:[100,150],parameters:{httpMethod:"POST",path:"bible-meta-drafts-"+randomUUID(),responseMode:"onReceived",options:{}}};
const nodes=[webhook,settings,fbStart,fbUpload,igCreate];
for(let i=1;i<nodes.length;i++)nodes[i].position=[320+(i%3)*280,160+Math.floor(i/3)*240];
const conn={};
const link=(from,to)=>{if(!conn[from])conn[from]={main:[[]]};conn[from].main[0].push({node:to,type:"main",index:0});};
link(webhook.name,settings.name);
link(settings.name,fbStart.name);
link(settings.name,igCreate.name);
link(fbStart.name,fbUpload.name);
if(nodes.some(n=>/Reel Finish|IG Publish/.test(n.name)))throw Error("No public publishing operations allowed in this test");
const unique= new Set(nodes.map(n=>n.name));if(unique.size!==nodes.length)throw Error("Duplicate node names");
let wfId;
try{
 const newWf=await call("/workflows","POST",{name:"TEMP Bible quiz Meta ingest-only "+Date.now(),nodes,connections:conn,settings:{timezone:"Asia/Kolkata",executionOrder:"v1"}});
 wfId=newWf.id;
 await call("/workflows/"+wfId+"/publish","POST");
 const published=await call("/workflows/"+wfId);
 if(!published.activeVersionId)throw Error("Temporary draft Meta workflow not published");
 let response;
 for(let i=0;i<12;i++){await wait(2000);response=await fetch(host+"/webhook/"+webhook.parameters.path,{method:"POST",headers:{"content-type":"application/json"},body:"{}",signal:AbortSignal.timeout(25000)});if(response.status!==404)break;}
 if(!response.ok)throw Error("Temporary Meta ingest webhook HTTP "+response.status);
 let done=false;
 for(let i=0;i<65;i++){
  await wait(2000);
  const executions=await call("/executions?workflowId="+wfId+"&limit=5");
  const ex=executions.data?.[0];if(!ex||!["success","error","crashed"].includes(ex.status))continue;
  const full=await call("/executions/"+ex.id+"?includeData=true");
  if(ex.status!=="success"){
   const err=full.data?.resultData?.error??{};
   throw Error("Meta QA failed at "+(err.node?.name??full.data?.resultData?.lastNodeExecuted??"unknown")+": "+String(err.message??"unknown").slice(0,350));
  }
  const run=full.data?.resultData?.runData??{};
  const ig=run[igCreate.name]?.at(-1)?.data?.main?.[0]?.[0]?.json;
  const fb=run[fbUpload.name]?.at(-1)?.data?.main?.[0]?.[0]?.json;
  const start=run[fbStart.name]?.at(-1)?.data?.main?.[0]?.[0]?.json;
  const igId=String(ig?.id??"");const fbId=String(start?.video_id??"");
  if(!igId||!fbId||!(fb&&typeof fb==="object"))throw Error("Missing IG media container ID or FB hosted upload response");
  console.log("META PRIVATE INGEST PASSED",JSON.stringify({igContainerCreated:true,igContainerId:igId,fbUploadSessionCreated:true,fbVideoId:fbId,fbTransferResponseFields:Object.keys(fb).filter(k=>!k.toLowerCase().includes("token")),videoHost:"ik.imagekit.io",noFacebookFinish:true,noInstagramPublish:true}));
  done=true;break;
 }
 if(!done)throw Error("Temporary Meta ingestion test timed out");
}finally{
 if(wfId){
  try{await call("/workflows/"+wfId+"/unpublish","POST");}catch(e){console.error("Unpublish:",e.message)}
  for(let j=0;j<14;j++){try{await call("/workflows/"+wfId,"DELETE");console.log("Temporary Meta ingestion workflow removed");break;}catch(e){if(!e.message.includes("HTTP 409"))throw e;await wait(1500)}}
 }
}
