import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const workflow=JSON.parse(readFileSync(new URL("./n8n-bible-teaser-4pm-draft.json",import.meta.url),"utf8"));
const node=name=>workflow.nodes.find(n=>n.name===name);
const choose=node("Choose Unused Verified Puzzle");
const run=(rows=[])=>new Function("$input", choose.parameters.jsCode)({all:()=>rows.map(json=>({json}))});
test("private scheduled quiz has IST timezone and exactly one daily trigger",()=>{
 assert.equal(workflow.active,false);
 assert.equal(workflow.settings.timezone,"Asia/Kolkata");
 assert.equal(workflow.nodes.filter(n=>n.type==="n8n-nodes-base.scheduleTrigger").length,1);
 assert.equal(node("Bible Quiz — 4 PM IST").parameters.rule.interval[0].expression,"0 16 * * *");
 assert.equal(workflow.nodes.length,6);
});
test("Google Sheets history is read and reserved before private rendering",()=>{
 const read=node("Read Bible Puzzle History"),save=node("Reserve Puzzle in History");
 assert.equal(read.parameters.documentId.value,"1GEw7bdgmqC9bb6lfAdJV9ILkRa23qSbW_-6nn6XHqSk");
 assert.equal(read.parameters.sheetName.value,"Bible_Puzzle_History");
 assert.equal(save.parameters.sheetName.value,"Bible_Puzzle_History");
 assert.deepEqual(save.parameters.columns.schema.map(col=>col.id),Object.keys(save.parameters.columns.value));
 assert.equal(read.alwaysOutputData,true);
 const links=n=>workflow.connections[n]?.main?.[0]?.[0]?.node;
 assert.equal(links("Read Bible Puzzle History"),"Choose Unused Verified Puzzle");
 assert.equal(links("Choose Unused Verified Puzzle"),"Reserve Puzzle in History");
 assert.equal(links("Reserve Puzzle in History"),"Create PRIVATE Quiz Video — Railway");
});
test("no video publishing or uploaded answers in the render pipeline",()=>{
 assert.ok(!workflow.nodes.some(n=>/youtube|facebook|instagram|publish/i.test(n.name+" "+n.type)));
 const item=run()[0].json;
 assert.equal(item.previewOnly,true);
 assert.equal(item.autoPublish,false);
 assert.equal(item.renderRequest.config.voice,"am_michael");
 assert.equal(item.renderRequest.config.orientation,"portrait");
 assert.match(item.caption,/ANSWER:/);
 assert.ok(item.renderRequest.scenes.every(s=>!s.text.includes(item.answer) && !s.text.includes("ANSWER:")));
});
test("history avoids exact, canonical, and answer-fact repetitions",()=>{
 const first=run()[0].json;
 const second=run([{puzzle_id:first.puzzleId}])[0].json;
 assert.notEqual(second.puzzleId,first.puzzleId);
 assert.notEqual(run([{canonical_concept:first.concept}])[0].json.puzzleId,first.puzzleId);
 assert.notEqual(run([{answer_fact_id:first.fact}])[0].json.puzzleId,first.puzzleId);
 const bank=JSON.parse(choose.parameters.jsCode.match(/const BANK=(\[[^;]+\]);/)[1]);
 const all=bank.map(p=>({puzzle_id:p[0]}));
 assert.throws(()=>run(all),/bank exhausted/);
});
