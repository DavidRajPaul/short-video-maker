
import fs from "node:fs/promises";
const API="https://meetdavidraj7.n8n-wsk.com/api/v1";
const TOKEN=process.env.N8N_API_KEY;
const ID="nB10Ub0ZIxCe5gHI";
if(!TOKEN)throw Error("Missing N8N_API_KEY");
const response=await fetch(API+"/workflows/"+ID,{headers:{"X-N8N-API-KEY":TOKEN},signal:AbortSignal.timeout(30000)});
if(!response.ok)throw Error("Read workflow HTTP "+response.status);
const live=await response.json();
if(!live.activeVersionId||live.settings?.timezone!=="Asia/Kolkata"||live.nodes.length!==29)
 throw Error("Unexpected active 4PM quiz state");
const fixture=JSON.parse(await fs.readFile(new URL("./n8n-bible-teaser-4pm-draft.json",import.meta.url),"utf8"));
const incoming=fixture.nodes.find(n=>n.name==="Choose Unused Verified Puzzle")?.parameters.jsCode;
const target=live.nodes.find(n=>n.name==="Choose Unused Verified Puzzle");
if(!incoming||!target?.parameters?.jsCode)throw Error("Missing quiz bank code");
function bank(s){
 const m=s.match(/const BANK=(\[[^\n]*\]);/);
 if(!m)throw Error("Bank syntax unexpected");
 return {m,items:JSON.parse(m[1])};
}
const newer=bank(incoming),older=bank(target.parameters.jsCode);
if(newer.items.length<70)throw Error("Expanded bank below two-month safety threshold");
if(older.items.length>newer.items.length)throw Error("Current bank larger than proposed; refusing overwrite");
for(let i=0;i<older.items.length;i++){
 if(older.items[i][0]!==newer.items[i][0])throw Error("Existing approved quiz bank item changed at "+i);
}
console.log(JSON.stringify({workflow:ID,existing:older.items.length,approved:newer.items.length,apply:process.env.APPLY_BANK==="true",originalThreeSlotsUntouched:true},null,2));
if(older.items.length===newer.items.length){console.log("BANK ALREADY SYNCED");process.exit(0);}
if(process.env.APPLY_BANK!=="true")process.exit(0);
target.parameters.jsCode=target.parameters.jsCode.replace(older.m[0],"const BANK="+JSON.stringify(newer.items)+";");
const put=await fetch(API+"/workflows/"+ID+"?publishIfActive=false",{method:"PUT",headers:{"X-N8N-API-KEY":TOKEN,"Content-Type":"application/json"},body:JSON.stringify({name:live.name,nodes:live.nodes,connections:live.connections,settings:live.settings}),signal:AbortSignal.timeout(30000)});
if(!put.ok)throw Error("Bank sync PUT HTTP "+put.status+" "+(await put.text()).slice(0,200));
const pub=await fetch(API+"/workflows/"+ID+"/publish",{method:"POST",headers:{"X-N8N-API-KEY":TOKEN},signal:AbortSignal.timeout(30000)});
if(!pub.ok)throw Error("Bank publishing HTTP "+pub.status+" "+(await pub.text()).slice(0,180));
const check=await fetch(API+"/workflows/"+ID,{headers:{"X-N8N-API-KEY":TOKEN},signal:AbortSignal.timeout(30000)});
if(!check.ok)throw Error("Readback failed");
const updated=await check.json();
const actual=bank(updated.nodes.find(n=>n.name==="Choose Unused Verified Puzzle").parameters.jsCode).items.length;
if(!updated.activeVersionId||updated.nodes.length!==29||actual!==newer.items.length)throw Error("Bank sync verification failed");
console.log("ACTIVE QUIZ BANK SYNCED",JSON.stringify({approved:actual,workflowId:ID,scheduled:true,originalThreeSlotsUnchanged:true}));
