import {randomUUID} from "node:crypto";
const ROOT="https://meetdavidraj7.n8n-wsk.com/api/v1",ID="UyXSFUjWdkjuqK1p",TOKEN=process.env.N8N_API_KEY;
if(!TOKEN)throw Error("Missing N8N_API_KEY");
const request=async(path,method="GET",body)=>{
 const res=await fetch(ROOT+path,{method,headers:{"X-N8N-API-KEY":TOKEN,Accept:"application/json",...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 const t=await res.text();if(!res.ok)throw Error(method+" "+path+" HTTP "+res.status+" "+t.slice(0,250));return t?JSON.parse(t):{};
};
const old=await request("/workflows/"+ID);
if(!old.activeVersionId || old.nodes.length!==31)throw Error("Shared publisher not in expected internally published state");
const nodes=structuredClone(old.nodes), connections=structuredClone(old.connections);
const node=name=>{const n=nodes.find(n=>n.name===name);if(!n)throw Error("Missing "+name);return n;};
const guard=node("Normalize Publishing Input");
const already=guard.parameters.jsCode.includes('"draftMeta"');
if(already){
 console.log("Shared publisher Meta draft QA already configured; no changes");
 process.exit(0);
}
if(!guard.parameters.jsCode.includes('["validateOnly","privateYouTubeQA"]'))throw Error("Unexpected publisher mode contract");
guard.parameters.jsCode=guard.parameters.jsCode.replace('["validateOnly","privateYouTubeQA"]','["validateOnly","privateYouTubeQA","draftMeta"]');
const yt=node("Upload a video");
if(yt.parameters.options?.privacyStatus!=="private")throw Error("YouTube QA is not private");
const fb=node("FB Reel Start Upload"),transfer=node("FB Reel Upload Binary"),ig=node("IG Create Container");
for(const n of [fb,transfer,ig]){if(!n.disabled)throw Error("Expected disconnected disabled Meta source nodes");n.disabled=false;}
transfer.parameters.url="={{ $('FB Reel Start Upload').first().json.upload_url }}";
const headers=transfer.parameters.headerParameters?.parameters??[];
const fileHeader=headers.find(x=>x.name==="file_url");
const authHeader=headers.find(x=>x.name==="Authorization");
if(!fileHeader||!authHeader)throw Error("Meta hosted-transfer configuration changed");
fileHeader.value="={{ $('Normalize Publishing Input').first().json.videoUrl }}";
const fields=ig.parameters.bodyParameters?.parameters??[];
const choose=n=>fields.find(x=>x.name===n);
if(!choose("media_type")||!choose("video_url")||!choose("caption"))throw Error("Instagram container fields missing");
choose("video_url").value="={{ $('Normalize Publishing Input').first().json.videoUrl }}";
choose("caption").value="={{ $('Normalize Publishing Input').first().json.description }}";
const cover=fields.findIndex(x=>x.name==="cover_url");
if(cover>=0)fields.splice(cover,1);
const feed=choose("share_to_feed");
if(feed)feed.value="false";

const code=(name,jsCode,position)=>({name,id:randomUUID(),type:"n8n-nodes-base.code",typeVersion:2,position,parameters:{mode:"runOnceForAllItems",jsCode}});
const chooseMeta={name:"Meta draft ingestion mode?",id:randomUUID(),type:"n8n-nodes-base.if",typeVersion:2.2,position:[1140,360],parameters:{
 conditions:{options:{caseSensitive:true,leftValue:"",typeValidation:"strict",version:2},combinator:"and",
 conditions:[{id:randomUUID(),leftValue:"={{ $('Normalize Publishing Input').first().json.mode }}",rightValue:"draftMeta",operator:{type:"string",operation:"equals"}}]},
 options:{}
}};
const fbState=code("Facebook Hosted Draft Transfer Result",String.raw`
const response=$input.first().json??{};
const start=$('FB Reel Start Upload').first().json??{};
const id=String(start.video_id??"");
if(!/^\d+$/.test(id)||response.success!==true)throw new Error("Facebook hosted transfer not accepted");
return [{json:{platform:"facebook",status:"uploaded_unpublished",videoId:id}}];
`,[1800,600]);
const igState=code("Instagram Draft Container Result",String.raw`
const d=$input.first().json??{},id=String(d.id??"");
if(!/^\d+$/.test(id))throw new Error("Instagram did not create media container");
return [{json:{platform:"instagram",status:"container_created_unpublished",containerId:id}}];
`,[1800,900]);
const merge={name:"Meta Draft Ingestion Results",id:randomUUID(),type:"n8n-nodes-base.merge",typeVersion:3.2,position:[2100,700],parameters:{mode:"append",numberInputs:2}};
const result=code("Verify Both Meta Drafts",String.raw`
const records=$input.all().map(x=>x.json);
const fb=records.find(x=>x.platform==="facebook"),ig=records.find(x=>x.platform==="instagram");
if(!fb||!ig)throw new Error("A Meta platform did not return an ingestion result");
return [{json:{contentId:$('Normalize Publishing Input').first().json.contentId,
facebook:{status:fb.status,videoId:fb.videoId},
instagram:{status:ig.status,containerId:ig.containerId},
publicPublishingEnabled:false}}];
`,[2360,700]);
nodes.push(chooseMeta,fbState,igState,merge,result);
const yes=connections["Private YouTube QA only?"]?.main;
if(!yes?.[0]?.some(x=>x.node==="Download MP4")||!yes?.[1]?.some(x=>x.node==="Validated without publishing"))
throw Error("Private YouTube QA gate unexpectedly changed");
yes[1]=[{node:chooseMeta.name,type:"main",index:0}];
const connect=(from,to,output=0,input=0)=>{
 if(!connections[from])connections[from]={main:[]};
 while(connections[from].main.length<=output)connections[from].main.push([]);
 connections[from].main[output].push({node:to,type:"main",index:input});
};
connect(chooseMeta.name,fb.name,0);
connect(chooseMeta.name,ig.name,0);
connect(chooseMeta.name,"Validated without publishing",1);
connect(fb.name,transfer.name);
connect(transfer.name,fbState.name);
connect(ig.name,igState.name);
connect(fbState.name,merge.name,0,0);
connect(igState.name,merge.name,0,1);
connect(merge.name,result.name);
const all=new Set();
const queue=["When called by a content slot"];
while(queue.length){const cur=queue.shift();if(all.has(cur))continue;all.add(cur);for(const dst of (connections[cur]?.main??[]).flat().filter(Boolean))queue.push(dst.node);}
for(const banned of ["FB Reel Finish Upload","IG Publish"])if(all.has(banned))throw Error("Public publishing node reachable: "+banned);
if(nodes.some(n=>!n.disabled && /scheduleTrigger|webhook/.test(n.type)))throw Error("Unexpected external/public trigger");
if(nodes.find(n=>n.name==="Upload a video").parameters.options?.privacyStatus!=="private")throw Error("YouTube became public unexpectedly");

const required={name:old.name,nodes,connections,settings:old.settings};
await request("/workflows/"+ID+"?publishIfActive=false","PUT",required);
await request("/workflows/"+ID+"/publish","POST");
const updated=await request("/workflows/"+ID);
if(!updated.activeVersionId||updated.nodes.length!==36)throw Error("Published Meta QA extension readback mismatch");
console.log(JSON.stringify({id:ID,url:"https://meetdavidraj7.n8n-wsk.com/workflow/"+ID,
internallyPublished:true,nodeCount:updated.nodes.length,
modes:["validateOnly","privateYouTubeQA","draftMeta"],
facebookHostedTransfer:true,instagramDraftContainer:true,
facebookFinishConnected:false,instagramPublishConnected:false,
youtubePrivacy:"private",original3SlotsUnchanged:true},null,2));
