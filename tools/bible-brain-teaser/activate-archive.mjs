const BASE="https://meetdavidraj7.n8n-wsk.com/api/v1";
const key=process.env.N8N_API_KEY;
const targetId="nB10Ub0ZIxCe5gHI";
if(!key)throw new Error("Missing N8N_API_KEY");
async function req(path,method="GET"){
 const r=await fetch(BASE+path,{method,headers:{"X-N8N-API-KEY":key,Accept:"application/json"},signal:AbortSignal.timeout(30000)});
 const text=await r.text();
 if(!r.ok)throw Error(method+" "+path+" HTTP "+r.status+": "+text.slice(0,250));
 return text?JSON.parse(text):{};
}
const [quiz,original,other]=await Promise.all([
 req("/workflows/"+targetId),
 req("/workflows/TCMiKoaj2xkNvK1L"),
 req("/workflows/iEiu5vka5sAVMxMl")
]);
if(original.active!==true)throw Error("Existing 3-slot workflow unexpectedly inactive; no changes made");
if(quiz.id!==targetId||quiz.nodes.length!==17||quiz.settings?.timezone!=="Asia/Kolkata")throw Error("Unexpected 4 PM staging contract");
const schedules=quiz.nodes.filter(n=>n.type==="n8n-nodes-base.scheduleTrigger"&&!n.disabled);
if(schedules.length!==1||schedules[0].parameters?.rule?.interval?.[0]?.expression!=="0 16 * * *")throw Error("Incorrect schedule or timezone");
if(other.active)throw Error("Another Bible quiz 4 PM workflow already active; refusing duplicate trigger");
const con=quiz.connections??{};
const follow=new Set();const q=[schedules[0].name];
while(q.length){
 const a=q.shift();if(follow.has(a))continue;follow.add(a);
 for(const child of (con[a]?.main??[]).flat().filter(Boolean))q.push(child.node);
}
const blocked=["Quiz YouTube Upload - DISCONNECTED","Quiz IG Create Reel - DISCONNECTED","Quiz FB Start Reel - DISCONNECTED"];
if(blocked.some(n=>follow.has(n)))throw Error("Unexpected publisher connection");
if(!follow.has("Quiz Verify Permanent MP4 URL")||!follow.has("QUIZ NO PUBLISHING - Manual Platform QA Gate"))throw Error("Archive and safety gates missing");
const conf=quiz.nodes.filter(n=>n.type==="n8n-nodes-base.googleSheets");
if(conf.length!==2||conf.some(n=>!n.credentials?.googleSheetsOAuth2Api?.id))throw Error("Google Sheets credentials missing");
const already=quiz.active===true;
if(!already)await req("/workflows/"+targetId+"/activate","POST");
const updated=await req("/workflows/"+targetId);
if(updated.active!==true)throw Error("Activation did not persist");
console.log(JSON.stringify({workflowId:targetId,active:true,cron:"0 16 * * *",timezone:"Asia/Kolkata",alreadyActive:already,original3SlotsUnchanged:true,publicSocialPublishing:false,archivalOnly:true,nextRun:"following 16:00 Asia/Kolkata schedule",reachableNodes:[...follow]},null,2));