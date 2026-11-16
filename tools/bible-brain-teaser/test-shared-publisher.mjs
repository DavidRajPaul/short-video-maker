import {randomUUID} from "node:crypto";
const API="https://meetdavidraj7.n8n-wsk.com/api/v1",HOST="https://meetdavidraj7.n8n-wsk.com";
const key=process.env.N8N_API_KEY;
if(!key)throw Error("Missing n8n API secret");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function api(path,method="GET",data) {
 const response=await fetch(API+path,{method,headers:{"X-N8N-API-KEY":key,Accept:"application/json",...(data?{"Content-Type":"application/json"}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(30000)});
 const text=await response.text();
 if(!response.ok)throw Error(method+" "+path+" HTTP "+response.status+" "+text.slice(0,260));
 return text?JSON.parse(text):{};
}
const childId="UyXSFUjWdkjuqK1p";
let child;
for(let attempt=0;attempt<20;attempt++){
 child=await api("/workflows/"+childId);
 if(child.activeVersionId)break;
 await sleep(1500);
}
if(!child.activeVersionId||child.nodes.length!==31)throw Error("Shared publisher has no published activeVersionId; refusing test");
const name="TEMP Shared Publisher Dry-Run "+Date.now();
const path="shared-publisher-qa-"+randomUUID();
const webhook={name:"QA Trigger",id:randomUUID(),type:"n8n-nodes-base.webhook",typeVersion:2.1,webhookId:randomUUID(),position:[100,240],parameters:{httpMethod:"POST",path,responseMode:"onReceived",options:{}}};
const payload={name:"QA Publisher Input",id:randomUUID(),type:"n8n-nodes-base.code",typeVersion:2,position:[320,240],parameters:{mode:"runOnceForAllItems",jsCode:"return [{json:{contentId:'jonah-validation-qa',contentType:'bible_quiz',videoUrl:'https://ik.imagekit.io/irqcgfg1j/grace-bible-quiz-jonah-great-fish-2006_GRiKf20gWe.mp4',title:'Bible Brain Teaser | Jonah and the Great Fish',description:'Which prophet spent three days inside a great fish? ANSWER: Jonah. Jonah 1:17. #BibleQuiz #GraceInAMinute',tags:['BibleQuiz','GraceInAMinute'],mode:'validateOnly'}}];"}};
const execute={name:"Execute Shared Publisher",id:randomUUID(),type:"n8n-nodes-base.executeWorkflow",typeVersion:1.3,position:[550,240],parameters:{source:"database",workflowId:{__rl:true,value:childId,mode:"id"},mode:"once",options:{waitForSubWorkflow:true}}};
const finish={name:"QA Verify Child Result",id:randomUUID(),type:"n8n-nodes-base.code",typeVersion:2,position:[780,240],parameters:{mode:"runOnceForAllItems",jsCode:"const data=$input.first().json;if(data.status!=='validated_only'||data.publicPublishingEnabled!==false)throw new Error('Shared publisher guard did not return validate-only status');return [{json:{passed:true,status:data.status,contentId:data.contentId}}];"}};
const nodes=[webhook,payload,execute,finish];
const connections={};
for(let i=0;i<nodes.length-1;i++)connections[nodes[i].name]={main:[[{node:nodes[i+1].name,type:"main",index:0}]]};
let id;try{
 const created=await api("/workflows","POST",{name,nodes,connections,settings:{timezone:"Asia/Kolkata",executionOrder:"v1"}});
 id=created.id;if(!id)throw Error("No temporary workflow ID");
 await api("/workflows/"+id+"/activate","POST");
 let response;
 for(let i=0;i<10;i++){await sleep(2500);response=await fetch(HOST+"/webhook/"+path,{method:"POST",headers:{"content-type":"application/json"},body:"{}",signal:AbortSignal.timeout(30000)});if(response.status!==404)break}
 if(!response.ok)throw Error("Webhook HTTP "+response.status+" "+(await response.text()).slice(0,160));
 let passed=false;
 for(let i=0;i<40;i++){
  await sleep(2500);
  const list=await api("/executions?workflowId="+id+"&limit=4");
  const ex=list.data?.[0];if(!ex||!["success","error","crashed","canceled"].includes(ex.status))continue;
  const detail=await api("/executions/"+ex.id+"?includeData=true");
  if(ex.status!=="success"){
   const err=detail.data?.resultData?.error??{};
   throw Error("Publisher dry-run failed in "+(err.node?.name??detail.data?.resultData?.lastNodeExecuted??"unknown")+": "+String(err.message??"unknown").slice(0,250));
  }
  const output=detail.data?.resultData?.runData?.[finish.name]?.at(-1)?.data?.main?.[0]?.[0]?.json;
  if(!output?.passed)throw Error("Child returned no verified result");
  console.log("SHARED PUBLISHER DRY RUN PASSED",JSON.stringify({status:output.status,contentId:output.contentId,originalUnchanged:true,noPublicPublishing:true}));
  passed=true;break;
 }
 if(!passed)throw Error("Shared publisher test timed out");
}finally{
 if(id){
  try{await api("/workflows/"+id+"/deactivate","POST");}catch(e){console.error("deactivate:",e.message)}
  for(let i=0;i<12;i++){try{await api("/workflows/"+id,"DELETE");console.log("Temporary shared publisher test removed");break}catch(e){if(!e.message.includes("HTTP 409"))throw e;await sleep(1500)}}
 }
}
