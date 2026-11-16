
import {randomUUID} from "node:crypto";

const API="https://meetdavidraj7.n8n-wsk.com/api/v1";
const SHARED="UyXSFUjWdkjuqK1p",QUIZ="nB10Ub0ZIxCe5gHI";
const key=process.env.N8N_API_KEY;
if(!key)throw Error("N8N_API_KEY secret missing");
async function request(path,method="GET",body){
 const r=await fetch(API+path,{method,headers:{"X-N8N-API-KEY":key,Accept:"application/json",...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 const s=await r.text();
 if(!r.ok)throw Error(method+" "+path+" HTTP "+r.status+" "+s.slice(0,250));
 return s?JSON.parse(s):{};
}
const [original,shared,quiz]=await Promise.all([
 request("/workflows/TCMiKoaj2xkNvK1L"),
 request("/workflows/"+SHARED),
 request("/workflows/"+QUIZ)
]);
if(!original.activeVersionId||!shared.activeVersionId||!quiz.activeVersionId)
 throw Error("All original, shared and quiz workflows must already be published");
if(shared.nodes.length===58 && quiz.nodes.length===29 &&
   shared.nodes.some(n=>n.name==="Read Publication Attempts") &&
   shared.nodes.some(n=>n.name==="Public YouTube Upload")){
 console.log("SHARED PUBLIC PUBLISHER ALREADY DEPLOYED; no mutation");
 process.exit(0);
}
if(shared.nodes.length!==36 || quiz.nodes.length!==20)
 throw Error("Unexpected shared publisher or quiz workflow node count");
const nodes=structuredClone(shared.nodes);
const edges=structuredClone(shared.connections??{});
const names=new Set(nodes.map(n=>n.name));
const node=n=>{const item=nodes.find(x=>x.name===n);if(!item)throw Error("Required shared node absent "+n);return item;};
const add=n=>{if(names.has(n.name))throw Error("Duplicate "+n.name);names.add(n.name);nodes.push(n);return n;};
const clone=(from,name)=>{
 const n=structuredClone(node(from));n.id=randomUUID();n.name=name;n.disabled=false;
 n.position=[320+nodes.length*40,1000+nodes.length*18];
 return add(n);
};
const code=(name,jsCode)=>add({name,id:randomUUID(),type:"n8n-nodes-base.code",typeVersion:2,position:[320+nodes.length*40,1050],parameters:{mode:"runOnceForAllItems",jsCode:jsCode.join("\n")}});
const link=(from,to,out=0,inIndex=0)=>{
 if(!edges[from])edges[from]={main:[]};
 while(edges[from].main.length<=out)edges[from].main.push([]);
 edges[from].main[out].push({node:to,type:"main",index:inIndex});
};
const replace=(from,out,to)=>{
 if(!edges[from]?.main?.[out]?.length)throw Error("Cannot patch missing edge "+from+":"+out);
 edges[from].main[out]=[{node:to,type:"main",index:0}];
};
const ifNode=(name,mode)=>{
 const n=clone("Private YouTube QA only?",name);
 n.parameters.conditions.conditions[0].leftValue="={{ $('Normalize Publishing Input').first().json.mode }}";
 n.parameters.conditions.conditions[0].rightValue=mode;
 return n;
};
const normal=node("Normalize Publishing Input");
if(!normal.parameters.jsCode.includes('["validateOnly","privateYouTubeQA","draftMeta"]'))
 throw Error("Unexpected input-mode allow-list");
normal.parameters.jsCode=normal.parameters.jsCode.replace(
 '["validateOnly","privateYouTubeQA","draftMeta"]',
 '["validateOnly","privateYouTubeQA","draftMeta","publishYouTube","publishFacebook","publishInstagram"]'
);
// External webhook/schedule triggers are prohibited on this shared publisher.
if(nodes.some(n=>!n.disabled&&/scheduleTrigger|webhook/.test(n.type)))
 throw Error("Unexpected external trigger on shared publisher");

const platformName=mode=>({
 publishYouTube:"youtube",publishFacebook:"facebook",publishInstagram:"instagram"
})[mode];
const modes=["publishYouTube","publishFacebook","publishInstagram"];
const byMode=[];
for(const mode of modes)byMode.push(ifNode("Mode is "+mode+"?",mode));
replace("Meta draft ingestion mode?",1,byMode[0].name);
for(let i=0;i<byMode.length;i++){
 const n=byMode[i];
 if(i<byMode.length-1)link(n.name,byMode[i+1].name,1);
 else link(n.name,"Validated without publishing",1);
}
// Each public mode first reads the ledger and claims this content/platform before a remote request.
const sheetTemplate=quiz.nodes.find(n=>n.name==="Read Bible Puzzle History");
const appendTemplate=quiz.nodes.find(n=>n.name==="Reserve Puzzle in History");
if(!sheetTemplate?.credentials?.googleSheetsOAuth2Api?.id ||
   !appendTemplate?.credentials?.googleSheetsOAuth2Api?.id)throw Error("Existing Sheets OAuth references missing");
const read=structuredClone(sheetTemplate);
read.id=randomUUID();read.name="Read Publication Attempts";read.alwaysOutputData=true;
read.parameters.sheetName={__rl:true,value:"Bible_Publish_Attempts",mode:"name"};
read.position=[1330,750];add(read);
for(const g of byMode)link(g.name,read.name,0);

const keys=["event_id","content_id","content_type","platform","status","remote_id","remote_url","attempted_at_utc","completed_at_utc","error_code","error_message","attempt_number","source_workflow"];
const makeAppend=name=>{
 const a=structuredClone(appendTemplate);
 a.id=randomUUID();a.name=name;a.position=[1500+nodes.length*35,850];
 a.parameters.sheetName={__rl:true,value:"Bible_Publish_Attempts",mode:"name"};
 a.parameters.columns={
  mappingMode:"defineBelow",
  value:Object.fromEntries(keys.map(k=>[k,"={{ $json.ledger."+k+" }}"])),
  matchingColumns:[],
  schema:keys.map(k=>({id:k,displayName:k,required:false,defaultMatch:false,display:true,type:"string",canBeUsedToMatch:true})),
  attemptToConvertTypes:false,convertFieldsToString:false
 };
 return add(a);
};
const claim=code("Claim Platform Once (Fail Closed)",[
 "const data=$('Normalize Publishing Input').first().json;",
 "const platform=({publishYouTube:'youtube',publishFacebook:'facebook',publishInstagram:'instagram'})[data.mode];",
 "if(!platform)throw new Error('Not a public platform mode');",
 "const rows=$input.all().map(x=>x.json??{});",
 "const matching=rows.find(x=>String(x.content_id??'')===data.contentId && String(x.platform??'')===platform && String(x.status??'').trim()!=='');",
 "if(matching)throw new Error('Duplicate-safe stop: '+platform+' already has a claim/status for '+data.contentId+' ('+matching.status+'). Reconcile before retry.');",
 "const utc=new Date().toISOString();",
 "return [{json:{ledger:{event_id:$execution.id+'-claim-'+platform,content_id:data.contentId,content_type:data.contentType,platform,status:'claimed',remote_id:'',remote_url:'',attempted_at_utc:utc,completed_at_utc:'',error_code:'',error_message:'',attempt_number:'1',source_workflow:'GraceBible4PM'},platform}}];"
]);
link(read.name,claim.name);
const appendClaim=makeAppend("Append Publish Claim Before Upload");
link(claim.name,appendClaim.name);
const youtubeMode=ifNode("Claimed YouTube?", "publishYouTube");
const fbMode=ifNode("Claimed Facebook?", "publishFacebook");
link(appendClaim.name,youtubeMode.name);
link(youtubeMode.name,fbMode.name,1);

// YouTube: cloned from existing working 3 Slots YouTube upload, but PUBLIC.
const ytDownload=clone("Download MP4","Public YouTube Download ImageKit MP4");
ytDownload.parameters.url="={{ $('Normalize Publishing Input').first().json.videoUrl }}";
const ytUpload=clone("Upload a video","Public YouTube Upload");
ytUpload.parameters.title="={{ $('Normalize Publishing Input').first().json.title }}";
ytUpload.parameters.options={
 ...ytUpload.parameters.options,
 description:"={{ $('Normalize Publishing Input').first().json.description }}",
 tags:"={{ $('Normalize Publishing Input').first().json.tagsCsv }}",
 privacyStatus:"public"
};
ytUpload.onError="continueRegularOutput";
if(!ytUpload.credentials?.youTubeOAuth2Api?.id)throw Error("Original YouTube OAuth missing");
link(youtubeMode.name,ytDownload.name);
link(ytDownload.name,ytUpload.name);

// Facebook: use the same tested hosted-transfer path as the existing publisher.
// The public request is reachable ONLY through the claimed public-Facebook mode.
link(fbMode.name,"FB Reel Start Upload");
const fbPublic=ifNode("Facebook mode is public after transfer?","publishFacebook");
replace("FB Reel Upload Binary",0,fbPublic.name);
link(fbPublic.name,"Facebook Hosted Draft Transfer Result",1);
const fbBuild=node("FB Reel Build Finish Payload");
fbBuild.disabled=false;
fbBuild.parameters.jsCode=[
 "const start=$('FB Reel Start Upload').first().json;",
 "const data=$('Normalize Publishing Input').first().json;",
 "const settings=$('PUBLISHER SETTINGS - EDIT CLOUDINARY HERE').first().json.publisherSettings;",
 "if(!start.video_id||!settings?.metaAccessToken)throw new Error('Facebook finish missing session or account token');",
 "const body={upload_phase:'finish',access_token:String(settings.metaAccessToken),video_id:String(start.video_id),video_state:'PUBLISHED',title:data.title,description:data.description};",
 "return [{json:{fb_video_id:String(start.video_id),reelTitle:data.title,reelDesc:data.description,publishBody:JSON.stringify(body)}}];"
].join("\n");
const fbFinish=node("FB Reel Finish Upload");fbFinish.disabled=false;
fbFinish.onError="continueRegularOutput";
link(fbPublic.name,fbBuild.name);
link(fbBuild.name,fbFinish.name);
const fbAccept=clone("Private YouTube QA only?","Facebook finish accepted?");
fbAccept.parameters.conditions.conditions[0].leftValue="={{ $json.success === true ? 'ok' : 'error' }}";
fbAccept.parameters.conditions.conditions[0].rightValue="ok";
link(fbFinish.name,fbAccept.name);
const fbStore=node("FB Store Reel ID");fbStore.disabled=false;
const fbWait=node("FB Wait");fbWait.disabled=false;
const fbCheck=node("FB Check Reel Status");fbCheck.disabled=false;fbCheck.onError="continueRegularOutput";
const fbNormalize=node("FB Normalize Reel Status");fbNormalize.disabled=false;
const fbReady=node("FB Reel Ready?");fbReady.disabled=false;
const fbRetry=node("FB Retry or Fail?");fbRetry.disabled=false;
link(fbAccept.name,fbStore.name);
link(fbStore.name,fbWait.name);
link(fbWait.name,fbCheck.name);
link(fbCheck.name,fbNormalize.name);
link(fbNormalize.name,fbReady.name);
link(fbReady.name,fbRetry.name,1);
link(fbRetry.name,fbWait.name,1);

// Instagram: start with tested container creation, then wait for FINISHED.
link(fbMode.name,"IG Create Container",1);
const igPublic=ifNode("Instagram mode is public after container?","publishInstagram");
replace("IG Create Container",0,igPublic.name);
link(igPublic.name,"Instagram Draft Container Result",1);
const igStore=node("IG Store Container ID");igStore.disabled=false;
const igCreated=node("IG Container Created?");igCreated.disabled=false;
const igWait=node("IG Wait");igWait.disabled=false;
const igCheck=node("IG Check Status");igCheck.disabled=false;igCheck.onError="continueRegularOutput";
const igNorm=node("IG Normalize Status");igNorm.disabled=false;
const igReady=node("IG Container Ready?");igReady.disabled=false;
const igRetry=node("IG Retry or Fail?");igRetry.disabled=false;
const igPublish=node("IG Publish");igPublish.disabled=false;igPublish.onError="continueRegularOutput";
const igPermalink=node("IG Read Published Reel Permalink");igPermalink.disabled=false;igPermalink.onError="continueRegularOutput";
const igResult=node("IG Store Result");igResult.disabled=false;
link(igPublic.name,igStore.name);
link(igStore.name,igCreated.name);
link(igCreated.name,igWait.name,1);
link(igWait.name,igCheck.name);
link(igCheck.name,igNorm.name);
link(igNorm.name,igReady.name);
link(igReady.name,igPublish.name);
link(igReady.name,igRetry.name,1);
link(igRetry.name,igWait.name,1);
link(igPublish.name,igPermalink.name);
link(igPermalink.name,igResult.name);

// All platforms write an immutable outcome event. An uncertain result stays
// claimed and never causes an automatic retry or duplicate upload.
const fbFinishUncertain=code("Facebook Finish Uncertain",[
 "const d=$input.first().json??{};",
 "return [{json:{platform:'facebook',status:'uncertain',error_message:'Facebook finish not confirmed: '+String(d.error?.message??d.message??'Unknown response').slice(0,180)}}];"
]);
const fbTimeout=code("Facebook Processing Uncertain",[
 "const d=$input.first().json??{};",
 "return [{json:{platform:'facebook',status:'uncertain',error_message:String(d.fb_fail_reason??'Facebook processing not confirmed').slice(0,180)}}];"
]);
const igCreationFailure=code("Instagram Container Uncertain",[
 "const d=$input.first().json??{};",
 "return [{json:{platform:'instagram',status:'uncertain',error_message:String(d.ig_fail_reason??'Instagram container rejected').slice(0,180)}}];"
]);
const igTimeout=code("Instagram Processing Uncertain",[
 "const d=$input.first().json??{};",
 "return [{json:{platform:'instagram',status:'uncertain',error_message:String(d.ig_fail_reason??'Instagram processing not ready').slice(0,180)}}];"
]);
const igPublishCheck=clone("Private YouTube QA only?","Instagram publish accepted?");
igPublishCheck.parameters.conditions.conditions[0].leftValue="={{ /^\\d+$/.test(String($json.id??'')) ? 'ok' : 'error' }}";
igPublishCheck.parameters.conditions.conditions[0].rightValue="ok";
replace("IG Publish",0,igPublishCheck.name);
link(igPublishCheck.name,igPermalink.name);
const igPublishFailure=code("Instagram Publish Uncertain",[
 "const d=$input.first().json??{};",
 "return [{json:{platform:'instagram',status:'uncertain',error_message:'Instagram publish not confirmed: '+String(d.error?.message??d.message??'Unknown response').slice(0,180)}}];"
]);
link(igPublishCheck.name,igPublishFailure.name,1);
link(fbAccept.name,fbFinishUncertain.name,1);
link(fbRetry.name,fbTimeout.name,0);
link(igCreated.name,igCreationFailure.name,0);
link(igRetry.name,igTimeout.name,0);

const outcome=code("Normalize Actual Platform Outcome",[
 "const mode=$('Normalize Publishing Input').first().json.mode;",
 "const platform=({publishYouTube:'youtube',publishFacebook:'facebook',publishInstagram:'instagram'})[mode];",
 "const input=$input.first().json??{};",
 "let remoteId='',remoteUrl='',status='uncertain',error=String(input.error_message??input.error?.message??'').slice(0,180);",
 "if(platform==='youtube'){remoteId=String(input.id??input.uploadId??input.videoId??'');if(/^[A-Za-z0-9_-]{6,32}$/.test(remoteId)){remoteUrl='https://www.youtube.com/watch?v='+remoteId;status='published';}}",
 "if(platform==='facebook'){remoteId=String(input.fb_video_id??'');remoteUrl=String(input.fb_reel_url??'');if(input.fb_ready===true && input.fb_failed!==true && /^\\d+$/.test(remoteId))status='published';}",
 "if(platform==='instagram'){remoteId=String(input.ig_media_id??'');remoteUrl=String(input.ig_reel_url??'');if(input.ig_status==='published' && /^\\d+$/.test(remoteId))status='published';}",
 "if(status!=='published'&&!error)error='Upload or publish status not independently confirmed; manual reconciliation required';",
 "const data=$('Normalize Publishing Input').first().json;",
 "const utc=new Date().toISOString();",
 "const ledger={event_id:$execution.id+'-outcome-'+platform,content_id:data.contentId,content_type:data.contentType,platform,status,remote_id:remoteId,remote_url:remoteUrl,attempted_at_utc:utc,completed_at_utc:utc,error_code:status==='published'?'':'UNCONFIRMED',error_message:error,attempt_number:'1',source_workflow:'GraceBible4PM'};",
 "return [{json:{ledger,publicResult:{contentId:data.contentId,platform,status,remoteId,remoteUrl,error,automatedPublicPublishing:true}}}];"
]);
for(const name of [ytUpload.name,fbReady.name,fbFinishUncertain.name,fbTimeout.name,igResult.name,igCreationFailure.name,igTimeout.name,igPublishFailure.name]){
 if(name===fbReady.name)link(name,outcome.name,0);
 else link(name,outcome.name);
}
const appendResult=makeAppend("Record Publish Outcome In Ledger");
link(outcome.name,appendResult.name);
const last=code("Return Per-Platform Publish Receipt",[
 "const result=$('Normalize Actual Platform Outcome').first().json.publicResult;",
 "if(!result||!result.platform)throw new Error('No platform receipt');",
 "return [{json:result}];"
]);
link(appendResult.name,last.name);

// Validate graph safety and no direct external triggers. Only the mode-specific
// claimed paths can reach public upload/finish/publish operations.
const reachable=start=>{
 const seen=new Set(),todo=[start];
 while(todo.length){const n=todo.shift();if(seen.has(n))continue;seen.add(n);for(const x of (edges[n]?.main??[]).flat().filter(Boolean))todo.push(x.node);}
 return seen;
};
const live=reachable("When called by a content slot");
for(const name of ["Public YouTube Upload","FB Reel Finish Upload","IG Publish"]){
 if(!live.has(name))throw Error("Public branch missing from graph: "+name);
}
if(nodes.find(n=>n.name==="Upload a video")?.parameters?.options?.privacyStatus!=="private")throw Error("Private QA YouTube path changed");
if(!nodes.find(n=>n.name==="Public YouTube Upload")?.parameters?.options?.privacyStatus==="public")throw Error("Public YouTube upload not configured");
if(nodes.some(n=>!n.disabled&&/scheduleTrigger|webhook/.test(n.type)))throw Error("Shared publisher cannot have an external schedule/webhook");
if(!edges["Read Publication Attempts"]?.main?.[0]?.length || !edges["Append Publish Claim Before Upload"]?.main?.[0]?.length)throw Error("Claim ledger disconnected");

const expected=nodes.length;
console.log(JSON.stringify({dryRun:process.env.APPLY_PUBLIC!=="true",sharedId:SHARED,existingNodes:shared.nodes.length,newNodes:expected,publicModes:modes,ledger:"Bible_Publish_Attempts",noExternalTriggers:true,originalThreeSlotsUntouched:true},null,2));
if(process.env.APPLY_PUBLIC!=="true")process.exit(0);
await request("/workflows/"+SHARED+"?publishIfActive=false","PUT",{name:shared.name,nodes,connections:edges,settings:shared.settings});
await request("/workflows/"+SHARED+"/publish","POST");
const updated=await request("/workflows/"+SHARED);
if(updated.nodes.length!==expected||!updated.activeVersionId)throw Error("Shared publisher readback mismatch after publish");
console.log("SHARED PUBLIC PUBLISHER DEPLOYED",JSON.stringify({id:SHARED,nodeCount:updated.nodes.length,internalOnly:true,modes,ledger:"Bible_Publish_Attempts"}));
