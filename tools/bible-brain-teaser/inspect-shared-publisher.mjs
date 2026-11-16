const ROOT="https://meetdavidraj7.n8n-wsk.com/api/v1";
const TOKEN=process.env.N8N_API_KEY;if(!TOKEN)throw Error("Missing N8N_API_KEY");
const req=async path=>{const r=await fetch(ROOT+path,{headers:{"X-N8N-API-KEY":TOKEN},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(path+" HTTP "+r.status);return r.json()};
const [orig,quiz,staging]=await Promise.all([req("/workflows/TCMiKoaj2xkNvK1L"),req("/workflows/iEiu5vka5sAVMxMl"),req("/workflows/nB10Ub0ZIxCe5gHI")]);
for(const wf of [orig,quiz,staging])console.log("WORKFLOW",JSON.stringify({id:wf.id,name:wf.name,active:wf.active,nodeCount:wf.nodes.length,timezone:wf.settings?.timezone}));
const executions=await req("/executions?workflowId=nB10Ub0ZIxCe5gHI&limit=3");console.log("STAGING EXECUTIONS",(executions.data??[]).map(e=>({id:e.id,status:e.status,startedAt:e.startedAt,stoppedAt:e.stoppedAt})));
const names=[
"Download MP4","Prepare YouTube Data","Upload a video","YT Wait for Processing","YT Check Processing","YT Validate Processing","YT Processing Ready?","YT Download Cover JPEG","YT Set Custom Cover","YT Cover Skipped?","YT Continue Without Cover","Prepare Published Video Row","Mark Verse Used","Append Published Video","Edit Fields","FB Reel Start Upload","FB Re-Download MP4","FB Binary Merge","FB Binary Check","FB Calc File Size","FB Reel Upload Binary","FB Reel Build Finish Payload","FB Reel Finish Upload","FB Store Reel ID","FB Wait","FB Check Reel Status","FB Normalize Reel Status","FB Reel Ready?","FB Retry or Fail?","FB Handle Failure","IG Create Container","IG Store Container ID","IG Container Created?","IG Wait","IG Check Status","IG Normalize Status","IG Container Ready?","IG Retry or Fail?","IG Handle Failure","IG Publish","IG Read Published Reel Permalink","IG Store Result","Merge YT + FB + IG",
"Build Movie Payload","Parse Script","Store Video ID","PUBLISHER SETTINGS - EDIT CLOUDINARY HERE"
];
function refs(obj){const result=new Set();const props=new Set();function scan(x){if(typeof x==="string"){
for(const m of x.matchAll(/\$\(['"]([^'"]+)['"]\)|\$node\[['"]([^'"]+)['"]\]/g))result.add(m[1]??m[2]);
for(const m of x.matchAll(/(?:\$json|\.json)\??\.([a-zA-Z_][\w]*)/g))props.add(m[1]);
} else if(Array.isArray(x))x.forEach(scan);else if(x&&typeof x==="object")Object.values(x).forEach(scan)}scan(obj);return {refs:[...result].sort(),props:[...props].sort()};}
for(const name of names){
const n=orig.nodes.find(n=>n.name===name);if(!n){console.log("MISSING",name);continue}
const next=(orig.connections?.[name]?.main??[]).map((edges,i)=>edges.filter(Boolean).map(e=>e.node));
const p=n.parameters??{};
console.log("NODE",JSON.stringify({name,type:n.type,resource:p.resource??"",operation:p.operation??"",parameterKeys:Object.keys(p),optionsKeys:Object.keys(p.options??{}),credentialTypes:Object.keys(n.credentials??{}),refs:refs(p),next,binaryOption:p.inputDataFieldName??p.binaryPropertyName??null,assignments:p.assignments?.assignments?.map(a=>a.name)??[],formFields:p.bodyParameters?.parameters?.map(a=>a.name)??[],queryFields:p.queryParameters?.parameters?.map(a=>a.name)??[]}));
}
