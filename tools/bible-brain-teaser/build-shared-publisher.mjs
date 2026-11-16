import { randomUUID } from "node:crypto";
const API = "https://meetdavidraj7.n8n-wsk.com/api/v1";
const ORIGINAL_ID = "TCMiKoaj2xkNvK1L";
const NAME = "Grace In A Minute - Shared Publisher (PRIVATE QA)";
const key = process.env.N8N_API_KEY;
if(!key) throw new Error("N8N_API_KEY must be set in GitHub Actions secrets");
async function api(path,method="GET",data){
 const res=await fetch(API+path,{method,headers:{"X-N8N-API-KEY":key,Accept:"application/json",...(data?{"Content-Type":"application/json"}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(30000)});
 const body=await res.text();
 if(!res.ok)throw new Error(method+" "+path+" HTTP "+res.status+" "+body.slice(0,220));
 return body?JSON.parse(body):{};
}
const orig=await api("/workflows/"+ORIGINAL_ID);
if(orig.active!==true || orig.nodes?.length<60)throw new Error("Original 3 Slots not in expected published state");
const source=name=>{
 const n=orig.nodes.find(n=>n.name===name);
 if(!n)throw new Error("Missing existing publisher node: "+name);
 return structuredClone(n);
};
function take(name){
 const n=source(name);n.id=randomUUID();
 return n;
}
function code(name,jsCode,position){
 return {name,id:randomUUID(),type:"n8n-nodes-base.code",typeVersion:2,position,parameters:{mode:"runOnceForAllItems",jsCode}};
}
function connect(edges,from,to,index=0){
 if(!edges[from])edges[from]={main:[]};
 while(edges[from].main.length<=index)edges[from].main.push([]);
 edges[from].main[index].push({node:to,type:"main",index:0});
}
const start={
 name:"When called by a content slot",id:randomUUID(),
 type:"n8n-nodes-base.executeWorkflowTrigger",typeVersion:1.1,
 position:[200,100],parameters:{inputSource:"passthrough"}
};
const normalize=code("Normalize Publishing Input",String.raw\`
const raw=$input.first()?.json??{};
const data=raw.publisherInput??raw;
const url=String(data.videoUrl??data.publicMp4Url??"").trim();
if(!/^https:\\/\\/ik\\.imagekit\\.io\\/[^\\s?#]+\\.mp4(?:[?#].*)?$/i.test(url))throw new Error("Expected a permanent HTTPS ImageKit MP4");
const contentId=String(data.contentId??data.puzzleId??"").trim();
if(!/^[a-z0-9][a-z0-9-_]{2,110}$/i.test(contentId))throw new Error("Missing valid stable content ID");
const title=String(data.title??"").trim();
const description=String(data.description??data.caption??"").trim();
if(title.length<8||title.length>100)throw new Error("Publisher title must be 8-100 characters");
if(description.length<20||description.length>5000)throw new Error("Publisher description must be 20-5000 characters");
if(data.contentType==="bible_quiz" && (!/ANSWER:/i.test(description)||!/\\b(?:Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Matthew|Mark|Luke|John|Samuel|Judges|Jonah|Acts|Psalms|Proverbs|Romans|Kings|Revelation)\\b/i.test(description)))throw new Error("Bible quiz description missing verified answer or reference");
const mode=String(data.mode??"validateOnly");
if(!["validateOnly","privateYouTubeQA"].includes(mode))throw new Error("Public posting is intentionally disabled until Meta and YouTube tests pass");
const tags=Array.isArray(data.tags)?data.tags.map(x=>String(x).replace(/^#/,"")).filter(Boolean).slice(0,18):["BibleQuiz","GraceInAMinute"];
return [{json:{contentId,contentType:String(data.contentType??"generic"),videoUrl:url,title,description,tags,tagsCsv:tags.join(","),mode,answerVisibleInVideo:false}}];
\`,[450,100]);
const settings=take("PUBLISHER SETTINGS - EDIT CLOUDINARY HERE");
settings.position=[700,100]; // Existing account config remains inside n8n, not in git.
const gate={
 name:"Private YouTube QA only?",id:randomUUID(),type:"n8n-nodes-base.if",typeVersion:2.2,
 position:[930,100],
 parameters:{conditions:{options:{caseSensitive:true,leftValue:"",typeValidation:"strict",version:2},combinator:"and",
 conditions:[{id:randomUUID(),leftValue:"={{ $('Normalize Publishing Input').first().json.mode }}",rightValue:"privateYouTubeQA",operator:{type:"string",operation:"equals"}}]},options:{}}
};
const validated=code("Validated without publishing",String.raw\`
return [{json:{contentId:$('Normalize Publishing Input').first().json.contentId,status:"validated_only",publicPublishingEnabled:false}}];
\`,[1170,300]);
const download=take("Download MP4");
download.position=[1190,70];
download.parameters.url="={{ $('Normalize Publishing Input').first().json.videoUrl }}";
if(!download.parameters.options?.response)throw new Error("Original MP4 downloader no longer configured for file response");
const yt=take("Upload a video");
yt.position=[1430,70];
if(!yt.credentials?.youTubeOAuth2Api?.id||yt.parameters?.operation!=="upload")throw new Error("Original YouTube upload node or credential changed");
yt.parameters.title="={{ $('Normalize Publishing Input').first().json.title }}";
yt.parameters.options={
 ...yt.parameters.options,
 description:"={{ $('Normalize Publishing Input').first().json.description }}",
 tags:"={{ $('Normalize Publishing Input').first().json.tagsCsv }}",
 privacyStatus:"private"
};
const ytResult=code("Capture PRIVATE YouTube Result",String.raw\`
const data=$input.first().json;
const id=String(data.id??data.uploadId??data.videoId??"");
if(!/^[A-Za-z0-9_-]{6,32}$/.test(id))throw new Error("YouTube upload did not return a valid video ID");
return [{json:{contentId:$('Normalize Publishing Input').first().json.contentId,platform:"youtube",privacy:"private",videoId:id,url:"https://www.youtube.com/watch?v="+id,status:"uploaded_private",publicPublishingEnabled:false}}];
\`,[1670,70]);

const nodes=[start,normalize,settings,gate,validated,download,yt,ytResult];
const edges={};
connect(edges,start.name,normalize.name);
connect(edges,normalize.name,settings.name);
connect(edges,settings.name,gate.name);
connect(edges,gate.name,download.name,0);
connect(edges,gate.name,validated.name,1);
connect(edges,download.name,yt.name);
connect(edges,yt.name,ytResult.name);

// Clone existing IG & FB publisher modules for the next integration step.
// They stay disabled AND disconnected until a nonpublic create/transfer test
// verifies the actual ImageKit URL, Page/IG permissions and callback handling.
const dormantNames=[
 "FB Reel Start Upload","FB Reel Upload Binary","FB Reel Build Finish Payload","FB Reel Finish Upload",
 "FB Store Reel ID","FB Wait","FB Check Reel Status","FB Normalize Reel Status",
 "FB Reel Ready?","FB Retry or Fail?","FB Handle Failure",
 "IG Create Container","IG Store Container ID","IG Container Created?","IG Wait",
 "IG Check Status","IG Normalize Status","IG Container Ready?",
 "IG Retry or Fail?","IG Handle Failure","IG Publish",
 "IG Read Published Reel Permalink","IG Store Result"
];
for(let i=0;i<dormantNames.length;i++){
 const n=take(dormantNames[i]);
 n.position=[200+(i%8)*250,700+Math.floor(i/8)*210];
 n.disabled=true;
 nodes.push(n);
}
const remote={name:NAME,nodes,connections:edges,settings:{timezone:"Asia/Kolkata",executionOrder:"v1"}};
const connected=new Set(Object.values(edges).flatMap(c=>c.main.flat().filter(Boolean).map(n=>n.node)));
if(dormantNames.some(n=>connected.has(n)))throw new Error("Meta publishers must be disconnected");
const matches=(await api("/workflows?limit=100")).data.filter(w=>w.name===NAME);
if(matches.length>1)throw new Error("Duplicate shared publishers");
let result;
if(matches.length){
 const prior=await api("/workflows/"+matches[0].id);
 if(prior.active || prior.activeVersion)throw new Error("Refusing to modify active shared publisher");
 result=await api("/workflows/"+prior.id,"PUT",remote);
}else result=await api("/workflows","POST",remote);
const check=await api("/workflows/"+result.id);
if(check.active||check.nodes.length!==nodes.length||check.nodes.find(n=>n.name==="Upload a video")?.parameters.options?.privacyStatus!=="private")
 throw new Error("Unexpected saved publisher state");
console.log(JSON.stringify({id:result.id,url:"https://meetdavidraj7.n8n-wsk.com/workflow/"+result.id,
 active:check.active,nodeCount:check.nodes.length,
 sourceOriginalUnchanged:true,sharedInput:"Execute Sub-workflow Trigger (passthrough)",
 modes:["validateOnly","privateYouTubeQA"],defaultMode:"validateOnly",
 metaNodesCopiedButDisabledAndDisconnected:dormantNames.length,
 youtubePrivateOnly:true},null,2));
