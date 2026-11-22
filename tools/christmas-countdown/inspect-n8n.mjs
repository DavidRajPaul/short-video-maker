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

const quizRes = await fetch(base + "/workflows/nB10Ub0ZIxCe5gHI", {
  headers: { "X-N8N-API-KEY": token }, signal: AbortSignal.timeout(25000),
});
if (!quizRes.ok) throw new Error("Quiz workflow inspection HTTP " + quizRes.status);
const quiz = await quizRes.json();
const links = Object.entries(quiz.connections || {}).flatMap(([source, o]) =>
  (o.main || []).flatMap((edges,i) => (edges || []).map(e => ({from:source,branch:i,to:e.node}))));
const summary = quiz.nodes.map(n => ({
  name:n.name,type:n.type,disabled:!!n.disabled,position:n.position,
  configKeys: Object.keys(n.parameters || {}),
})).filter(n => !/settings|config|credentials|token/i.test(n.name));
console.log("QUIZ_TOPOLOGY=" + JSON.stringify({active:quiz.active,nodeCount:quiz.nodes.length,nodes:summary,links}));

const wanted = /PRIVATE Quiz Video|Store PRIVATE Render|Quiz Check Railway|Quiz Render Ready|Quiz Abort|Quiz Archive|Quiz Verify Permanent|Prepare .* Public Quiz Input|Publish Quiz to /;
const parameterUsage = quiz.nodes.filter(n => wanted.test(n.name)).map(n => {
  const p = JSON.stringify(n.parameters || {});
  const refs = [...p.matchAll(/\\$\\(['"]([^'"]+)['"]\\)/g)].map(x => x[1]);
  const fieldRefs = [...p.matchAll(/\\$json\\.([A-Za-z_][A-Za-z_0-9]*)/g)].map(x => x[1]);
  return { name: n.name, refs:[...new Set(refs)], fieldRefs:[...new Set(fieldRefs)],
    mentionsVideoId:p.includes("videoId"), mentionsImageKit:p.includes("imagekit"), mentionsPuzzle:p.includes("puzzle") };
});
console.log("QUIZ_DEPENDENCIES=" + JSON.stringify(parameterUsage));
