// Read-only, secret-safe inspection of the live Christmas afternoon schedule.
const api="https://meetdavidraj7.n8n-wsk.com/api/v1";
const key=process.env.N8N_API_KEY;
if(!key)throw Error("N8N_API_KEY missing");
const res=await fetch(api+"/workflows/TCMiKoaj2xkNvK1L",{headers:{"X-N8N-API-KEY":key},signal:AbortSignal.timeout(30000)});
if(!res.ok)throw Error("Workflow inspection HTTP "+res.status);
const w=await res.json();
const names=/schedule|cron|time|Is Afternoon Quote\?|Christmas 2026 Date Gate|Christmas Active Today\?|Run Christmas Video Instead of Quote/i;
const nodes=w.nodes.filter(n=>names.test(n.name)||/scheduleTrigger|cron/.test(n.type)).map(n=>({
  name:n.name,type:n.type,disabled:!!n.disabled,
  // Schedule nodes contain only public posting times; avoid dumping any other parameters.
  schedule: /scheduleTrigger|cron/.test(n.type) ? (n.parameters?.rule??n.parameters?.triggerTimes??n.parameters?.cronExpression??n.parameters?.interval??null) : undefined,
  inputBranchNames:/Is Afternoon Quote\?/.test(n.name)?Object.keys(w.connections[n.name]||{}):undefined,
}));
console.log(JSON.stringify({workflowName:w.name,active:!!w.activeVersionId,
  timezone:w.settings?.timezone??"instance default (needs inspection)",nodes,
  christmasRoute:w.connections["Is Afternoon Quote?"]?.main?.[0]?.map(x=>x.node)},null,2));
