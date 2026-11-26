// Import or deploy only after provisioning an n8n Header Auth credential.
// No production workflows are edited and no public upload is made by this script.
import {randomUUID} from 'node:crypto';
export function buildBridge({credentialId,credentialName,webhookPath='grace-creator-studio-v1'}){
 if(!credentialId||!credentialName||!/^[a-z0-9-]{10,100}$/.test(webhookPath))throw Error('Dedicated header authentication required');
 const id=()=>randomUUID();
 const nodes=[
 {id:id(),name:'Authenticated Studio Request',type:'n8n-nodes-base.webhook',typeVersion:2.1,webhookId:id(),position:[0,0],parameters:{httpMethod:'POST',path:webhookPath,authentication:'headerAuth',responseMode:'lastNode',responseData:'firstEntryJson',options:{}},credentials:{httpHeaderAuth:{id:credentialId,name:credentialName}}},
 {id:id(),name:'Validate Studio Input',type:'n8n-nodes-base.code',typeVersion:2,position:[250,0],parameters:{mode:'runOnceForAllItems',jsCode:"const p=$input.first().json.body?.publisherInput; if(!p || p.contentType!=='generic' || !/^manual-[a-f0-9]{40}$/.test(p.contentId) || !['validateOnly','publishYouTube','publishFacebook','publishInstagram'].includes(p.mode) || !/^https:\\/\\/ik\\.imagekit\\.io\\/[^\\s?#]+\\.mp4$/.test(p.videoUrl))throw Error('Invalid creator request'); return [{json:{publisherInput:p}}];"}},
 {id:id(),name:'Call Existing Shared Publisher',type:'n8n-nodes-base.executeWorkflow',typeVersion:1.3,position:[500,0],parameters:{source:'database',workflowId:{__rl:true,value:'UyXSFUjWdkjuqK1p',mode:'id'},mode:'once',options:{waitForSubWorkflow:true}}}
 ];
 const connections=Object.fromEntries(nodes.slice(0,-1).map((n,i)=>[n.name,{main:[[{node:nodes[i+1].name,type:'main',index:0}]]}]));
 return {name:'Grace In A Minute - Creator Studio Intake',nodes,connections,settings:{timezone:'Asia/Kolkata',executionOrder:'v1'}};
}
if(process.argv[1]&&import.meta.url.endsWith('/n8n-bridge.mjs')&&process.argv[1].endsWith('n8n-bridge.mjs')){
 const w=buildBridge({credentialId:process.env.STUDIO_N8N_HEADER_CREDENTIAL_ID,credentialName:process.env.STUDIO_N8N_HEADER_CREDENTIAL_NAME});
 if(process.env.STUDIO_CREATE_DRAFT!=='true')console.log(JSON.stringify(w,null,2));
 else {
 const key=process.env.N8N_API_KEY;if(!key)throw Error('Missing n8n API credential');
 const root='https://meetdavidraj7.n8n-wsk.com/api/v1';
 const headers={'X-N8N-API-KEY':key,'content-type':'application/json'};
 const l=await fetch(root+'/workflows?limit=100',{headers,signal:AbortSignal.timeout(20000)});if(!l.ok)throw Error('Workflow lookup failed');
 const list=await l.json();if(list.nextCursor)throw Error('Workflow inventory incomplete; inspect before creating draft');if(list.data.some(x=>x.name===w.name))throw Error('Intake already exists; inspect rather than duplicate');
 const r=await fetch(root+'/workflows',{method:'POST',headers,body:JSON.stringify(w),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Draft creation failed: '+r.status);const x=await r.json();console.log(JSON.stringify({id:x.id,active:x.active}));if(x.active)throw Error('Unexpected active workflow');
 }
}
