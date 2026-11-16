import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";

const api="https://meetdavidraj7.n8n-wsk.com/api/v1";
const key=process.env.N8N_API_KEY;
if(!key)throw Error("Missing N8N_API_KEY secret");
const request=async(path,method="GET",body)=>{
 const r=await fetch(api+path,{method,headers:{"X-N8N-API-KEY":key,"Accept":"application/json",...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 const txt=await r.text();if(!r.ok)throw Error(method+" "+path+" failed HTTP "+r.status+" "+txt.slice(0,180));
 return txt?JSON.parse(txt):{};
};
const original=await request("/workflows/TCMiKoaj2xkNvK1L");
const existing=await request("/workflows/iEiu5vka5sAVMxMl");
if(!original.active||existing.active||existing.nodes.length!==6)throw Error("Source must be active and original private quiz target must remain exactly six inactive nodes");
const source=name=>{
 const n=original.nodes.find(x=>x.name===name);
 if(!n)throw Error("Missing reference publisher node: "+name);
 return structuredClone(n);
};
const oldNames=new Set(existing.nodes.map(n=>n.name));
const add=node=>{
 if(oldNames.has(node.name))throw Error("Duplicate "+node.name);
 node.id=randomUUID();oldNames.add(node.name);node.position=[420+oldNames.size*230,500];
 return node;
};
const clone=(name,newName)=>{
 const node=source(name);node.name=newName;return add(node);
};
const template=JSON.parse(await fs.readFile(new URL("./n8n-bible-teaser-4pm-draft.json",import.meta.url),"utf8"));
if(template.nodes.length!==6||template.settings?.timezone!=="Asia/Kolkata"||template.nodes[0].parameters.rule.interval[0].expression!=="0 16 * * *")throw Error("Unexpected private quiz contract");
const nodes=structuredClone(template.nodes);
const connections=structuredClone(template.connections);
const link=(a,b,output=0)=>{
 if(!connections[a])connections[a]={main:[]};
 while(connections[a].main.length<=output)connections[a].main.push([]);
 connections[a].main[output].push({node:b,type:"main",index:0});
};
const settings=clone("PUBLISHER SETTINGS - EDIT CLOUDINARY HERE","Quiz Publisher Private Settings");
// Reuse the already existing original account config INSIDE n8n only. No secrets printed or pushed to GitHub.
settings.name="PUBLISHER SETTINGS - EDIT CLOUDINARY HERE";
nodes.push(settings);
const trig=connections["Bible Quiz — 4 PM IST"].main[0];
if(trig.length!==1||trig[0].node!=="Read Bible Puzzle History")throw Error("Unexpected trigger routing");
trig[0].node=settings.name;
link(settings.name,"Read Bible Puzzle History");

const wait=clone("Wait","Quiz Wait for Render");
wait.parameters={amount:20,unit:"seconds"};
nodes.push(wait);
const check=clone("Check Status","Quiz Check Railway Status");
check.parameters={url:"={{ $('Store PRIVATE Render ID').first().json.statusUrl }}",options:{}};
nodes.push(check);
const ready=clone("Status Ready?","Quiz Render Ready?");
ready.parameters={
 conditions:{options:{caseSensitive:true,leftValue:"",typeValidation:"strict",version:2},combinator:"and",
 conditions:[{id:randomUUID(),leftValue:"={{ $json.status }}",rightValue:"ready",operator:{type:"string",operation:"equals"}}]},
 options:{}
};
nodes.push(ready);
const pending=add({name:"Quiz Abort Failed or Excessive Render",type:"n8n-nodes-base.code",typeVersion:2,parameters:{mode:"runOnceForAllItems",jsCode:`const s=String($input.first().json.status??"unknown"); if(s==="failed"||s==="error"||s==="cancelled") throw new Error("Railway quiz renderer failed: "+s); if($runIndex>45)throw new Error("Bible quiz render polling timeout");return $input.all();`}});
nodes.push(pending);
link("Store PRIVATE Render ID",wait.name);
link(wait.name,check.name);
link(check.name,ready.name);
link(ready.name,pending.name,1);
link(pending.name,wait.name);

// Upload to public, persistent ImageKit HTTPS MP4, using existing ImageKit BASIC credential.
const cloud=clone("Upload Scenic Background to Cloudinary","Quiz Archive MP4 to ImageKit");
const originalUrl=cloud.parameters?.url;
// The original node is misnamed "Cloudinary"; it actually uses ImageKit's
// authenticated server-side file-upload endpoint. Keep its URL and credential.
if(typeof originalUrl!=="string"||!originalUrl.includes("upload.imagekit.io")||!originalUrl.includes("/files/upload"))throw Error("Existing ImageKit upload endpoint not recognized");
cloud.parameters.bodyParameters={parameters:[
 {parameterType:"formData",name:"file",value:"={{ $('Store PRIVATE Render ID').first().json.videoUrl }}"},
 {parameterType:"formData",name:"fileName",value:"={{ 'grace-bible-quiz-'+$('Choose Unused Verified Puzzle').first().json.puzzleId+'-'+$execution.id+'.mp4' }}"}
]};
if(!cloud.credentials?.httpBasicAuth?.id)throw Error("Missing original Cloudinary auth credential");
nodes.push(cloud);
link(ready.name,cloud.name);
const verify=add({name:"Quiz Verify Permanent MP4 URL",type:"n8n-nodes-base.code",typeVersion:2,parameters:{mode:"runOnceForAllItems",jsCode:`
const upload=$input.first().json;const url=String(upload.url??"");
if(!/^https:\\/\\//.test(url))throw new Error("ImageKit returned no HTTPS asset URL");
const host=new URL(url).hostname;
if(!(host==="ik.imagekit.io"||host.endsWith(".imagekit.io")))throw new Error("Asset URL is not on the expected ImageKit host");
if(!/\\.mp4(?:\\?|$)/i.test(url))throw new Error("Archived asset is not MP4");
if(Number(upload.size??0)<100000)throw new Error("ImageKit MP4 upload incomplete");
return [{json:{puzzleId:$('Choose Unused Verified Puzzle').first().json.puzzleId,publicMp4Url:url,caption:$('Choose Unused Verified Puzzle').first().json.caption,sourceRenderId:$('Store PRIVATE Render ID').first().json.videoId,status:"preview-archived",autoPublish:false}}];
` }});
nodes.push(verify);link(cloud.name,verify.name);
const lock=add({name:"QUIZ NO PUBLISHING - Manual Platform QA Gate",type:"n8n-nodes-base.code",typeVersion:2,parameters:{mode:"runOnceForAllItems",jsCode:"return $input.all().map(i=>({json:{...i.json,publicPublishingEnabled:false,note:'Preview archived to ImageKit. All social publishing disabled pending platform tests.'}}));"}});
nodes.push(lock);link(verify.name,lock.name);

// Stage the real platform credential-bearing nodes but keep all disconnected, hence impossible to publish.
const yt=clone("Upload a video","Quiz YouTube Upload - DISCONNECTED");
yt.parameters.title="={{ 'Bible Brain Teaser | '+$('Choose Unused Verified Puzzle').first().json.question.slice(0,60) }}";
yt.parameters.options={...(yt.parameters.options??{}),description:"={{ $('Choose Unused Verified Puzzle').first().json.caption }}",privacyStatus:"unlisted"};
nodes.push(yt);
const ig=clone("IG Create Container","Quiz IG Create Reel - DISCONNECTED");
for(const p of ig.parameters.bodyParameters?.parameters??[]){
 if(p.name==="video_url")p.value="={{ $('Quiz Verify Permanent MP4 URL').first().json.publicMp4Url }}";
 if(p.name==="caption")p.value="={{ $('Choose Unused Verified Puzzle').first().json.caption }}";
 if(p.name==="cover_url")p.value="";
}
nodes.push(ig);
const fb=clone("FB Reel Start Upload","Quiz FB Start Reel - DISCONNECTED");
nodes.push(fb);
const workflow={
 name:"Grace In A Minute — Bible Brain Teaser 4PM — STAGING: ImageKit archive, NO social publishing",
 nodes,connections,settings:{timezone:"Asia/Kolkata",executionOrder:"v1"}
};
// This workflow is NOT activated. The output connections terminate before all three platform nodes.
const inbound=new Set(Object.values(connections).flatMap(c=>c.main.flat().filter(Boolean).map(n=>n.node)));
for(const social of [yt,ig,fb])if(inbound.has(social.name))throw Error("Unsafe publishing edge "+social.name);
if(nodes.filter(n=>n.type==="n8n-nodes-base.scheduleTrigger").length!==1)throw Error("Unexpected triggers");
const list=await request("/workflows?limit=100");
const matches=(list.data??[]).filter(w=>w.name===workflow.name);
if(matches.length>1)throw Error("Multiple staging workflows; refusing to guess target");
let result;
if(matches.length){
 const id=matches[0].id;
 const prior=await request("/workflows/"+id);
 if(prior.active||prior.activeVersion)throw Error("Refusing update to active staging workflow");
 result=await request("/workflows/"+id,"PUT",workflow);
}else {
 result=await request("/workflows","POST",workflow);
}
const id=result.id;
const stored=await request("/workflows/"+id);
if(stored.active||stored.nodes.length!==nodes.length)throw Error("Staged workflow readback mismatch");
console.log(JSON.stringify({created:true,workflowId:id,url:"https://meetdavidraj7.n8n-wsk.com/workflow/"+id,active:false,nodeCount:nodes.length,socialConnected:false,sourceOriginalUntouched:true,publicImageKitPath:cloud.name,platformStubs:[yt.name,ig.name,fb.name],codeChange:"none"},null,2));
