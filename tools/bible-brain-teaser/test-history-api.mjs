import { randomUUID } from "node:crypto";
const apiRoot = "https://meetdavidraj7.n8n-wsk.com/api/v1";
const base = "https://meetdavidraj7.n8n-wsk.com";
const key = process.env.N8N_API_KEY;
if (!key) throw new Error("Missing N8N_API_KEY");
async function api(path, method="GET", body) {
  const r=await fetch(apiRoot+path,{method,headers:{"X-N8N-API-KEY":key,accept:"application/json",...(body?{"content-type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
  const s=await r.text();
  if(!r.ok)throw new Error(method+" "+path+" HTTP "+r.status+": "+s.slice(0,250));
  return s?JSON.parse(s):{};
}
async function cleanTemp(id) {
  let wf;
  try { wf=await api("/workflows/"+id); } catch(e) {
    if(e.message.includes("HTTP 404"))return;
    throw e;
  }
  if(!wf.name.startsWith("TEMP Bible history smoke test "))throw new Error("Refusing to clean unknown workflow "+id);
  try { if(wf.active)await api("/workflows/"+id+"/deactivate","POST"); } catch(e) {console.error("Deactivate temporary workflow:",e.message);}
  for(let i=0;i<10;i++){
    try {await api("/workflows/"+id,"DELETE"); console.log("Deleted temporary workflow",id);return;}
    catch(e){if(!e.message.includes("HTTP 409"))throw e;await new Promise(ok=>setTimeout(ok,2000));}
  }
  throw new Error("Temporary workflow cleanup did not complete "+id);
}
// Clean up previous test (n8n was still unpublishing during its first delete).
await cleanTemp("cTzwf8aTVtSr6WZH");
const original=await api("/workflows/TCMiKoaj2xkNvK1L");
const cred=original.nodes.find(n=>n.type==="n8n-nodes-base.googleSheets"&&n.credentials?.googleSheetsOAuth2Api?.id)?.credentials.googleSheetsOAuth2Api;
if(!cred)throw new Error("No valid original Google Sheets credential reference");
const template=await api("/workflows/iEiu5vka5sAVMxMl");
const read=template.nodes.find(n=>n.name==="Read Bible Puzzle History");
const append=template.nodes.find(n=>n.name==="Reserve Puzzle in History");
if(!read||!append)throw new Error("Missing history nodes in private draft");
const copy=n=>structuredClone(n);
const trigger={id:randomUUID(),name:"Temporary Test Webhook",type:"n8n-nodes-base.webhook",typeVersion:2.1,position:[200,200],webhookId:randomUUID(),parameters:{httpMethod:"POST",path:"internal-bible-history-smoke-"+randomUUID(),responseMode:"onReceived",options:{}}};
const get=copy(read);get.id=randomUUID();get.position=[450,200];get.credentials={googleSheetsOAuth2Api:cred};
const prep={id:randomUUID(),name:"Build Temporary Test Row",type:"n8n-nodes-base.code",typeVersion:2,position:[700,200],parameters:{mode:"runOnceForAllItems",jsCode:"return [{json:{ledger:{puzzle_id:'smoke-'+$execution.id,canonical_concept:'smoke-test-'+$execution.id,answer_fact_id:'smoke-fact-'+$execution.id,question_normalized:'temporary integration test',question_fingerprint:'smoke-'+$execution.id,question:'Temporary integration test: not published',answer:'not applicable',scripture_reference:'N/A',status:'test-only',created_at_utc:new Date().toISOString(),published_at_utc:'',platform_urls:''}}}];"}};
const save=copy(append);save.id=randomUUID();save.position=[950,200];save.credentials={googleSheetsOAuth2Api:cred};
const nodes=[trigger,get,prep,save];
const connections={};
for(let i=0;i<nodes.length-1;i++)connections[nodes[i].name]={main:[[{node:nodes[i+1].name,type:"main",index:0}]]};
const payload={name:"TEMP Bible history smoke test "+Date.now(),nodes,connections,settings:{executionOrder:"v1",timezone:"Asia/Kolkata"}};
let id,activated=false,passed=false,execStatus="unknown";
try {
  const w=await api("/workflows","POST",payload);
  id=w.id;if(!id)throw new Error("n8n didn't return temporary workflow ID");
  await api("/workflows/"+id+"/activate","POST");activated=true;
  const webhook=base+"/webhook/"+trigger.parameters.path;
  let res;
  for(let attempt=1;attempt<=10;attempt++){
    await new Promise(ok=>setTimeout(ok,3000));
    res=await fetch(webhook,{method:"POST",headers:{"content-type":"application/json"},body:"{}",signal:AbortSignal.timeout(25000)});
    console.log("Webhook registration check",attempt,"HTTP",res.status);
    if(res.status!==404)break; // only retry unregistered webhooks, never an accepted invocation
  }
  if(!res.ok)throw new Error("Webhook HTTP "+res.status+": "+(await res.text()).slice(0,300));
  for(let i=0;i<30;i++){
    await new Promise(ok=>setTimeout(ok,3000));
    const result=await api("/executions?workflowId="+encodeURIComponent(id)+"&limit=5");
    const execution=result.data?.[0];
    if(execution?.status==="success"){execStatus="success";passed=true;break;}
    if(["error","crashed","canceled"].includes(execution?.status??"")){
      execStatus=execution.status;
      try {
        const detail=await api("/executions/"+execution.id+"?includeData=true");
        const err=detail.data?.resultData?.error ?? {};
        console.error("FAILED NODE:",err.node?.name??"unknown","MESSAGE:",String(err.message??"unknown").slice(0,350));
      }catch(e){console.error("Execution detail unavailable:",e.message);}
      break;
    }
  }
  if(!passed)throw new Error("History read/append integration failed or timed out; execution status="+execStatus);
  console.log("BIBLE HISTORY READ+APPEND SUCCEEDED in isolated temporary workflow, using existing credentials.");
} finally {
  if(id){
    try{await cleanTemp(id);}catch(e){console.error("DELETE TEMP WORKFLOW FAILED:",id,e.message);}
  }
}
