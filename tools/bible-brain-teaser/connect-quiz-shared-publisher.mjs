import {randomUUID} from "node:crypto";
const BASE="https://meetdavidraj7.n8n-wsk.com/api/v1",TOKEN=process.env.N8N_API_KEY;
const STAGE_ID="nB10Ub0ZIxCe5gHI",SHARED_ID="UyXSFUjWdkjuqK1p";
if(!TOKEN)throw Error("Missing N8N_API_KEY");
const request=async(path,method="GET",body)=>{
 const r=await fetch(BASE+path,{method,headers:{"X-N8N-API-KEY":TOKEN,Accept:"application/json",...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 const data=await r.text();if(!r.ok)throw Error(method+" "+path+" HTTP "+r.status+" "+data.slice(0,200));return data?JSON.parse(data):{};
};
const [source,shared,original,other]=await Promise.all([
 request("/workflows/"+STAGE_ID),request("/workflows/"+SHARED_ID),
 request("/workflows/TCMiKoaj2xkNvK1L"),request("/workflows/iEiu5vka5sAVMxMl")
]);
if(!original.activeVersionId)throw Error("Original 3 Slots not published");
if(!shared.activeVersionId||shared.nodes.length!==36)throw Error("Shared publishing subworkflow not published");
if(other.activeVersionId)throw Error("Old six-node quiz schedule unexpectedly published; risk duplicate");
const nodes=structuredClone(source.nodes),edges=structuredClone(source.connections??{});
if(![17,20].includes(nodes.length)||source.settings?.timezone!=="Asia/Kolkata")throw Error("Unexpected 4 PM archive workflow");
const schedule=nodes.filter(n=>n.type==="n8n-nodes-base.scheduleTrigger"&&!n.disabled);
if(schedule.length!==1||schedule[0].parameters.rule.interval[0].expression!=="0 16 * * *")throw Error("Expected one daily 16:00 IST trigger");
const gate="QUIZ NO PUBLISHING - Manual Platform QA Gate";
if(!nodes.some(n=>n.name===gate))throw Error("Archive safety gate missing");
if(nodes.some(n=>n.name==="Call Shared Publisher - VALIDATION ONLY")){
 console.log(JSON.stringify({stageId:STAGE_ID,sharedId:SHARED_ID,alreadyConnected:true,existingPublished:Boolean(source.activeVersionId),publicPosting:false}));
 process.exit(0);
}
if(edges[gate]?.main?.flat().filter(Boolean).length)throw Error("Safety gate already has downstream connections");
const code=(name,jsCode,position)=>({id:randomUUID(),name,type:"n8n-nodes-base.code",typeVersion:2,position,parameters:{mode:"runOnceForAllItems",jsCode}});
const prep=code("Build Shared Publisher Input - VALIDATION ONLY",String.raw`
const archived=$('Quiz Verify Permanent MP4 URL').first().json;
const selected=$('Choose Unused Verified Puzzle').first().json;
if(!archived?.publicMp4Url||!archived?.puzzleId||!selected?.caption)throw new Error("Quiz publisher input incomplete");
return [{json:{publisherInput:{
 contentId:archived.puzzleId,
 contentType:"bible_quiz",
 videoUrl:archived.publicMp4Url,
 title:("Bible Brain Teaser | "+selected.question).slice(0,100),
 description:selected.caption,
 tags:["BibleQuiz","GraceInAMinute","BibleTrivia"],
 mode:"validateOnly"
}}}];
`,[2900,260]);
const sub={id:randomUUID(),name:"Call Shared Publisher - VALIDATION ONLY",type:"n8n-nodes-base.executeWorkflow",typeVersion:1.3,position:[3180,260],parameters:{
 source:"database",workflowId:{__rl:true,value:SHARED_ID,mode:"id"},
 mode:"once",options:{waitForSubWorkflow:true}
}};
const verify=code("Verify Shared Publisher Handshake",String.raw`
const result=$input.first().json;
if(result.status!=="validated_only"||result.publicPublishingEnabled!==false)throw new Error("Shared publisher returned an unexpected posting status");
return [{json:{contentId:result.contentId,publisherHandshake:"ok",automatedPublicPublishing:false}}];
`,[3420,260]);
nodes.push(prep,sub,verify);
const add=(from,to)=>{edges[from]={main:[[{node:to,type:"main",index:0}]]};};
add(gate,prep.name);add(prep.name,sub.name);add(sub.name,verify.name);
const reachable=new Set(),q=[schedule[0].name];
while(q.length){
 const n=q.shift();if(reachable.has(n))continue;reachable.add(n);
 for(const x of (edges[n]?.main??[]).flat().filter(Boolean))q.push(x.node);
}
for(const unsafe of ["Quiz YouTube Upload - DISCONNECTED","Quiz IG Create Reel - DISCONNECTED","Quiz FB Start Reel - DISCONNECTED"])if(reachable.has(unsafe))throw Error("Social node unexpectedly reachable");
if(!reachable.has(sub.name)||!reachable.has("Quiz Verify Permanent MP4 URL"))throw Error("Shared publisher and archive nodes not on schedule path");
await request("/workflows/"+STAGE_ID+"?publishIfActive=false","PUT",{name:source.name,nodes,connections:edges,settings:source.settings});
await request("/workflows/"+STAGE_ID+"/publish","POST");
const updated=await request("/workflows/"+STAGE_ID);
if(updated.nodes.length!==20||!updated.activeVersionId)throw Error("Quiz staging new version not published");
console.log(JSON.stringify({stageWorkflowId:STAGE_ID,sharedPublisherId:SHARED_ID,workflowPublished:true,timezone:"Asia/Kolkata",cron:"0 16 * * *",nodeCount:updated.nodes.length,mode:"validateOnly",publicSocialPublishing:false,sourceOriginal3SlotsUnchanged:true},null,2));
