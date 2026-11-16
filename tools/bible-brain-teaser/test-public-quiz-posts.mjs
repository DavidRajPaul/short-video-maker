import {randomUUID} from "node:crypto";
const API="https://meetdavidraj7.n8n-wsk.com/api/v1";
const HOST="https://meetdavidraj7.n8n-wsk.com";
const KEY=process.env.N8N_API_KEY;
const PUBLISHER="UyXSFUjWdkjuqK1p";
if(!KEY)throw Error("Missing N8N_API_KEY");
const nap=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function api(path,method="GET",body){
 const r=await fetch(API+path,{method,headers:{"X-N8N-API-KEY":KEY,Accept:"application/json",...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 const s=await r.text();if(!r.ok)throw Error(method+" "+path+" HTTP "+r.status+" "+s.slice(0,180));return s?JSON.parse(s):{};
}
const shared=await api("/workflows/"+PUBLISHER);
if(!shared.activeVersionId||shared.nodes.length!==58)throw Error("Unexpected internal shared publisher state");
const modes=["publishYouTube","publishFacebook","publishInstagram"];
const result={};
for(const mode of modes){
 const platform=mode.replace("publish","").toLowerCase();
 const slug="bible-public-qa-"+platform+"-"+randomUUID();
 const webhook={id:randomUUID(),name:"QA Trigger "+platform,type:"n8n-nodes-base.webhook",typeVersion:2.1,webhookId:randomUUID(),position:[100,150],parameters:{httpMethod:"POST",path:slug,responseMode:"onReceived",options:{}}};
 const makeInput={id:randomUUID(),name:"QA Input "+platform,type:"n8n-nodes-base.code",typeVersion:2,position:[320,150],parameters:{mode:"runOnceForAllItems",jsCode:"return [{json:{publisherInput:{contentId:'jonah-great-fish',contentType:'bible_quiz',videoUrl:'https://ik.imagekit.io/irqcgfg1j/grace-bible-quiz-jonah-great-fish-2006_GRiKf20gWe.mp4',title:'Bible Brain Teaser | Jonah and the Great Fish',description:'Which prophet spent three days and nights inside a great fish? A. Daniel  B. Jonah  C. Moses.\\n\\nANSWER: B. Jonah. Scripture: Jonah 1:17.\\n\\n#BibleQuiz #GraceInAMinute #BibleTrivia',tags:['BibleQuiz','GraceInAMinute','BibleTrivia'],mode:'"+mode+"'}}}];"}};
 const exec={id:randomUUID(),name:"Execute Shared Publisher "+platform,type:"n8n-nodes-base.executeWorkflow",typeVersion:1.3,position:[560,150],parameters:{source:"database",workflowId:{__rl:true,value:PUBLISHER,mode:"id"},mode:"once",options:{waitForSubWorkflow:true}}};
 const check={id:randomUUID(),name:"Verify Public Receipt "+platform,type:"n8n-nodes-base.code",typeVersion:2,position:[800,150],parameters:{mode:"runOnceForAllItems",jsCode:"const d=$input.first().json??{};if(d.platform!=='"+platform+"'||d.status!=='published'||!d.remoteId||!d.automatedPublicPublishing)throw new Error('Public "+platform+" post not confirmed: '+JSON.stringify({status:d.status,error:d.error}));return [{json:{platform:d.platform,status:d.status,remoteId:d.remoteId,remoteUrl:d.remoteUrl}}];"}};
 const nodes=[webhook,makeInput,exec,check], connections={};
 for(let i=0;i<nodes.length-1;i++)connections[nodes[i].name]={main:[[{node:nodes[i+1].name,type:"main",index:0}]]};
 let id;
 try{
  const w=await api("/workflows","POST",{name:"TEMP PUBLIC Bible quiz QA "+platform+" "+Date.now(),nodes,connections,settings:{timezone:"Asia/Kolkata",executionOrder:"v1"}});
  id=w.id;await api("/workflows/"+id+"/publish","POST");
  let response;for(let i=0;i<12;i++){await nap(2400);response=await fetch(HOST+"/webhook/"+slug,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}",signal:AbortSignal.timeout(30000)});if(response.status!==404)break;}
  if(!response.ok)throw Error("Webhook HTTP "+response.status);
  let ended=false;
  for(let i=0;i<170;i++){
   await nap(3000);
   const list=await api("/executions?workflowId="+id+"&limit=4");
   const e=list.data?.[0];if(!e||!["success","error","crashed","canceled"].includes(e.status))continue;
   ended=true;
   const full=await api("/executions/"+e.id+"?includeData=true");
   if(e.status!=="success"){
    const err=full.data?.resultData?.error??{};
    throw Error("Public "+platform+" subworkflow failed: "+String(err.node?.name??full.data?.resultData?.lastNodeExecuted??"unknown")+"; "+String(err.message??"unknown").slice(0,280));
   }
   const receipt=full.data?.resultData?.runData?.[check.name]?.at(-1)?.data?.main?.[0]?.[0]?.json;
   if(!receipt?.remoteId)throw Error("No "+platform+" published receipt");
   result[platform]={status:"published",id:receipt.remoteId,url:receipt.remoteUrl};
   console.log("VERIFIED PUBLIC "+platform.toUpperCase()+" POST",JSON.stringify(result[platform]));
   break;
  }
  if(!ended)throw Error("Public "+platform+" QA timed out");
 }catch(e){result[platform]={status:"error",message:String(e.message).slice(0,450)};console.error("PUBLIC QA FAILED "+platform,JSON.stringify(result[platform]));}
 finally{
  if(id){
   try{await api("/workflows/"+id+"/unpublish","POST");}catch(e){console.error("Temporary unpublish "+platform+":",e.message.slice(0,100));}
   for(let j=0;j<15;j++){try{await api("/workflows/"+id,"DELETE");console.log("Deleted temporary "+platform+" QA workflow");break;}catch(e){if(!e.message.includes("HTTP 409")){console.error("Cleanup error",e.message.slice(0,120));break;}await nap(1800);}}
  }
 }
}
console.log("FINAL PLATFORM QA RESULTS",JSON.stringify(result));
if(Object.values(result).some(x=>x.status!=="published"))process.exitCode=1;
