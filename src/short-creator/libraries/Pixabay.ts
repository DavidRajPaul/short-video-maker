import { createHash, randomInt } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { OrientationEnum, type Video } from "../../types/shorts";
import { allowedText } from "./StockSafety";

type Hit = {
  id: number;
  duration: number;
  tags: string;
  videos: Record<string, { width: number; height: number; url: string }>;
};
type Cache = { expires: number; hits: Hit[] };
const day = 24 * 60 * 60 * 1000;
const pending = new Map<string, Promise<Hit[]>>();

async function search(term: string, timeout: number): Promise<Hit[]> {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return [];
  const params = new URLSearchParams({
    q: term.slice(0, 100), safesearch: "true", video_type: "film", per_page: "100",
  });
  // Keep API credentials out of cache filenames, logs and source control.
  const digest = createHash("sha256").update(params.toString()).digest("hex");
  const directory = path.join(process.env.DATA_DIR_PATH ?? tmpdir(), "pixabay-cache");
  const file = path.join(directory, digest + ".json");
  try {
    const cached: Cache = JSON.parse(await readFile(file, "utf8"));
    if (cached.expires > Date.now() && Array.isArray(cached.hits)) return cached.hits;
  } catch {
    // Missing or damaged cache entries are replaced after a successful response.
  }
  const existing = pending.get(file);
  if (existing) return existing;
  const request = (async () => {
    params.set("key", key);
    const response = await fetch(`https://pixabay.com/api/videos/?${params}`, {
      signal: AbortSignal.timeout(timeout),
    });
    if (!response.ok) throw new Error(`Pixabay returned HTTP ${response.status}`);
    const data = await response.json() as { hits?: Hit[] };
    if (!Array.isArray(data.hits)) throw new Error("Invalid Pixabay response");
    await mkdir(directory, { recursive: true });
    const temporary = file + "." + process.pid + ".tmp";
    await writeFile(temporary, JSON.stringify({ expires: Date.now() + day, hits: data.hits }));
    await rename(temporary, file);
    return data.hits;
  })();
  pending.set(file, request);
  try {
    return await request;
  } finally {
    pending.delete(file);
  }
}

export async function findPixabay(
  term: string,
  seconds: number,
  excluded: string[],
  orientation: OrientationEnum,
  timeout: number,
): Promise<Video | undefined> {
  const hits = await search(term, timeout);
  const candidates: Video[] = [];
  for (const hit of hits) {
    const id = `pixabay-${hit.id}`;
    if (hit.duration < seconds + 0.5 || excluded.includes(id) || !allowedText(hit.tags ?? "")) continue;
    const files = Object.values(hit.videos).filter(file =>
      file.url?.startsWith("https://") && Math.min(file.width, file.height) >= 720,
    );
    const matchesOrientation = (file: typeof files[number]) =>
      orientation === OrientationEnum.portrait ? file.height > file.width : file.width > file.height;
    files.sort((a, b) => Number(matchesOrientation(b)) - Number(matchesOrientation(a))
      || b.height - a.height);
    const file = files[0];
    if (file) candidates.push({ id, ...file });
  }
  return candidates.length ? candidates[randomInt(candidates.length)] : undefined;
}
