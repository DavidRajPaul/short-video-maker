import { describe, expect, it } from "vitest";
import { approvedClassification } from "./StockSafety";

describe("stock content approval", () => {
  it("accepts reviewed church footage with a safe top label", () => {
    expect(approvedClassification([
      { label: "architecture or a place of worship", score: 0.872 },
      { label: "disturbing or frightening imagery", score: 0.128 },
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
  });
});
