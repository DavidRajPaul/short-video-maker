import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// n8n Code nodes use a top-level return. Execute the exported node body using
// a mock $input rather than importing it as an ordinary JavaScript module.
const source = fs.readFileSync(path.join(process.cwd(), "integrations/n8n/expressive-narration.code.js"), "utf8");
function run(json: Record<string, unknown>) {
  const execute = new Function("$input", source);
  return execute({ all: () => [{ json }] })[0].json;
}
const terms = ["bible", "church"];

describe("n8n expressive narration adapter", () => {
  it("emits scripture first with exact source text and no spoken direction tags", () => {
    const verse = "The Lord is my shepherd; I shall not want.";
    const result = run({
      format: "evening_verse",
      verseText: verse,
      verseReference: "Psalm 23:1",
      explanationText: "You do not walk alone.",
      prayerText: "Father, guide us. Amen.",
      searchTerms: terms,
    });
    expect(result.renderPayload.scenes.map((s: {text:string})=>s.text))
      .toEqual([verse, "You do not walk alone.", "Father, guide us. Amen."]);
    expect(result.renderPayload.scenes[0].narration.segments[0]).toEqual({
      text: verse, delivery: "reverent", pauseAfterMs: 900,
    });
    expect(result.renderPayload.config).toMatchObject({
      narrationProfile: {mood: "uplifting", intensity: 75},
      speechSpeed: 0.9, coverSubtitle: "Psalm 23:1", strictChristianVisuals: true,
    });
    expect(result.narrationValidation.readyToPublish).toBe(false);
  });

  it("supports morning and intense prayers without claiming native emotional strength", () => {
    const morning = run({
      format: "morning_prayer", prayerText: "Thank you, Lord. Amen.", searchTerms: terms,
    });
    expect(morning.renderPayload.scenes[0].narration.segments[0].delivery).toBe("uplifting");
    const intense = run({
      format: "intense_prayer", prayerText: "God is here. Give us courage.",
      prayerSegments: [{text:"God is here."},{text:"Give us courage."}], searchTerms:terms,
    });
    expect(intense.renderPayload.scenes[0].narration.segments.map((s:{pauseAfterMs:number})=>s.pauseAfterMs))
      .toEqual([450,800]);
    expect(intense.renderPayload.scenes[0].narration.segments[0].delivery).toBe("powerful");
  });

  it("rejects missing verses, stage directions and mismatched speech", () => {
    const good = {format:"evening_verse",verseText:"Jesus wept.",verseReference:"John 11:35",
      explanationText:"God cares.",prayerText:"Amen.",searchTerms:terms};
    expect(()=>run({...good,verseText:""})).toThrow(/verseText/);
    expect(()=>run({...good,verseText:"[whispers] Jesus wept."})).toThrow(/audio directions/);
    expect(()=>run({format:"morning_prayer",prayerText:"God is good.",
      prayerSegments:[{text:"Different sentence."}],searchTerms:terms})).toThrow(/match/);
  });

  it("cannot be tricked into publishing by upstream item flags", () => {
    const result = run({
      format:"morning_prayer", prayerText:"Thank you, Lord.",searchTerms:terms,
      narrationValidation:{readyToPublish:true},renderConfig:{speechSpeed:1.2,narrationProfile:{intensity:100}},
    });
    expect(result.narrationValidation.readyToPublish).toBe(false);
    expect(result.renderPayload.config.speechSpeed).toBe(0.9);
    expect(result.renderPayload.config.narrationProfile.intensity).toBe(75);
  });
});
