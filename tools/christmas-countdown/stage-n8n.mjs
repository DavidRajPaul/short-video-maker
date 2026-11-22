import { randomUUID } from "node:crypto";
const BASE="https://meetdavidraj7.n8n-wsk.com/api/v1", QUIZ_ID="nB10Ub0ZIxCe5gHI", PUB_ID="UyXSFUjWdkjuqK1p";
const NAME="Grace In A Minute - CHRISTMAS 2026 (STAGING PRIVATE ONLY)";
const TOKEN=process.env.N8N_API_KEY;
if(!TOKEN)throw Error("Missing N8N_API_KEY");
async function api(path,method="GET",data){
 const r=await fetch(BASE+path,{method,headers:{"X-N8N-API-KEY":TOKEN,"Accept":"application/json",...(data?{"Content-Type":"application/json"}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(30000)});
 const s=await r.text();if(!r.ok)throw Error(method+" "+path+" HTTP "+r.status+" "+s.slice(0,160));return s?JSON.parse(s):{};
}
const [quiz,publisher,production]=await Promise.all([api("/workflows/"+QUIZ_ID),api("/workflows/"+PUB_ID),api("/workflows/TCMiKoaj2xkNvK1L")]);
if(!quiz.activeVersionId||quiz.nodes.length!==29||!publisher.activeVersionId||!production.activeVersionId)throw Error("Production workflows have changed");
const clones=[],edges={};
function reuse(name){
 const src=quiz.nodes.find(n=>n.name===name);
 if(!src)throw Error("Missing "+name);
 const n=structuredClone(src);n.id=randomUUID();n.position=[400+clones.length*250,150];clones.push(n);return n;
}
function codeNode(name,jsCode){
 const n={id:randomUUID(),name,type:"n8n-nodes-base.code",typeVersion:2,position:[400+clones.length*250,150],parameters:{mode:"runOnceForAllItems",jsCode}};
 clones.push(n);return n;
}
function link(from,to,branch=0){
 if(!edges[from])edges[from]={main:[]};
 while(edges[from].main.length<=branch)edges[from].main.push([]);
 edges[from].main[branch].push({node:to,type:"main",index:0});
}
const trigger={id:randomUUID(),name:"When called by afternoon quote",type:"n8n-nodes-base.executeWorkflowTrigger",typeVersion:1.1,position:[150,150],parameters:{inputSource:"passthrough"}};
clones.push(trigger);
const dateNode=codeNode("Choose Unused Verified Puzzle","const incoming=$input.first()?.json??{};\nconst date=String(incoming.date||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));\nif(!/^2026-(11|12)-\\d{2}$/.test(date))throw Error('Outside Christmas 2026');\nconst day=Date.parse(date+'T00:00:00Z');\nconst start=Date.parse('2026-11-22T00:00:00Z'),end=Date.parse('2026-12-26T00:00:00Z');\nif(!Number.isFinite(day)||day<start||day>end)throw Error('Christmas window ended; quote must resume');\nconst puzzleId='christmas-countdown-'+date;\nreturn [{json:{date,contentId:puzzleId,puzzleId,contentType:'christmas_countdown'}}];");
const create=reuse("Create PRIVATE Quiz Video — Railway");
const existingUrl=String(create.parameters?.url||"");
if(!/^https:\/\/[^/?#]+\/api\/short-video$/.test(existingUrl))throw Error("Unexpected Railway URL");
const origin=existingUrl.slice(0,-"/api/short-video".length);
create.parameters.url=origin+"/api/christmas-countdown";
create.parameters.method="POST";create.parameters.sendBody=true;create.parameters.specifyBody="json";
create.parameters.jsonBody="={{ JSON.stringify({date:$('Choose Unused Verified Puzzle').first().json.date}) }}";
const store=codeNode("Store PRIVATE Render ID","const d=$input.first()?.json??{};\nconst id=String(d.videoId??'');\nif(!/^[A-Za-z0-9]+$/.test(id))throw Error('Renderer did not return valid video id');\nconst context=$('Choose Unused Verified Puzzle').first().json;\nif(d.contentId!==context.contentId||d.active!==true)throw Error('Christmas metadata mismatch');\nreturn [{json:{...context,...d,videoId:id,statusUrl:RAILWAY_URL+'/api/short-video/'+id+'/status',videoUrl:RAILWAY_URL+'/api/short-video/'+id}}];".replaceAll("RAILWAY_URL",JSON.stringify(origin)));
const wait=reuse("Quiz Wait for Render"),status=reuse("Quiz Check Railway Status"),ready=reuse("Quiz Render Ready?");
const retry=reuse("Quiz Abort Failed or Excessive Render"),upload=reuse("Quiz Archive MP4 to ImageKit");
const archive=reuse("Quiz Verify Permanent MP4 URL"),guard=reuse("QUIZ NO PUBLISHING - Manual Platform QA Gate");
const build=codeNode("Build Shared Publisher Input - VALIDATION ONLY","const archived=$('Quiz Verify Permanent MP4 URL').first().json??{};\nconst source=$('Store PRIVATE Render ID').first().json;\nconst url=String(archived.videoUrl??archived.publicMp4Url??archived.imagekitUrl??archived.url??'').trim();\nif(!/^https:\\/\\/ik\\.imagekit\\.io\\/[^\\s?#]+\\.mp4(?:[?#].*)?$/i.test(url))throw Error('Expected permanent ImageKit MP4 before publishing');\nconst {title,description,contentId}=source;\nif(!title||!description||!contentId)throw Error('Missing Christmas metadata');\nreturn [{json:{publisherInput:{contentId,contentType:'christmas_countdown',videoUrl:url,title,description,tags:source.tags??['Christmas','ChristmasCountdown','GraceInAMinute'],mode:'validateOnly'}}}];");
const validate=reuse("Call Shared Publisher - VALIDATION ONLY"),handshake=reuse("Verify Shared Publisher Handshake");
if(validate.parameters?.workflowId?.value!==PUB_ID)throw Error("Publisher changed");
link(trigger.name,dateNode.name);
link(dateNode.name,create.name);
link(create.name,store.name);
link(store.name,wait.name);
link(wait.name,status.name);
link(status.name,ready.name);
link(ready.name,upload.name,0);link(ready.name,retry.name,1);
link(retry.name,wait.name);
link(upload.name,archive.name);
link(archive.name,guard.name);
link(guard.name,build.name);
link(build.name,validate.name);
link(validate.name,handshake.name);
if(clones.some(n=>/scheduleTrigger|webhook/.test(n.type)))throw Error("Unexpected external trigger");
if(clones.some(n=>/Publish Quiz to |Upload a video|FB Reel Finish|IG Publish/.test(n.name)))throw Error("Unexpected public publisher");
const reachable=new Set(),queue=[trigger.name];
while(queue.length){const src=queue.shift();if(reachable.has(src))continue;reachable.add(src);
 for(const x of (edges[src]?.main||[]).flat().filter(Boolean))queue.push(x.node);}
if(reachable.size!==clones.length)throw Error("Unexpected detached nodes");
const draft={name:NAME,nodes:clones,connections:edges,settings:{timezone:"Asia/Kolkata",executionOrder:"v1"}};
console.log(JSON.stringify({stageName:NAME,mode:process.env.APPLY_STAGE==="true"?"inactive_staging":"dry_run",
 nodeCount:clones.length,renderer:origin+"/api/christmas-countdown",publisher:PUB_ID,
 noSchedule:true,noPublicPublish:true,originalUnchanged:true},null,2));
if(process.env.APPLY_STAGE!=="true")process.exit(0);
const existing=(await api("/workflows?limit=100")).data.filter(w=>w.name===NAME);
if(existing.length>1)throw Error("Duplicate staging workflows");
let result;
if(existing.length){
 const prior=await api("/workflows/"+existing[0].id);
 if(prior.active||prior.activeVersionId)throw Error("Refusing to overwrite an active staging workflow");
 result=await api("/workflows/"+prior.id,"PUT",draft);
}else result=await api("/workflows","POST",draft);
const checked=await api("/workflows/"+result.id);
if(checked.active||checked.activeVersionId||checked.nodes.length!==clones.length)throw Error("Staging read-back failed");
console.log(JSON.stringify({id:result.id,url:"https://meetdavidraj7.n8n-wsk.com/workflow/"+result.id,state:"inactive_staging_only",nodeCount:checked.nodes.length},null,2));
