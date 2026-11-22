import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { logger } from "../../logger";
import path from "node:path";

export const runMedia = promisify(execFile);
const restricted = /\b(porn\w*|naked|nude|nudity|striptease|lingerie|gore|beheading|dismember\w*|swastika|fuck\w*|shit|rape|sexual\s+assault|send\s+money|guaranteed\s+(?:cure|wealth))\b/i;

export function allowedText(value: string) {
  return !restricted.test(value.normalize("NFKC").replace(/[_/-]/g, " "));
}

const safeLabels = [
  "a peaceful landscape", "an ordinary object indoors",
  "a fully clothed person in an everyday setting", "architecture or a place of worship",
  "an open Bible or Christian prayer book being read",
  "a Christmas tree decorated with string lights and ornaments",
  "festive Christmas wreaths, presents and glowing ornaments",
  "Christmas market decorations and colorful holiday lights",
  "a Christian church interior, stained glass window, or cross",
];
const unsafeLabels = ["nudity or sexual imagery", "suggestive posing or revealing underwear", "blood, injury or graphic violence", "hate symbols or extremist propaganda", "drug abuse or weapons", "disturbing or frightening imagery", "a brand advertisement or prominent commercial logo"];
const devotionalLabels = [
  "an open Christian Bible with readable pages",
  "a Christian church with a cross, stained glass, or altar",
  "a person praying with a Bible or Christian cross",
  "a Catholic rosary or crucifix in prayer",
];
const unrelatedLabels = [
  "ordinary architecture or ancient stone ruins",
  "a landscape with mountains, snow, forest, or sea",
  "a city street or houses without religious imagery",
  "a person reading an ordinary book",
  "a person posing for a fashion photo",
  "a religious shrine without Christian symbols",
];
export function approvedDevotionalClassification(scores: {label:string;score:number}[]) {
  const faithful = scores.filter(x => devotionalLabels.includes(x.label)).reduce((total,x) => total+x.score,0);
  return { approved: devotionalLabels.includes(scores[0]?.label) && faithful >= 0.55, faithful };
}
// These zero-shot labels compete for one normalized score. Visually reviewed
// church footage scored 0.872 safe and a benign nature shot scored 0.763.
// Require a safe top label for every sampled frame and reject uncertain clips.
export function approvedClassification(scores: {label:string;score:number}[]) {
  const safe = scores.filter(x => safeLabels.includes(x.label)).reduce((total,x) => total+x.score,0);
  const critical = scores.filter(x => unsafeLabels.includes(x.label));
  return { approved: safe >= 0.50 && safeLabels.includes(scores[0]?.label)
    && critical.every(x => x.score < 0.10), safe };
}
// Distinguish actual Christmas objects from generic winter/sunset scenery.
// Search APIs can return unrelated videos even for "Christmas" keywords.
const christmasLabels = [
  "a decorated Christmas tree with sparkling fairy lights and colorful ornaments",
  "close-up of red and gold Christmas baubles hanging on a fir tree",
  "a cozy Christmas room full of garlands, wrapped gifts and lit decorations",
  "a Christmas market full of illuminated stalls and holiday wreaths",
  "a glowing Christmas nativity scene with figures and warm lights",
  "a festive Santa Claus decoration with Christmas presents",
];
const nonChristmasLabels = [
  "a village with plain rooftops under a cloudy sky",
  "a natural sunset over mountains and fields with no holiday decorations",
  "a city street or buildings with ordinary lighting",
  "winter snow covering an ordinary forest with no decorations",
  "a seascape or a landscape with empty distant mountains",
  "an ordinary house without festive decorations",
  "a person walking outdoors in casual clothes",
  "a generic cinematic background with abstract lights",
];
export function approvedChristmasClassification(scores: {label:string;score:number}[]) {
  const festive=scores.filter(x=>christmasLabels.includes(x.label)).reduce((sum,x)=>sum+x.score,0);
  const first=scores[0]?.label;
  return {approved: christmasLabels.includes(first) && festive >= 0.47, festive, topLabel:first};
}

