import { describe,it,expect } from "vitest";
import { approvedChristmasClassification } from "./libraries/StockSafety";

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
