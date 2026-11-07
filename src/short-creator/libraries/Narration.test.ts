import { describe, expect, it } from "vitest";
import { planNarration, cleanSpokenText } from "./NarrationPlanner";
import { composeNarrationAudio } from "./NarrationAudio";
import { renderConfig, sceneInput } from "../../types/shorts";

function wavForDuration(durationMs: number): ArrayBuffer {
  const samples = Math.round(durationMs * 16);
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write("data", 36); wav.writeUInt32LE(samples * 2, 40);
  return Uint8Array.from(wav).buffer;
}

describe("Kokoro-safe narration", () => {
  it("never forwards markup or known audio directions into speech", () => {
    expect(cleanSpokenText("**Hope** [whispers] [John 3:16](https://example.org) <break time='1s'/> again"))
      .toBe("Hope John 3:16 again");
    expect(cleanSpokenText("The answer is [Psalm 23], not a production direction."))
      .toContain("[Psalm 23]");
    expect(() => cleanSpokenText("[gasp] Trust in God.")).toThrow(/Unrecognized/);
  });

  it("keeps legacy scene behavior without opting into the profile", () => {
    const scene = sceneInput.parse({text:"Hello. Good morning.", searchTerms:["morning"]});
    const plan = planNarration(scene, renderConfig.parse({}));
    expect(plan.segments).toHaveLength(1);
    expect(plan.speed).toBe(1);
    expect(plan.segments[0].pauseAfterMs).toBe(0);
  });

  it("defaults to uplifting 75 percent and 0.9x on opt in", () => {
    const scene = sceneInput.parse({text:"God is near. Take courage.", searchTerms:["prayer"]});
    const plan = planNarration(scene, renderConfig.parse({narrationProfile:{}}));
    expect(plan.mood).toBe("uplifting");
    expect(plan.intensity).toBe(75);
    expect(plan.speed).toBe(0.9);
    expect(plan.segments.map(s=>s.pauseAfterMs)).toEqual([350,0]);
  });

  it("preserves scripture order and rejects substituted segment content", () => {
    const scene = sceneInput.parse({
      text:"The Lord is my shepherd. You are not alone.",
      searchTerms:["bible"],
      narration:{segments:[
        {text:"The Lord is my shepherd.",delivery:"reverent",pauseAfterMs:900},
        {text:"You are not alone.",delivery:"uplifting",pauseAfterMs:500},
      ]},
    });
    expect(planNarration(scene, renderConfig.parse({narrationProfile:{}})).segments.map(x=>x.text))
      .toEqual(["The Lord is my shepherd.","You are not alone."]);
    expect(() => planNarration({...scene, text:"Different Bible verse."}, renderConfig.parse({})))
      .toThrow(/must match/);
  });

  it("rejects invalid pauses and empty narration", () => {
    expect(() => sceneInput.parse({text:"Hello",searchTerms:[],narration:{segments:[{text:"Hello",pauseAfterMs:3000}]}}))
      .toThrow();
    expect(() => planNarration(sceneInput.parse({text:"[whispers]",searchTerms:[]}),renderConfig.parse({})))
      .toThrow(/Empty narration/);
  });
});

describe("sample-accurate captions and silence", () => {
  it("inserts real PCM silence and offsets transcript timestamps", () => {
    const first = wavForDuration(1000), second = wavForDuration(500);
    const result = composeNarrationAudio([
      {wav:first,captions:[{text:"God",startMs:100,endMs:400}],pauseAfterMs:900},
      {wav:second,captions:[{text:"helps",startMs:100,endMs:300}],pauseAfterMs:0},
    ]);
    expect(result.audioLength).toBe(2.4);
    expect(result.captions).toEqual([
      {text:"God",startMs:100,endMs:400},
      {text:"helps",startMs:2000,endMs:2200},
    ]);
    const bytes = Buffer.from(result.audio);
    expect(bytes.readUInt32LE(40)).toBe(2.4 * 16000 * 2);
    // Beginning of inserted silence: 44-byte header + 1000 ms at 32 bytes/ms.
    expect(bytes.subarray(32044, 32044 + 900 * 32).every(b=>b===0)).toBe(true);
  });

  it("rejects incompatible WAV input and invalid timestamps", () => {
    expect(()=>composeNarrationAudio([{wav:new ArrayBuffer(30),captions:[],pauseAfterMs:0}])).toThrow();
    expect(()=>composeNarrationAudio([{wav:wavForDuration(500),captions:[{text:"bad",startMs:700,endMs:800}],pauseAfterMs:0}]))
      .toThrow(/exceeds/);
  });
});