/**
 * Samples an actual frame from each accepted stock clip and checks that the
 * moving background visibly depicts Christmas, not merely winter scenery.
 * Safety classification still runs separately; this checks relevance.
 */
export async function screenChristmasFootage(file: string): Promise<boolean> {
  const dir=await mkdtemp(path.join(tmpdir(),"grace-christmas-review-"));
  try {
    const frame=path.join(dir,"christmas-relevance.jpg");
    await runMedia("ffmpeg",["-y","-loglevel","error","-ss","3","-i",file,
      "-frames:v","1","-vf","scale=256:256:force_original_aspect_ratio=decrease",frame],{timeout:30000});
    classifier ??= loadClassifier().catch(error=>{classifier=undefined;throw error;});
    const classify=await classifier;
    const scores=await classify(frame,[...christmasLabels,...nonChristmasLabels]) as {label:string;score:number}[];
    const result=approvedChristmasClassification(scores);
    if(!result.approved){
      logger.warn({christmasRelevance:Number(result.festive.toFixed(3)),topLabel:result.topLabel},
        "Stock video is not visibly Christmas-related");
    }
    return result.approved;
  }catch(error){
    logger.warn({reason:error instanceof Error?error.message.slice(0,180):"unknown"},
      "Christmas relevance verification unavailable");
    return false;
  }finally{
    await rm(dir,{recursive:true,force:true});
  }
}

const loadClassifier = async () => {
  const runtime = createRequire(require.resolve("kokoro-js"));
  const { pipeline } = runtime("@huggingface/transformers");
  return pipeline("zero-shot-image-classification", "Xenova/clip-vit-base-patch32", { dtype: "q8", device: "cpu" });
};
let classifier: ReturnType<typeof loadClassifier> | undefined;

// Inspect the portion used in the output, including its initial frame. Unavailable
// classification, missing frames, or uncertain scores never approve external media.
export async function screenFootage(file: string, seconds: number, strictChristianVisuals = false): Promise<boolean> {
  const dir = await mkdtemp(path.join(tmpdir(), "grace-review-"));
  try {
    await runMedia("ffmpeg", ["-v","error","-i",file,"-t",String(seconds),"-vf","fps=2:start_time=0,scale=256:256:force_original_aspect_ratio=decrease","-q:v","4",path.join(dir,"%05d.jpg")], {timeout:60000});
    const frames = (await readdir(dir)).sort();
    if (frames.length < Math.max(1, Math.floor(seconds * 2))) {
      logger.warn({frames,seconds},"Footage missing sampled frames");
      return false;
    }
    const analysis = await runMedia("ffmpeg", ["-hide_banner","-i",file,"-t",String(seconds),"-vf","scale=160:-2,freezedetect=n=-45dB:d=0.9","-an","-f","null","-"], {timeout:30000});
    if (analysis.stderr.includes("freeze_start")) {
      logger.warn("Footage is static");
      return false;
    }
    classifier ??= loadClassifier().catch(error => { classifier = undefined; throw error; });
    const classify = await classifier;
    for (const [index,frame] of frames.entries()) {
      const scores = await classify(path.join(dir,frame), [...safeLabels,...unsafeLabels]) as {label:string;score:number}[];
      const {approved,safe} = approvedClassification(scores);
      if (!approved) {
        logger.warn({safeScore:Number(safe.toFixed(3)),topLabel:scores[0]?.label},"Footage content score below approval threshold");
        return false;
      }
      if (strictChristianVisuals && (index === 0 || index === Math.floor(frames.length/2) || index === frames.length-1)) {
        const relevance = await classify(path.join(dir,frame), [...devotionalLabels,...unrelatedLabels]) as {label:string;score:number}[];
        const {approved: relevant,faithful} = approvedDevotionalClassification(relevance);
        if (!relevant) {
          logger.warn({faithfulScore:Number(faithful.toFixed(3)),topLabel:relevance[0]?.label},"Footage does not depict Christian subject");
          return false;
        }
      }
    }
    return true;
  } catch (error) {
    logger.warn({reason: error instanceof Error ? error.message.slice(0,280) : "screening error"},"Footage screening unavailable");
    return false;
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
}
