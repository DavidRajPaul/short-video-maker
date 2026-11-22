import {createHmac} from "node:crypto";
const KEY=process.env.N8N_API_KEY;
if(!KEY)throw Error("N8N_API_KEY is required");
const API="https://meetdavidraj7.n8n-wsk.com/api/v1";
const BASE="https://meetdavidraj7.n8n-wsk.com";
const WORKFLOW="lw6IvbrIW71nU1nO";
const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
if(today!=="2026-11-22")throw Error("One-off public Christmas posting is permitted only on Nov 22 IST");
const proof=createHmac("sha256",KEY).update("Grace Christmas 2026 private test secret").digest("hex");
const path="grace-christmas-2026-"+createHmac("sha256",KEY).update("Grace Christmas 2026 webhook path").digest("hex").slice(0,30);
async function get(url){
 const r=await fetch(API+url,{headers:{"X-N8N-API-KEY":KEY},signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw Error("n8n API "+url+" HTTP "+r.status);
 return r.json();
}
const workflow=await get("/workflows/"+WORKFLOW);
if(!workflow.activeVersionId || !["Publish Christmas to youtube","Publish Christmas to facebook","Publish Christmas to instagram"].every(n=>workflow.nodes.some(x=>x.name===n)))
 throw Error("The authenticated Christmas publisher is not published for all three platforms");
if(!workflow.nodes.some(x=>x.name==="One-time Christmas webhook"&&x.type==="n8n-nodes-base.webhook"))
 throw Error("The approved one-off publishing webhook is absent");
const before=Date.now();
const response=await fetch(BASE+"/webhook/"+path,{
 method:"POST",
 headers:{"Content-Type":"application/json","x-grace-christmas-proof":proof},
 body:JSON.stringify({date:today}),
 signal:AbortSignal.timeout(30000),
});
if(!response.ok)throw Error("One-off webhook returned HTTP "+response.status);
console.log(JSON.stringify({oneOffInvocationAccepted:true,date:today,workflowId:WORKFLOW}));
let execution;
for(let i=0;i<80;i++){
 await new Promise(ok=>setTimeout(ok,10000));
 const list=await get("/executions?workflowId="+WORKFLOW+"&limit=25");
 const all=Array.isArray(list.data)?list.data:[];
 const recent=all.filter(x=>Date.parse(x.startedAt||0)>=before-15000);
 if(recent.length)execution=recent.sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt))[0];
 if(i%6===5)console.log(JSON.stringify({poll:i+1,runStatus:execution?.status??"waiting",executionId:execution?.id??null}));
 if(execution&&["success","error","crashed","canceled"].includes(execution.status))break;
}
if(!execution)throw Error("Webhook accepted but execution ID not retrievable; check n8n executions, do not manually retry");
const detail=await get("/executions/"+execution.id+"?includeData=true");
const statuses={};
for(const platform of ["youtube","facebook","instagram"]){
 const name="Record "+platform+" Delivery Result";
 const runs=detail.data?.resultData?.runData?.[name]??[];
 const item=runs.at(-1)?.data?.main?.[0]?.[0]?.json??{};
 statuses[platform]={status:item.status??"unknown",url:item.url??"",remoteId:item.remoteId??""};
}
console.log(JSON.stringify({executionId:execution.id,state:execution.status,platforms:statuses},null,2));
if(execution.status!=="success"||Object.values(statuses).some(x=>x.status!=="published"))
 throw Error("One or more public posts were not confirmed. Never blindly retry; reconcile ledger before further action.");
