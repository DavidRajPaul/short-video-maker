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

const safeLabels = ["a peaceful landscape", "an ordinary object indoors", "a fully clothed person in an everyday setting", "architecture or a place of worship"];
const unsafeLabels = ["nudity or sexual imagery", "suggestive posing or revealing underwear", "blood, injury or graphic violence", "hate symbols or extremist propaganda", "drug abuse or weapons", "disturbing or frightening imagery", "a brand advertisement or prominent commercial logo"];
// The labels compete for one normalized score. Reviewed church footage scored
// 0.872 safe, so 0.90 incorrectly rejected it. Keep a safe top label and no
// more than 20% combined probability assigned to all unsafe labels.
export function approvedClassification(scores: {label:string;score:number}[]) {
  const safe = scores.filter(x => safeLabels.includes(x.label)).reduce((total,x) => total+x.score,0);
  return { approved: safe >= 0.80 && safeLabels.includes(scores[0]?.label), safe };
}
const loadClassifier = async () => {
  const runtime = createRequire(require.resolve("kokoro-js"));
  const { pipeline } = runtime("@huggingface/transformers");
  return pipeline("zero-shot-image-classification", "Xenova/clip-vit-base-patch32", { dtype: "q8", device: "cpu" });
};
let classifier: ReturnType<typeof loadClassifier> | undefined;

// Inspect the portion used in the output, including its initial frame. Unavailable
// classification, missing frames, or uncertain scores never approve external media.
export async function screenFootage(file: string, seconds: number): Promise<boolean> {
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
    for (const frame of frames) {
      const scores = await classify(path.join(dir,frame), [...safeLabels,...unsafeLabels]) as {label:string;score:number}[];
      const {approved,safe} = approvedClassification(scores);
      if (!approved) {
        logger.warn({safeScore:Number(safe.toFixed(3)),topLabel:scores[0]?.label},"Footage content score below approval threshold");
        return false;
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
