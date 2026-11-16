
const API="https://meetdavidraj7.n8n-wsk.com/api/v1",key=process.env.N8N_API_KEY;
if(!key)throw Error("N8N_API_KEY missing");
async function req(id){
 const r=await fetch(API+"/workflows/"+id,{headers:{"X-N8N-API-KEY":key},signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error("Read "+id+" HTTP "+r.status);
 return r.json();
}
const ids={original:"TCMiKoaj2xkNvK1L",quiz:"nB10Ub0ZIxCe5gHI",shared:"UyXSFUjWdkjuqK1p",oldDraft:"iEiu5vka5sAVMxMl"};
const [orig,quiz,shared,old]=await Promise.all(Object.values(ids).map(req));
const published=wf=>!!wf.activeVersionId;
if(!published(orig)||orig.nodes.length<60)throw Error("Original three slots unexpectedly changed/inactive");
if(!published(quiz)||quiz.nodes.length!==29)throw Error("4PM quiz not published with 29 nodes");
if(!published(shared)||shared.nodes.length!==58)throw Error("Shared public publisher not published with 58 nodes");
if(published(old))throw Error("Old 4PM draft active: duplicate trigger risk");
const schedules=quiz.nodes.filter(n=>n.type==="n8n-nodes-base.scheduleTrigger"&&!n.disabled);
if(schedules.length!==1||schedules[0].parameters?.rule?.interval?.[0]?.expression!=="0 16 * * *"||quiz.settings?.timezone!=="Asia/Kolkata")throw Error("4PM schedule incorrect");
const pubs=["youtube","facebook","instagram"].map(p=>quiz.nodes.find(n=>n.name==="Publish Quiz to "+p));
if(pubs.some(n=>!n||n.type!=="n8n-nodes-base.executeWorkflow"||n.parameters?.workflowId?.value!==shared.id||n.onError!=="continueRegularOutput"))
 throw Error("Shared publisher not connected independently to all platforms");
const out=quiz.connections?.["Verify Shared Publisher Handshake"]?.main?.[0]??[];
if(out.length!==3)throw Error("Expected three post-validation public branches");
const selected=quiz.nodes.find(n=>n.name==="Choose Unused Verified Puzzle")?.parameters?.jsCode??"";
const bankJson=selected.match(/const BANK=(\[[^\n]*\]);/);
if(!bankJson)throw Error("Cannot verify quiz bank");
const bank=JSON.parse(bankJson[1]);
if(bank.length!==77)throw Error("Active bank count mismatch: "+bank.length);
const count=new Set(bank.map(p=>p[3])).size;
if(count!==77)throw Error("Duplicate answer facts in active bank");
if(shared.nodes.filter(n=>/scheduleTrigger|webhook/.test(n.type)&&!n.disabled).length)
 throw Error("Shared publisher exposed an external trigger");
for(const name of ["Read Publication Attempts","Append Publish Claim Before Upload","Record Publish Outcome In Ledger","Public YouTube Upload","FB Reel Finish Upload","IG Publish"]){
 const n=shared.nodes.find(n=>n.name===name);
 if(!n||n.disabled)throw Error("Required shared public node missing/disabled: "+name);
}
const yt=shared.nodes.find(n=>n.name==="Public YouTube Upload"),ytPrivate=shared.nodes.find(n=>n.name==="Upload a video");
if(yt.parameters.options?.privacyStatus!=="public"||ytPrivate.parameters.options?.privacyStatus!=="private")
 throw Error("YouTube public/private modes incorrect");
const norm=shared.nodes.find(n=>n.name==="Normalize Publishing Input");
if(!["publishYouTube","publishFacebook","publishInstagram"].every(x=>norm?.parameters.jsCode.includes('"'+x+'"')))
 throw Error("Public mode allowlist incomplete");
const originalConnections=orig.connections||{};
if(!orig.nodes.some(n=>n.name==="FB Reel Finish Upload")||!orig.nodes.some(n=>n.name==="IG Publish")||!originalConnections["Edit Fields"])
 throw Error("Original 3slot public publishing nodes changed");
console.log("PRODUCTION READ-ONLY AUDIT PASSED",JSON.stringify({
 originalWorkflowId:orig.id,originalPublished:true,
 quizWorkflowId:quiz.id,quizPublished:true,quizNodes:quiz.nodes.length,cron:"0 16 * * *",timezone:"Asia/Kolkata",
 sharedPublisherId:shared.id,sharedPublished:true,sharedNodes:shared.nodes.length,threePlatforms:true,
 oldDraftInactive:true,approvedUniqueQuizFacts:bank.length,
 allPlatformsClaimBeforePublish:true,ledger:"Bible_Publish_Attempts",
 originalThreeSlotsUnchanged:true
}));
