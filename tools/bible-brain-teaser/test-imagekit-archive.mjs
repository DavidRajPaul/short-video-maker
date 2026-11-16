import {randomUUID} from "node:crypto";
const api="https://meetdavidraj7.n8n-wsk.com/api/v1",host="https://meetdavidraj7.n8n-wsk.com";
const secret=process.env.N8N_API_KEY;
if(!secret)throw Error("Missing N8N_API_KEY");
async function request(path,method="GET",payload){
 const r=await fetch(api+path,{method,headers:{"X-N8N-API-KEY":secret,accept:"application/json",...(payload?{"content-type":"application/json"}:{})},body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(30000)});
 const s=await r.text();if(!r.ok)throw Error(method+" "+path+" HTTP "+r.status+" "+s.slice(0,240));
 return s?JSON.parse(s):{};
}
let id,activated=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function cleanup(){
 if(!id)return;
 try{await request("/workflows/"+id+"/deactivate","POST");}catch(e){console.error("Deactivation:",e.message);}
 for(let i=0;i<15;i++){
  try{await request("/workflows/"+id,"DELETE");console.log("Temporary preview workflow deleted");return;}
  catch(e){if(!e.message.includes("HTTP 409")){console.error("Cleanup:",e.message);return;}await sleep(2000);}
 }
 console.error("Cleanup pending: temporary workflow "+id+" requires inspection");
}
try{
 const stage=await request("/workflows/nB10Ub0ZIxCe5gHI");
 if(stage.active||stage.nodes.length!==17)throw Error("Staging workflow unexpected active/node count");
 const googleNodes=stage.nodes.filter(n=>n.type==="n8n-nodes-base.googleSheets");
 if(googleNodes.length!==2||googleNodes.some(n=>!n.credentials?.googleSheetsOAuth2Api?.id))throw Error("Staging Google Sheets credential references are incomplete");
 console.log("Two Google Sheets credentials verified on inactive staging workflow (sandbox URL validation fix applied)");
 const unused=["Quiz YouTube Upload - DISCONNECTED","Quiz IG Create Reel - DISCONNECTED","Quiz FB Start Reel - DISCONNECTED"];
 const main=stage.nodes.filter(n=>!unused.includes(n.name)&&n.type!=="n8n-nodes-base.scheduleTrigger");
 const path="bible-quiz-preview-"+randomUUID();
 const webhook={id:randomUUID(),name:"TEMP QA Webhook",type:"n8n-nodes-base.webhook",typeVersion:2.1,webhookId:randomUUID(),position:[100,500],parameters:{httpMethod:"POST",path,responseMode:"onReceived",options:{}}};
 const connections=structuredClone(stage.connections);
 delete connections["Bible Quiz — 4 PM IST"];
 for(const dead of unused)delete connections[dead];
 connections[webhook.name]={main:[[{node:"PUBLISHER SETTINGS - EDIT CLOUDINARY HERE",type:"main",index:0}]]};
 const w=await request("/workflows","POST",{name:"TEMP Bible quiz ImageKit archive QA "+Date.now(),nodes:[webhook,...main],connections,settings:{timezone:"Asia/Kolkata",executionOrder:"v1"}});
 id=w.id;if(!id)throw Error("Temporary workflow ID missing");
 await request("/workflows/"+id+"/activate","POST");activated=true;
 let response;
 for(let attempt=0;attempt<10;attempt++){
  await sleep(3000);
  response=await fetch(host+"/webhook/"+path,{method:"POST",headers:{"content-type":"application/json"},body:"{}",signal:AbortSignal.timeout(30000)});
  if(response.status!==404)break;
 }
 if(!response.ok)throw Error("Webhook HTTP "+response.status+": "+(await response.text()).slice(0,200));
 console.log("PRIVATE QUIZ PREVIEW REQUESTED; no publishing nodes in temporary workflow");
 for(let i=0;i<180;i++){
  await sleep(5000);
  const list=await request("/executions?workflowId="+encodeURIComponent(id)+"&limit=5");
  const exec=list.data?.[0];if(!exec)continue;
  if(i%12===0)console.log("Private archive execution:",exec.status);
  if(exec.status==="success"){
   const full=await request("/executions/"+exec.id+"?includeData=true");
   const result=full.data?.resultData?.runData?.["Quiz Verify Permanent MP4 URL"]?.at(-1)?.data?.main?.[0]?.[0]?.json;
   if(!result?.publicMp4Url)throw Error("Archive complete but permanent URL missing");
   const url=result.publicMp4Url;
   const head=await fetch(url,{method:"HEAD",signal:AbortSignal.timeout(20000)});
   if(!head.ok)throw Error("ImageKit URL HEAD HTTP "+head.status);
   console.log("IMAGEKIT ARCHIVE PASSED",JSON.stringify({videoUrl:url,puzzleId:result.puzzleId,contentType:head.headers.get("content-type"),contentLength:head.headers.get("content-length"),noSocialPublishing:true}));
   process.exitCode=0;break;
  }
  if(["error","crashed","canceled"].includes(exec.status)){
   const full=await request("/executions/"+exec.id+"?includeData=true");
   const error=full.data?.resultData?.error??{};
   throw Error("Private archive execution failed at "+(error.node?.name??"unknown")+": "+String(error.message??"Unknown error").slice(0,400));
  }
  if(i===179)throw Error("Private archive execution timeout");
 }
}finally{await cleanup();}
