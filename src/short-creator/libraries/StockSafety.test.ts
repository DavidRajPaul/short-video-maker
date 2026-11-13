import { describe, expect, it } from "vitest";
import { approvedClassification, approvedDevotionalClassification } from "./StockSafety";

describe("stock content approval", () => {
  it("accepts reviewed church footage with a safe top label", () => {
    expect(approvedClassification([
      { label: "architecture or a place of worship", score: 0.872 },
      { label: "disturbing or frightening imagery", score: 0.05 },
    ]).approved).toBe(true);
  });

  it("rejects unsafe top labels and uncertain frames", () => {
    expect(approvedClassification([
      { label: "suggestive posing or revealing underwear", score: 0.45 },
      { label: "architecture or a place of worship", score: 0.40 },
    ]).approved).toBe(false);
    expect(approvedClassification([
      { label: "architecture or a place of worship", score: 0.79 },
      { label: "nudity or sexual imagery", score: 0.21 },
    ]).approved).toBe(false);
    expect(approvedClassification([
      { label: "an ordinary object indoors", score: 0.49 },
      { label: "disturbing or frightening imagery", score: 0.01 },
    ]).approved).toBe(false);
    expect(approvedClassification([
      { label: "an ordinary object indoors", score: 0.595 },
      { label: "disturbing or frightening imagery", score: 0.05 },
    ]).approved).toBe(true);
    expect(approvedClassification([
      { label: "an ordinary object indoors", score: 0.763 },
      { label: "disturbing or frightening imagery", score: 0.237 },
    ]).approved).toBe(false);
  });
});

describe("devotional visual relevance", () => {
  it("accepts identifiable Christian imagery", () => {
    expect(approvedDevotionalClassification([
      { label: "a Christian church with a cross, stained glass, or altar", score: 0.72 },
      { label: "ordinary architecture or ancient stone ruins", score: 0.28 },
    ]).approved).toBe(true);
  });
  it("rejects ordinary landscapes and ambiguous religious imagery", () => {
    expect(approvedDevotionalClassification([
      { label: "a landscape with mountains, snow, forest, or sea", score: 0.58 },
      { label: "a Christian church with a cross, stained glass, or altar", score: 0.42 },
    ]).approved).toBe(false);
    expect(approvedDevotionalClassification([
      { label: "a person praying with a Bible or Christian cross", score: 0.52 },
      { label: "a person reading an ordinary book", score: 0.48 },
    ]).approved).toBe(false);
  });
});
