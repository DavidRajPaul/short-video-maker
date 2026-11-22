import { findPixabay } from "./Pixabay";
/* eslint-disable @remotion/deterministic-randomness */
import { findCommons } from "./Commons";
import { allowedText } from "./StockSafety";
import { logger } from "../../logger";
import { OrientationEnum, type Video } from "../../types/shorts";

const durationBufferSeconds = 0.5;
const defaultTimeoutMs = 5000;

export class PexelsAPI {
  private turn = 0;
  constructor(private API_KEY: string) {}

  private async _findVideo(
    searchTerm: string,
    minDurationSeconds: number,
    excludeIds: string[],
    orientation: OrientationEnum,
    timeout: number,
    page: number,
    requireHolidaySlug = false,
  ): Promise<Video> {
    if (!this.API_KEY) {
      throw new Error("API key not set");
    }
    logger.debug(
      { searchTerm, minDurationSeconds, orientation },
      "Searching for video in Pexels API",
    );
    const headers = new Headers();
    headers.append("Authorization", this.API_KEY);
    const response = await fetch(
      `https://api.pexels.com/videos/search?orientation=${orientation}&size=medium&per_page=80&page=${page}&query=${encodeURIComponent(searchTerm)}`,
      {
        method: "GET",
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(timeout),
      },
    )
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401) {
            throw new Error(
              "Invalid Pexels API key - please make sure you get a valid key from https://www.pexels.com/api and set it in the environment variable PEXELS_API_KEY",
            );
          }
          throw new Error(`Pexels API error: ${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .catch((error: unknown) => {
        logger.error(error, "Error fetching videos from Pexels API");
        throw error;
      });
    const videos = response.videos as {
      id: string;
      duration: number;
      url?: string;
      video_files: {
        fps: number;
        quality: string;
        width: number;
        height: number;
        id: string;
        link: string;
      }[];
    }[];

    if (!videos || videos.length === 0) {
      logger.error(
        { searchTerm, orientation },
        "No videos found in Pexels API",
      );
      throw new Error("No videos found");
    }

    // find all the videos that fits the criteria, then select one randomly
    const filteredVideos = videos
      .map((video) => {
        if (excludeIds.includes(String(video.id))) {
          return;
        }
        // Pexels keyword search frequently returns generic scenery. Its
        // public editorial URL slug gives us an additional relevance check.
        if (requireHolidaySlug && !/christmas|xmas|ornament|bauble|wreath|garland|santa|festive|holiday|nativity/i.test(String(video.url ?? ""))) {
          return;
        }
        if (!video.video_files.length) {
          return;
        }

        // calculate the real duration of the video by converting the FPS to 25
        const duration = video.duration;

        if (duration >= minDurationSeconds + durationBufferSeconds) {
          const portrait = orientation === OrientationEnum.portrait;
          const file = video.video_files
            .filter((candidate) =>
              candidate.quality === "hd" &&
              (portrait
                ? candidate.height > candidate.width && candidate.width >= 720 && candidate.height >= 1280
                : candidate.width > candidate.height && candidate.width >= 1280 && candidate.height >= 720),
            )
            .sort((a, b) => b.width * b.height - a.width * a.height)[0];
          if (file) {
            return {
              id: String(video.id),
              url: file.link,
              width: file.width,
              height: file.height,
            };
          }
        }
      })
      .filter(Boolean);
    if (!filteredVideos.length) {
      logger.error({ searchTerm }, "No videos found in Pexels API");
      throw new Error("No videos found");
    }

    const video = filteredVideos[
      Math.floor(Math.random() * filteredVideos.length)
    ] as Video;

    logger.debug(
      { searchTerm, video: video, minDurationSeconds, orientation },
      "Found video from Pexels API",
    );

    return video;
  }

  /**
   * Seasonal Christmas footage: ONLY Pexels/Pixabay, not Commons or generic
   * devotional fallback. Returns real moving stock video selected from
   * explicit holiday search terms. Caller screens actual extracted frames.
   */
  /**
   * Editorially inspected Christmas videos on Pexels. An API search still
   * runs for most days; known clips provide a fail-closed seasonal fallback
   * and a high-confidence first-day launch.
   *
   * Source pages: https://www.pexels.com/video/<slug>-<id>/
   * These are stock-video IDs, not CDN URLs invented by the renderer.
   */
  private readonly knownChristmasVideos = [
    19733271, // vertical sparkling Christmas tree
    35315032, // vertical Christmas ornaments
    35282418, // festive decorated Christmas tree
    35047385, // vivid Christmas ornaments
    35493265, // twinkling lit Christmas tree
    6135314,  // tree ornaments and lights
    6287707,  // Christmas lights + ornaments
    10334428, // closeup of flashing Christmas lights
  ];
  // Verified Pexels editorial pages: outdoor houses and streets with
  // snow AND Christmas decorations; API duration/orientation is checked live.
  private readonly knownSnowyOutdoorChristmasVideos = [
    6276334, // snow-covered home decorated for Christmas Eve (vertical)
    4076196, // snowy outdoor house covered in Christmas lights
    3955643, // outdoor Christmas lights on a house
    4076197, // snowy street and illuminated house
    4076115, // decorated snowy residential street
    6276324, // snowy home with Christmas decorations
  ];

  async findKnownChristmasVideo(
    minSeconds: number,
    excludeIds: string[],
    ordinal = 0,
    theme: "general" | "snowy-outdoor" = "general",
  ): Promise<Video> {
    if (!this.API_KEY) throw new Error("Pexels API key missing");
    const pool=theme==="snowy-outdoor"?this.knownSnowyOutdoorChristmasVideos:this.knownChristmasVideos;
    const rotation=((ordinal % pool.length)+pool.length)%pool.length;
    const candidates = [
      ...pool.slice(rotation),
      ...pool.slice(0,rotation),
    ];
    for (const id of candidates) {
      if (excludeIds.includes(String(id))) continue;
      try {
        const response = await fetch("https://api.pexels.com/videos/videos/" + id, {
          headers: { Authorization: this.API_KEY }, signal: AbortSignal.timeout(11000),
        });
        if (!response.ok) continue;
        const entry = await response.json() as {
          id:number; duration:number;
          video_files:{ quality:string; width:number; height:number; link:string }[];
        };
        if(entry.duration < minSeconds + 0.5 || !Array.isArray(entry.video_files))continue;
        const portrait=(f:typeof entry.video_files[number])=>f.width>=720&&f.height>=1280&&f.height>f.width&&f.height<=2560;
        const landscape=(f:typeof entry.video_files[number])=>f.width>=1280&&f.height>=720&&f.width>f.height;
        const files=entry.video_files.filter(f=>f.quality==="hd"&&f.link?.startsWith("https://")&&
          (portrait(f)||(theme==="snowy-outdoor"&&landscape(f)))
        ).sort((a,b)=>Number(portrait(b))-Number(portrait(a))||b.width*b.height-a.width*a.height);
        if(files.length){
          const file=files[0];
          return {id:String(id),url:file.link,width:file.width,height:file.height};
        }
      }catch{
        // Try the next externally verified Christmas stock item.
      }
    }
    throw new Error("Curated Christmas stock list is unavailable or exhausted");
  }

  async findChristmasVideo(
    searchTerms: string[],
    minSeconds: number,
    excludeIds: string[],
    prefer: "pexels" | "pixabay" = "pexels",
  ): Promise<Video> {
    const terms = [...new Set(searchTerms.map(t => t.trim()).filter(t =>
      t && allowedText(t) && /christmas/i.test(t),
    ))].slice(0, 3);
    if (!terms.length) throw new Error("Only explicitly Christmas-related search terms are allowed");
    const providers: ("pexels" | "pixabay")[] =
      prefer === "pixabay" ? ["pixabay", "pexels"] : ["pexels", "pixabay"];
    const page = 1 + (this.turn++ % 2);
    for (const term of terms) {
      for (const provider of providers) {
        if (provider === "pixabay" && !process.env.PIXABAY_API_KEY) continue;
        try {
          if (provider === "pixabay") {
            const clip = await findPixabay(term, minSeconds, excludeIds, OrientationEnum.portrait, 10000, true);
            if (clip) return clip;
          } else {
            return await this._findVideo(term, minSeconds, excludeIds, OrientationEnum.portrait, 10000, page, true);
          }
        } catch (error) {
          logger.warn({ provider, term, reason: error instanceof Error ? error.message.slice(0,100) : "" },
            "Christmas portrait video search failed");
        }
      }
    }
    // Christmas-lights landscapes also crop attractively into vertical shorts.
    // Last-resort fallback is a REAL stock video, never synthetic art.
    for (const term of terms.slice(0, 2)) {
      try {
        return await this._findVideo(term, minSeconds, excludeIds, OrientationEnum.landscape, 10000, 1, true);
      } catch {
        // Try next explicit festive search term.
      }
    }
    throw new Error("No Christmas video found on Pexels or Pixabay");
  }

  async findVideo(
    searchTerms: string[],
    minDurationSeconds: number,
    excludeIds: string[] = [],
    orientation: OrientationEnum = OrientationEnum.portrait,
    timeout: number = defaultTimeoutMs,
    strictChristianVisuals = false,

  ): Promise<Video> {
    const sources = ["pexels","commons"];
    if (process.env.PIXABAY_API_KEY) sources.push("pixabay");
    const turn = this.turn++;
    const start = turn % sources.length;
    // Search beyond the same first 80 results as screening excludes unsuitable
    // and previously used clips. Rotate pages without changing safety criteria.
    const page = 1 + (Math.floor(turn / 2) % 3);
    const originalTerms = [...new Set(searchTerms.filter(allowedText).map((term) => term.trim()).filter(Boolean))].slice(0,3);
    const devotionalFallbacks = [
      "Christian prayer hands cross",
      "open Bible reading church interior",
      "Christian worship stained glass church",
      "person praying with Bible sunrise",
      "church altar candles cross",
      "Christian devotional reading Bible",
      "rosary crucifix hands prayer",
      "church exterior dawn cross",
    ];
    const fallback = devotionalFallbacks[Math.floor(turn / sources.length) % devotionalFallbacks.length];
    const terms = strictChristianVisuals
      ? [...originalTerms, fallback]
      : originalTerms;
    for (const term of terms) {
      for (let i=0;i<sources.length;i++) {
        const provider=sources[(start+i)%sources.length];
        try {
          const args = [term,minDurationSeconds,excludeIds,orientation,timeout] as const;
          const clip = provider==="commons" ? await findCommons(term,minDurationSeconds,excludeIds,timeout)
            : provider==="pixabay" ? await findPixabay(...args) : await this._findVideo(...args,page);
          if (clip) { logger.info({provider,id:clip.id},"Selected stock candidate"); return clip; }
        } catch { logger.warn({provider},"Stock provider unavailable"); }
      }
    }
    throw new Error("No suitable stock footage");
  }
}
