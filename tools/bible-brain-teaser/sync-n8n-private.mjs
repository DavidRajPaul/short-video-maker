import fs from "node:fs/promises";

const BASE = "https://meetdavidraj7.n8n-wsk.com/api/v1";
const ORIGINAL_ID = "TCMiKoaj2xkNvK1L";
const TARGET_ID = "iEiu5vka5sAVMxMl";
const FILE = new URL("./n8n-bible-teaser-4pm-draft.json", import.meta.url);
const secret = process.env.N8N_API_KEY;
const apply = process.env.APPLY === "true";

if (!secret) throw new Error("Missing N8N_API_KEY GitHub Actions secret. Do not paste keys into chat or code.");
const request = async (path, options = {}) => {
  const response = await fetch(BASE + path, {
    ...options,
    headers: { "X-N8N-API-KEY": secret, Accept:"application/json",
      ...(options.body ? {"Content-Type":"application/json"} : {}) },
    signal: AbortSignal.timeout(30000)
  });
  const data = await response.text();
  if (!response.ok) throw new Error(`n8n API ${response.status} ${path}: ${data.slice(0,400)}`);
  return data ? JSON.parse(data) : {};
};

const [original, target] = await Promise.all([
  request("/workflows/" + ORIGINAL_ID),
  request("/workflows/" + TARGET_ID)
]);
if (target.active || target.activeVersion) {
  throw new Error("Target is already published/active. Aborting rather than overwrite a live workflow.");
}
if (original.id !== ORIGINAL_ID || target.id !== TARGET_ID)
  throw new Error("Workflow IDs do not match expected originals.");

const source = original.nodes.find(n=> n.type==="n8n-nodes-base.googleSheets"
  && n.credentials?.googleSheetsOAuth2Api?.id);
if (!source) throw new Error("No existing Google Sheets OAuth credential on the original workflow.");
const credential = source.credentials.googleSheetsOAuth2Api;
const template = JSON.parse(await fs.readFile(FILE,"utf8"));
if (template.active || template.nodes.length!==6 || template.settings.timezone!=="Asia/Kolkata")
  throw new Error("Refusing unexpected private-preview template shape.");
if (template.nodes.filter(n=>n.type==="n8n-nodes-base.scheduleTrigger").length!==1
 || template.nodes[0].parameters.rule.interval[0].expression!=="0 16 * * *")
  throw new Error("Refusing wrong cron.");
if (template.nodes.some(n=>/youtube|facebook|instagram|publish/i.test(n.type+" "+n.name)))
  throw new Error("Private preview must not contain social publishing nodes.");

const sheets=template.nodes.filter(n=>n.type==="n8n-nodes-base.googleSheets");
if (sheets.length!==2) throw new Error("Expected exactly two Google Sheets nodes.");
for (const node of sheets) node.credentials={googleSheetsOAuth2Api:{id:credential.id,name:credential.name}};
const required = {name:template.name,nodes:template.nodes,connections:template.connections,
  settings:template.settings};
console.log(JSON.stringify({
  targetWorkflowId:TARGET_ID,apply,originalUntouched:true,
  nodeNames:template.nodes.map(n=>n.name),
  credentialAttachedTo:sheets.map(n=>n.name),
  cron:template.nodes[0].parameters.rule.interval[0].expression,
  timezone:template.settings.timezone,
  oldTargetNodeCount:target.nodes?.length
},null,2));

if (!apply) {
  console.log("DRY RUN COMPLETE. Use GitHub Actions 'apply=true' after reviewing logs.");
  process.exit(0);
}
await request("/workflows/"+TARGET_ID+"?publishIfActive=false",{
  method:"PUT",body:JSON.stringify(required)
});
const updated=await request("/workflows/"+TARGET_ID);
if (updated.nodes.length!==6 || updated.nodes.filter(n=>n.credentials?.googleSheetsOAuth2Api?.id===credential.id).length!==2)
  throw new Error("Update readback mismatch; inspect n8n target before any further action.");
if (updated.active || updated.activeVersion)
  throw new Error("Target unexpectedly active after update!");
console.log("APPLIED and VERIFIED. Target remains UNPUBLISHED; no social publishing nodes.");
