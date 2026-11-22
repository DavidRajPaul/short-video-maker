import { describe,it,expect } from "vitest";
import { approvedChristmasClassification, approvedSnowyOutdoorChristmasClassification } from "./libraries/StockSafety";
import { christmasSceneTheme } from "./christmasFootage";

describe("Christmas stock relevance (not merely generic snow scenery)",()=>{
  it("accepts clearly decorated Christmas imagery",()=>{
    const scores=[
      {label:"a Christmas tree decorated with sparkling fairy lights and colorful ornaments",score:0.69},
      {label:"a village with plain rooftops under a cloudy sky",score:0.12},
      {label:"a festive Santa Claus decoration with Christmas presents",score:0.11},
      {label:"a natural sunset over mountains and fields with no holiday decorations",score:0.08},
    ];
    expect(approvedChristmasClassification(scores).approved).toBe(true);
  });
  it("rejects normal winter sunsets and villages",()=>{
    const scores=[
      {label:"a village with plain rooftops under a cloudy sky",score:0.51},
      {label:"a natural sunset over mountains and fields with no holiday decorations",score:0.39},
      {label:"a Christmas market full of illuminated stalls and holiday wreaths",score:0.10},
    ];
    expect(approvedChristmasClassification(scores).approved).toBe(false);
  });
  it("rejects ambiguous images even with a Christmas phrase in the candidate search",()=>{
    const scores=[
      {label:"a Christmas market full of illuminated stalls and holiday wreaths",score:0.31},
      {label:"a city street or buildings with ordinary lighting",score:0.29},
      {label:"a village with plain rooftops under a cloudy sky",score:0.25},
      {label:"a festive Santa Claus decoration with Christmas presents",score:0.15},
    ];
    expect(approvedChristmasClassification(scores).approved).toBe(false);
  });
});

describe("Outdoor snowy decorations",()=>{
  it("prioritizes a snowy outdoor Christmas clip every few days",()=>{
    expect(christmasSceneTheme("2026-11-22",0)).toBe("general");
    expect(christmasSceneTheme("2026-11-22",1)).toBe("general");
    expect(christmasSceneTheme("2026-11-23",0)).toBe("general");
    expect(christmasSceneTheme("2026-11-23",1)).toBe("snowy-outdoor");
    expect(christmasSceneTheme("2026-11-26",1)).toBe("snowy-outdoor");
  });
  it("accepts snow on an outdoor house only with visible Christmas decorations",()=>{
    const scores=[
      {label:"a snowy house exterior decorated with colorful Christmas string lights and wreaths",score:0.62},
      {label:"an ordinary snow-covered street with no Christmas lights or decorations",score:0.19},
      {label:"a garden covered with snow and decorated with Christmas lights",score:0.19},
    ];
    expect(approvedSnowyOutdoorChristmasClassification(scores).approved).toBe(true);
  });
  it("rejects generic winter nature shots and indoor festive trees for the outdoor snowy slot",()=>{
    const generic=[
      {label:"a snowy mountain, field or forest without any holiday decorations",score:0.57},
      {label:"an outdoor Christmas market in falling snow filled with warm festive lights",score:0.19},
      {label:"an ordinary decorated Christmas tree in a warm indoor living room",score:0.24},
    ];
    expect(approvedSnowyOutdoorChristmasClassification(generic).approved).toBe(false);
  });
});
