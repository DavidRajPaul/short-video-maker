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
