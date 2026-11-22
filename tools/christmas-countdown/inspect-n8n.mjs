// READ-ONLY inspection: prints node names + sanitized connections, never settings or credentials.
const base = "https://meetdavidraj7.n8n-wsk.com/api/v1";
const token = process.env.N8N_API_KEY;
if (!token) throw new Error("N8N_API_KEY secret missing");
const res = await fetch(base + "/workflows/TCMiKoaj2xkNvK1L", {
  headers: { "X-N8N-API-KEY": token }, signal: AbortSignal.timeout(25000),
});
if (!res.ok) throw new Error("n8n workflow inspection returned HTTP " + res.status);
const workflow = await res.json();
const nodes = workflow.nodes ?? [];
const interesting = /quote|afternoon|schedule|trigger|slot|format|publish|post|image|upload|render|cloudinary|railway/i;
const selected = nodes.filter(n => interesting.test(n.name));
const connections = [];
for (const [source, outputs] of Object.entries(workflow.connections || {})) {
  for (const [index, edges] of (outputs.main || []).entries()) {
    for (const edge of edges || []) {
      if (interesting.test(source) || interesting.test(edge.node)) {
        connections.push({ from: source, branch: index, to: edge.node });
      }
    }
  }
}
const scheduleNodes=nodes.filter(n=>/scheduleTrigger|cron/.test(n.type));
console.log(JSON.stringify({
  name: workflow.name, active: workflow.active, nodeCount: nodes.length,
  selected: selected.map(n=>({name:n.name,type:n.type,disabled:!!n.disabled,position:n.position})),
  scheduleNodes:scheduleNodes.map(n=>({name:n.name,type:n.type})),
  connections,
}, null, 2));
