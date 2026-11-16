
import {randomUUID} from "node:crypto";
const API="https://meetdavidraj7.n8n-wsk.com/api/v1",ID="nB10Ub0ZIxCe5gHI",SHARED="UyXSFUjWdkjuqK1p";
const key=process.env.N8N_API_KEY;
if(!key)throw Error("Missing N8N_API_KEY");
const request=async(path,method="GET",body)=>{
 const r=await fetch(API+path,{method,headers:{"X-N8N-API-KEY":key,Accept:"application/json",...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 const s=await r.text();if(!r.ok)throw Error(method+" "+path+" HTTP "+r.status+" "+s.slice(0,250));return s?JSON.parse(s):{};
};
const [quiz,shared,original,oldDraft]=await Promise.all([
 request("/workflows/"+ID),request("/workflows/"+SHARED),request("/workflows/TCMiKoaj2xkNvK1L"),request("/workflows/iEiu5vka5sAVMxMl")
]);
if(!quiz.activeVersionId || !shared.activeVersionId || !original.activeVersionId)
 throw Error("All production, quiz and publisher workflows must be published");
if(oldDraft.activeVersionId)throw Error("Old draft has an active trigger; refusing duplicate schedule");
if(quiz.nodes.length===29 && quiz.activeVersionId &&
  ["youtube","facebook","instagram"].every(p=>quiz.nodes.some(n=>n.name==="Publish Quiz to "+p))){
 console.log("4 PM PUBLIC QUIZ SCHEDULE ALREADY DEPLOYED; no mutation");
 process.exit(0);
}
if(quiz.settings?.timezone!=="Asia/Kolkata"||quiz.nodes.length!==20)
 throw Error("Unexpected quiz 4PM workflow state");
const schedule=quiz.nodes.filter(n=>n.type==="n8n-nodes-base.scheduleTrigger"&&!n.disabled);
if(schedule.length!==1||schedule[0].parameters?.rule?.interval?.[0]?.expression!=="0 16 * * *")
 throw Error("Expected exactly one 16:00 IST schedule");
if(shared.nodes.length!==58||!shared.nodes.some(n=>n.name==="Read Publication Attempts"))
 throw Error("Shared publisher lacks proven ledger and public modes");
const nodes=structuredClone(quiz.nodes),edges=structuredClone(quiz.connections);
const output="Verify Shared Publisher Handshake",base="Build Shared Publisher Input - VALIDATION ONLY";
if(!nodes.some(n=>n.name===output)||!nodes.some(n=>n.name===base))
 throw Error("Existing validated quiz/publisher handoff missing");
if(edges[output]?.main?.flat().some(Boolean))throw Error("Quiz already has publishing downstream; refusing double connection");
const code=(name,jsCode,position)=>({id:randomUUID(),name,type:"n8n-nodes-base.code",typeVersion:2,position,parameters:{mode:"runOnceForAllItems",jsCode}});
const link=(from,to)=>{
 if(!edges[from])edges[from]={main:[[]]};
 if(!edges[from].main.length)edges[from].main=[[]];
 edges[from].main[0].push({node:to,type:"main",index:0});
};
for(const p of [
 {platform:"youtube",mode:"publishYouTube"},
 {platform:"facebook",mode:"publishFacebook"},
 {platform:"instagram",mode:"publishInstagram"}
]){
 const name="Prepare "+p.platform+" Public Quiz Input";
 const prep=code(name,[
  "const parent=$('Build Shared Publisher Input - VALIDATION ONLY').first().json.publisherInput;",
  "if(!parent?.contentId||!parent.videoUrl||!parent.description)throw new Error('Missing archived quiz content');",
  "return [{json:{publisherInput:{...parent,mode:'"+p.mode+"'}}}];"
 ].join("\n"),[3050,600+nodes.length*50]);
 const child={id:randomUUID(),name:"Publish Quiz to "+p.platform,
  type:"n8n-nodes-base.executeWorkflow",typeVersion:1.3,
  position:[3330,600+nodes.length*50],
  onError:"continueRegularOutput",
  parameters:{source:"database",workflowId:{__rl:true,value:SHARED,mode:"id"},
  mode:"once",options:{waitForSubWorkflow:true}}};
 const verify=code("Record "+p.platform+" Delivery Result",[
  "const d=$input.first()?.json??{};",
  "const success=d.platform==='"+p.platform+"'&&d.status==='published'&&!!d.remoteId;",
  "const error=String(d.error?.message??d.error??d.message??'Publication returned no confirmed receipt').slice(0,260);",
  "return [{json:{platform:'"+p.platform+"',contentId:$('Build Shared Publisher Input - VALIDATION ONLY').first().json.publisherInput.contentId,status:success?'published':'needs_reconciliation',url:success?d.remoteUrl:'',remoteId:success?d.remoteId:'',error:success?'':error}}];"
 ].join("\n"),[3610,600+nodes.length*50]);
 nodes.push(prep,child,verify);
 link(output,prep.name);link(prep.name,child.name);link(child.name,verify.name);
}
const pubs=nodes.filter(n=>n.name.startsWith("Publish Quiz to "));
if(pubs.length!==3||pubs.some(n=>n.parameters?.workflowId?.value!==SHARED||n.onError!=="continueRegularOutput"))
 throw Error("Independent three-platform publishing branches missing");
const reachable=new Set(),q=[schedule[0].name];
while(q.length){const v=q.shift();if(reachable.has(v))continue;reachable.add(v);for(const n of (edges[v]?.main??[]).flat().filter(Boolean))q.push(n.node);}
for(const p of pubs)if(!reachable.has(p.name))throw Error("Platform branch not reachable from 4PM schedule: "+p.name);
for(const unsafe of ["Quiz YouTube Upload - DISCONNECTED","Quiz IG Create Reel - DISCONNECTED","Quiz FB Start Reel - DISCONNECTED"])
 if(reachable.has(unsafe))throw Error("Old disconnected publisher still directly reachable");
const save={name:quiz.name,nodes,connections:edges,settings:quiz.settings};
console.log(JSON.stringify({dryRun:process.env.APPLY_SCHEDULE!=="true",quizWorkflowId:ID,sharedPublisherId:SHARED,newNodeCount:nodes.length,cron:"0 16 * * *",timezone:"Asia/Kolkata",threeIndependentPlatforms:true,originalThreeSlotsUnchanged:true},null,2));
if(process.env.APPLY_SCHEDULE!=="true")process.exit(0);
await request("/workflows/"+ID+"?publishIfActive=false","PUT",save);
await request("/workflows/"+ID+"/publish","POST");
const final=await request("/workflows/"+ID);
if(!final.activeVersionId||final.nodes.length!==nodes.length||final.nodes.filter(n=>n.type==="n8n-nodes-base.scheduleTrigger"&&!n.disabled).length!==1)
 throw Error("4 PM public schedule publication readback mismatch");
console.log("4 PM BIBLE QUIZ PUBLIC PUBLISHING ENABLED",JSON.stringify({id:ID,nodeCount:final.nodes.length,threePlatforms:true,cron:"0 16 * * *",timezone:"Asia/Kolkata"}));
