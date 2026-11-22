import fs from "fs-extra";
import path from "path";
import { createHash } from "node:crypto";
import { runMedia, screenFootage } from "./libraries/StockSafety";
import { OrientationEnum } from "../types/shorts";
import { logger } from "../logger";
import type { Config } from "../config";
import type { PexelsAPI } from "./libraries/Pexels";
import type { ChristmasCard } from "./christmas";

export type ChristmasClip = {
  url: string;
  durationFrames: number;
  stockId: string;
};

/**
 * Search real, Christmas-specific moving footage from Pexels/Pixabay.
 * The user specifically requested NO CGI-generated festive backgrounds.
 * Only use screened, playable stock clips; fail closed instead of silently
 * substituting static cards or non-Christmas media.
 */
const SEARCH_GROUPS = [
  ["Christmas tree twinkling lights", "Christmas tree lights bokeh", "Christmas decorations lights"],
  ["Christmas market illuminated", "Christmas festive street lights", "Christmas shopping street decorations"],
  ["Christmas baubles ornaments", "decorating Christmas tree", "Christmas ornaments close up"],
  ["Christmas fireplace gifts", "Christmas presents cozy home", "Christmas family warm lights"],
  ["Christmas nativity candles", "Christmas church candles", "Christmas nativity scene"],
  ["festive Christmas outdoor lights", "Christmas snowy decorated house", "Christmas lights glowing"],
] as const;

const CLIP_SECONDS = 6.5;
const CLIP_FRAMES = 163; // 25fps * 6.52 sec. Two clips => 326 frames.

function dayIndex(date: string): number {
  return Math.round((Date.parse(date + "T00:00:00Z") - Date.parse("2026-11-22T00:00:00Z")) / 86400000);
}

function loadClipIds(history: string[][]): Set<string> {
  return new Set(history.slice(-90).flat());
}

/** Atomic history update only after a successful complete render. */
export function rememberChristmasClips(historyFile: string, selected: string[]): void {
  const history: string[][] = fs.existsSync(historyFile) ? fs.readJsonSync(historyFile) : [];
  const next = [...history, selected].slice(-180);
  const temp = historyFile + ".tmp";
  fs.writeJsonSync(temp, next);
  fs.renameSync(temp, historyFile);
}

export async function getChristmasFootage(
  card: ChristmasCard,
  renderId: string,
  config: Config,
  pexels: PexelsAPI,
): Promise<{ clips: ChristmasClip[]; cleanup: () => Promise<void>; historyFile: string; selectedIds: string[] }> {
  const historyFile = path.join(config.videosDirPath, "..", "christmas-stock-history.json");
  const history: string[][] = fs.existsSync(historyFile) ? fs.readJsonSync(historyFile) : [];
  const excluded = loadClipIds(history);
  const selectedIds: string[] = [];
  const files: string[] = [];
  const clips: ChristmasClip[] = [];
  const offset = dayIndex(card.date);

  try {
    for (let scene = 0; scene < 2; scene++) {
      let accepted = false;
      const groups = SEARCH_GROUPS.map((group, idx) => ({
        idx,
        terms: [...group],
      }));
      const start = (offset * 2 + scene * 3) % groups.length;
      // Try different festive themes daily; explicit keywords in every search.
      for (let attempt = 0; attempt < groups.length && !accepted; attempt++) {
        const group = groups[(start + attempt) % groups.length];
        const fileBase = createHash("sha256").update(card.date + ":" + renderId + ":" + scene).digest("hex").slice(0, 20);
        const raw = path.join(config.tempDirPath, "christmas-" + fileBase + ".stock.mp4");
        const processed = path.join(config.tempDirPath, "christmas-" + fileBase + ".mp4");
        if (!files.includes(raw)) files.push(raw);
        if (!files.includes(processed)) files.push(processed);
        try {
          const clip = await pexels.findChristmasVideo(
            group.terms,
            CLIP_SECONDS,
            [...excluded],
            (offset + scene + attempt) % 2 === 0 ? "pexels" : "pixabay",
          );
          excluded.add(clip.id); // Prevent duplicates within this render even on screening rejection.
          logger.info({ scene, stockId: clip.id, group: group.idx }, "Christmas stock candidate");
          // Explicit HTTPS only; stock clips are downloaded with bounded size and time.
          if (!/^https:\/\//.test(clip.url)) throw new Error("Stock file URL is not HTTPS");
          await runMedia("curl", [
            "--fail", "--location", "--proto", "=https", "--max-time", "40",
            "--max-filesize", "80000000", "--output", raw, clip.url,
          ], { timeout: 50000 });
          await runMedia("ffmpeg", [
            "-y", "-v", "error", "-i", raw,
            "-t", "6.8",
            "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=25",
            "-an", "-threads", "2", "-preset", "ultrafast", "-pix_fmt", "yuv420p", processed,
          ], { timeout: 90000 });
          const stat = await fs.stat(processed);
          if (stat.size < 120000) throw new Error("Processed Christmas clip is too small");
          if (!(await screenFootage(processed, CLIP_SECONDS, false))) {
            logger.warn({ stockId: clip.id }, "Christmas stock clip rejected by content safety screening");
            continue;
          }
          clips.push({
            url: "http://localhost:" + config.port + "/api/tmp/" + path.basename(processed),
            durationFrames: CLIP_FRAMES,
            stockId: clip.id,
          });
          selectedIds.push(clip.id);
          accepted = true;
          break;
        } catch (error) {
          logger.warn({
            scene, group: group.idx,
            cause: error instanceof Error ? error.message.slice(0, 180).replace(/https?:\/\/\S+/g, "[url]") : "unknown",
          }, "Christmas stock search candidate failed");
        }
      }
      if (!accepted) throw new Error("No verified moving Christmas footage from Pexels/Pixabay; declining silent/static fallback");
    }
    return {
      clips,
      historyFile,
      selectedIds,
      cleanup: async () => {
        await Promise.all(files.map(file => fs.remove(file)));
      },
    };
  } catch (e) {
    await Promise.all(files.map(file => fs.remove(file)));
    throw e;
  }
}
