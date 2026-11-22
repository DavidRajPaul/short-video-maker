const token=process.env.N8N_API_KEY;
if(!token)throw Error("Missing N8N_API_KEY");
const api="https://meetdavidraj7.n8n-wsk.com/api/v1";
async function get(path){
 const r=await fetch(api+path,{headers:{"X-N8N-API-KEY":token},signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error(path+" HTTP "+r.status);
 return r.json();
}
const workflowId="lw6IvbrIW71nU1nO";
const list=await get("/executions?workflowId="+workflowId+"&limit=20");
const rows=Array.isArray(list.data)?list.data:[];
console.log(JSON.stringify({observed:rows.map(r=>({id:r.id,status:r.status,mode:r.mode,startedAt:r.startedAt,stoppedAt:r.stoppedAt})).slice(0,10)}));
for(const entry of rows.slice(0,3)){
 const detail=await get("/executions/"+entry.id+"?includeData=true");
 const stages=detail.data?.resultData?.runData||{};
 const nodes=Object.keys(stages);
 const platform={};
 for(const name of ["Record youtube Delivery Result","Record facebook Delivery Result","Record instagram Delivery Result"]){
  const rec=stages[name]?.at(-1)?.data?.main?.[0]?.[0]?.json;
  platform[name]=rec?{status:rec.status??"unknown",remoteId:rec.remoteId??"",url:rec.url??"",error:rec.error??""}:"not_reached";
 }
 console.log(JSON.stringify({executionId:entry.id,status:entry.status,lastNodes:nodes.slice(-10),platforms:platform,
 failureNode:detail.data?.resultData?.lastNodeExecuted,
 errorMessage:String(detail.data?.resultData?.error?.message||"").slice(0,220)}));
}
