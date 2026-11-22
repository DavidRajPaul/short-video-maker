import { describe, expect, it } from "vitest";
import { christmasCard, indiaDate } from "./christmas";
import { selectChristmasTrack } from "./christmasMusic";

describe("Christmas 2026 seasonal schedule", () => {
  it("starts at 33 days until Christmas on Nov 22 IST", () => {
    expect(christmasCard("2026-11-22")).toMatchObject({mode:"countdown", daysRemaining:33, emphasis:"Christmas"});
  });
  it("counts down to Christmas Eve accurately (not Dec 25)", () => {
    expect(christmasCard("2026-11-23")).toMatchObject({daysRemaining:31, emphasis:"Christmas Eve"});
  });
  it("uses only the approved three phrases", () => {
    for (let d=Date.UTC(2026,10,22); d<=Date.UTC(2026,11,24); d+=86400000) {
      expect(["Christmas","Christmas Eve","Birth of Christ"]).toContain(christmasCard(new Date(d).toISOString().slice(0,10))?.emphasis);
    }
  });
  it("has the correct Christmas Eve / Christmas / finale cards", () => {
    expect(christmasCard("2026-12-24")).toMatchObject({mode:"countdown", daysRemaining:1, emphasis:"Christmas"});
    expect(christmasCard("2026-12-25")?.mode).toBe("christmas_day");
    expect(christmasCard("2026-12-26")?.mode).toBe("finale");
    expect(christmasCard("2026-12-26")?.headline).toContain("next Christmas");
  });
  it("stops completely and hands back to normal quotes after Dec 26", () => {
    expect(christmasCard("2026-11-21")).toBeNull();
    expect(christmasCard("2026-12-27")).toBeNull();
    expect(christmasCard("2027-12-01")).toBeNull();
  });
  it("rejects impossible dates", () => {
    expect(()=>christmasCard("2026-02-30")).toThrow();
  });
  it("uses India time across UTC midnight", () => {
    expect(indiaDate(new Date("2026-11-21T19:00:00Z"))).toBe("2026-11-22");
  });
  it("never selects a copyrighted feature film recording", () => {
    const c=christmasCard("2026-11-22")!;
    const track=selectChristmasTrack(c);
    expect(track.source).toContain("incompetech.com");
    expect(track.license).toBe("CC BY 4.0");
    expect(track.title).not.toMatch(/polar express/i);
  });
});
