import { randomUUID, createHmac } from "node:crypto";
const BASE="https://meetdavidraj7.n8n-wsk.com/api/v1",PUBLIC="https://meetdavidraj7.n8n-wsk.com";
const STAGING="lw6IvbrIW71nU1nO",ORIGINAL="TCMiKoaj2xkNvK1L",QUIZ="nB10Ub0ZIxCe5gHI",PUBLISHER="UyXSFUjWdkjuqK1p";
const KEY=process.env.N8N_API_KEY;
if(!KEY)throw Error("N8N_API_KEY GitHub secret missing");
const proof=createHmac("sha256",KEY).update("Grace Christmas 2026 private test secret").digest("hex");
const webhookPath="grace-christmas-2026-"+createHmac("sha256",KEY).update("Grace Christmas 2026 webhook path").digest("hex").slice(0,30);
async function api(path,method="GET",data) {
 const r=await fetch(BASE+path,{method,headers:{"X-N8N-API-KEY":KEY,Accept:"application/json",...(data?{"Content-Type":"application/json"}:{})},
 body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(30000)});
 const txt=await r.text();if(!r.ok)throw Error(method+" "+path+" HTTP "+r.status+" "+txt.slice(0,250));
 return txt?JSON.parse(txt):{};
}
const [stage,quiz,original,publisher]=await Promise.all([
 api("/workflows/"+STAGING),api("/workflows/"+QUIZ),api("/workflows/"+ORIGINAL),api("/workflows/"+PUBLISHER)
]);
if(!original.activeVersionId||!quiz.activeVersionId||!publisher.activeVersionId)throw Error("Existing original/quiz/publisher is not published");
if(original.settings?.timezone!=="Asia/Kolkata")throw Error("Parent timezone must be Asia/Kolkata");
const exactNode=(nodes,name)=>{
 const item=nodes.find(n=>n.name===name);
 if(!item)throw Error("Expected node not found: "+name);
 return item;
};
function link(connections,from,to,output=0){
 if(!connections[from])connections[from]={main:[]};
 while(connections[from].main.length<=output)connections[from].main.push([]);
 connections[from].main[output].push({node:to,type:"main",index:0});
}
function addCode(name,jsCode,position){
 return {name,id:randomUUID(),type:"n8n-nodes-base.code",typeVersion:2,position,
 parameters:{mode:"runOnceForAllItems",jsCode}};
}
const childNodes=structuredClone(stage.nodes),childEdges=structuredClone(stage.connections);
const isChildPublished=!!stage.activeVersionId;
if(!isChildPublished){
 if(childNodes.length!==14||stage.active)throw Error("Stage not in expected inactive 14-node state");
 const pivot="Verify Shared Publisher Handshake";
 const anchor=exactNode(childNodes,pivot);
 if((childEdges[pivot]?.main||[]).flat().some(Boolean))throw Error("Stage already has publishing downstream");
 for(const [index,platform] of ["youtube","facebook","instagram"].entries()){
  const names=["Prepare "+platform+" Public Quiz Input","Publish Quiz to "+platform,"Record "+platform+" Delivery Result"];
  const cloned=names.map((name,i)=>{
   const n=structuredClone(exactNode(quiz.nodes,name));
   n.id=randomUUID();
   n.name=n.name.replace("Quiz","Christmas");
   n.position=[3100+i*270,150+index*310];
   return n;
  });
  const [prep,publish,record]=cloned;
  if(publish.type!=="n8n-nodes-base.executeWorkflow"||publish.parameters?.workflowId?.value!==PUBLISHER||publish.onError!=="continueRegularOutput")
   throw Error("Expected guarded publisher missing for "+platform);
  // Existing quiz input code refers to the staging's exact similarly named Build input.
  if(!String(prep.parameters?.jsCode).includes("Build Shared Publisher Input - VALIDATION ONLY")) throw Error("Unexpected publisher mapping");
  childNodes.push(...cloned);
  link(childEdges,pivot,prep.name);link(childEdges,prep.name,publish.name);link(childEdges,publish.name,record.name);
 }
 // One-time public entrypoint is guarded by a HMAC secret; the public URL is never logged.
 const hook={id:randomUUID(),webhookId:randomUUID(),name:"One-time Christmas webhook",
  type:"n8n-nodes-base.webhook",typeVersion:2.1,position:[40,700],
  parameters:{httpMethod:"POST",path:webhookPath,responseMode:"onReceived",options:{}}};
 const auth=addCode("Authorize One-time Christmas Post","const d=$input.first()?.json??{};\nconst h=d.headers??{};\nconst proof=String(h['x-grace-christmas-proof']??'');\nif(proof!=='SECRET_VALUE')throw Error('Unauthorized Christmas webhook');\nconst date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());\nif(date!=='2026-11-22')throw Error('One-off Christmas publish only available on Nov 22 IST');\nreturn [{json:{date}}];".replaceAll("SECRET_VALUE",proof),[290,700]);
 childNodes.push(hook,auth);
 link(childEdges,hook.name,auth.name);link(childEdges,auth.name,"Choose Unused Verified Puzzle");
 if(childNodes.some(n=>/scheduleTrigger/.test(n.type)))throw Error("Christmas child must have no independent schedule");
 const sourceName=exactNode(childNodes,"Build Shared Publisher Input - VALIDATION ONLY");
 if(!sourceName.parameters.jsCode.includes("validateOnly"))throw Error("Missing validation guard");
 const childDraft={name:"Grace In A Minute - Christmas 2026 (Temporary Child)",nodes:childNodes,connections:childEdges,
   settings:stage.settings};
 console.log(JSON.stringify({stage:"CHILD",dryRun:process.env.APPLY_CHILD!=="true",nodeCount:childNodes.length,
  platforms:["youtube","facebook","instagram"],independentSchedule:false,oneOffWebhookAuthenticated:true}));
 if(process.env.APPLY_CHILD==="true"){
  await api("/workflows/"+STAGING+"?publishIfActive=false","PUT",childDraft);
  await api("/workflows/"+STAGING+"/publish","POST");
  const updated=await api("/workflows/"+STAGING);
  if(!updated.activeVersionId||updated.nodes.length!==childNodes.length)throw Error("Child publish read-back mismatch");
  console.log(JSON.stringify({childPublished:true,id:STAGING,nodeCount:updated.nodes.length}));
 }
}else{
 if(!["Publish Christmas to youtube","Publish Christmas to facebook","Publish Christmas to instagram"].every(n=>childNodes.some(x=>x.name===n)))
  throw Error("Christmas child published without all three guarded publishers");
 console.log("Christmas child already published and verified");
}
// Parent is changed separately; so a failed preview can never interrupt quotes.
const parentNodes=structuredClone(original.nodes),parentEdges=structuredClone(original.connections);
const ifQuote=exactNode(parentNodes,"Is Afternoon Quote?");
const quoteEdges=parentEdges[ifQuote.name]?.main;
if(!quoteEdges?.[0]?.some(x=>x.node==="Quote Prompt")||!quoteEdges[1]?.some(x=>x.node==="Morning Format?"))
 throw Error("Original quote routing has changed; refusing unsafe patch");
