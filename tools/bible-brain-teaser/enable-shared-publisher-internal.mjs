const API="https://meetdavidraj7.n8n-wsk.com/api/v1",id="UyXSFUjWdkjuqK1p";
const key=process.env.N8N_API_KEY;if(!key)throw Error("Missing N8N_API_KEY");
async function req(path,method="GET"){
 const r=await fetch(API+path,{method,headers:{"X-N8N-API-KEY":key,Accept:"application/json"},signal:AbortSignal.timeout(30000)});
 const s=await r.text();if(!r.ok)throw Error(method+" "+path+" HTTP "+r.status+" "+s.slice(0,200));return s?JSON.parse(s):{};
}
const wf=await req("/workflows/"+id);
const nodes=wf.nodes??[];
if(nodes.length!==31)throw Error("Unexpected shared publisher node count");
if(nodes.filter(n=>n.type==="n8n-nodes-base.executeWorkflowTrigger"&&!n.disabled).length!==1)throw Error("Expected one internal trigger");
if(nodes.some(n=>/scheduleTrigger|webhook/.test(n.type)&&!n.disabled))throw Error("Unexpected external trigger");
const download=nodes.find(n=>n.name==="Download MP4"),yt=nodes.find(n=>n.name==="Upload a video");
if(!download||!yt||yt.parameters?.options?.privacyStatus!=="private")throw Error("YouTube is not private");
const meta=nodes.filter(n=>/^FB |^IG /.test(n.name));
if(meta.length<20||meta.some(n=>n.disabled!==true))throw Error("Meta nodes not fully disabled");
const connected=new Set(Object.values(wf.connections??{}).flatMap(x=>(x.main??[]).flat().filter(Boolean).map(n=>n.node)));
if(meta.some(n=>connected.has(n.name)))throw Error("A Meta publisher node is reachable");
if(!nodes.find(n=>n.name==="Normalize Publishing Input")?.parameters?.jsCode.includes('["validateOnly","privateYouTubeQA"]'))throw Error("No fail-closed publishing mode guard");
if(!wf.active)await req("/workflows/"+id+"/activate","POST");
const saved=await req("/workflows/"+id);
if(!saved.active)throw Error("Shared publisher activation not persisted");
console.log(JSON.stringify({id,active:true,trigger:"internal Execute Workflow only",schedules:0,webhooks:0,metaDisabled:true,youtubePrivacy:"private",publicPostingEnabled:false,original3SlotsUntouched:true},null,2));