const guard=addCode("Christmas 2026 Date Gate","const first=$input.first()?.json??{};\nconst today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());\nconst date=String(first.date||today);\nreturn [{json:{...first,date,isChristmasSeason:date>='2026-11-22'&&date<='2026-12-26'}}];",[ifQuote.position[0]+260,ifQuote.position[1]-180]);
const seasonal={
 id:randomUUID(),name:"Christmas Active Today?",type:"n8n-nodes-base.if",typeVersion:2.2,
 position:[guard.position[0]+250,guard.position[1]],
 parameters:{conditions:{options:{caseSensitive:true,leftValue:"",typeValidation:"strict",version:2},combinator:"and",
   conditions:[{id:randomUUID(),leftValue:"={{ $('Christmas 2026 Date Gate').first().json.isChristmasSeason ? 'yes' : 'no' }}",
   rightValue:"yes",operator:{type:"string",operation:"equals"}}]},options:{}}
};
const childCall={
 id:randomUUID(),name:"Run Christmas Video Instead of Quote",
 type:"n8n-nodes-base.executeWorkflow",typeVersion:1.3,
 position:[seasonal.position[0]+250,seasonal.position[1]-110],
 parameters:{source:"database",workflowId:{__rl:true,value:STAGING,mode:"id"},mode:"once",options:{waitForSubWorkflow:true}}
};
parentNodes.push(guard,seasonal,childCall);
parentEdges[ifQuote.name].main[0]=[{node:guard.name,type:"main",index:0}];
link(parentEdges,guard.name,seasonal.name);
link(parentEdges,seasonal.name,childCall.name,0);
link(parentEdges,seasonal.name,"Quote Prompt",1);
if(parentNodes.some(n=>n.name==="Christmas 2026 Date Gate"&&n.id!==guard.id))throw Error("Duplicate gate");
if(parentEdges["Is Afternoon Quote?"].main[1][0].node!=="Morning Format?")throw Error("Morning/evening path changed");
console.log(JSON.stringify({stage:"PARENT",dryRun:process.env.APPLY_PARENT!=="true",nodeCount:parentNodes.length,
 originalNodeCount:original.nodes.length,season:"Nov 22-Dec 26",restoreQuotes:"Dec 27",morningEveningUntouched:true}));
if(process.env.APPLY_PARENT==="true"){
 const childLive=await api("/workflows/"+STAGING);
 if(!childLive.activeVersionId)throw Error("Christmas child must be published first");
 const parentDraft={name:original.name,nodes:parentNodes,connections:parentEdges,settings:original.settings};
 await api("/workflows/"+ORIGINAL+"?publishIfActive=false","PUT",parentDraft);
 await api("/workflows/"+ORIGINAL+"/publish","POST");
 const readback=await api("/workflows/"+ORIGINAL);
 if(!readback.activeVersionId||readback.nodes.length!==parentNodes.length||
    readback.connections["Is Afternoon Quote?"]?.main?.[0]?.[0]?.node!==guard.name)
  throw Error("Published parent seasonal gate did not validate");
 console.log(JSON.stringify({parentPublished:true,nodeCount:readback.nodes.length,
  link:"https://meetdavidraj7.n8n-wsk.com/workflow/"+ORIGINAL}));
}
