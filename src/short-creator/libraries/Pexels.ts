/* eslint-disable @remotion/deterministic-randomness */
import { getOrientationConfig } from "../../components/utils";
import { logger } from "../../logger";
import { OrientationEnum, type Video } from "../../types/shorts";

const jokerTerms: string[] = ["nature", "globe", "space", "ocean"];
const durationBufferSeconds = 3;
const defaultTimeoutMs = 5000;
const retryTimes = 3;

export class PexelsAPI {
  constructor(private API_KEY: string) {}

  private async _findVideo(
    searchTerm: string,
    minDurationSeconds: number,
    excludeIds: string[],
    orientation: OrientationEnum,
    timeout: number,
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
      `https://api.pexels.com/videos/search?orientation=${orientation}&size=medium&per_page=80&query=${encodeURIComponent(searchTerm)}`,
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

    const { width: requiredVideoWidth, height: requiredVideoHeight } =
      getOrientationConfig(orientation);

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
        const fps = video.video_files[0].fps;
        const duration =
          fps < 25 ? video.duration * (fps / 25) : video.duration;

        if (duration >= minDurationSeconds + durationBufferSeconds) {
          for (const file of video.video_files) {
            if (
              file.quality === "hd" &&
              file.width === requiredVideoWidth &&
              file.height === requiredVideoHeight
            ) {
              return {
                id: String(video.id),
                url: file.link,
                width: file.width,
                height: file.height,
              };
            }
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

  private async findPixabay(term: string, seconds: number, excluded: string[], orientation: OrientationEnum, timeout: number): Promise<Video | undefined> {
    const query = new URLSearchParams({ key: process.env.PIXABAY_API_KEY!, q: term.slice(0, 100), safesearch: "true", per_page: "50" });
    const res = await fetch(`https://pixabay.com/api/videos/?${query}`, { signal: AbortSignal.timeout(timeout) });
    if (!res.ok) return;
    type Hit = { id: number; duration: number; videos: Record<string, {width: number; height: number; url: string}> };
    const { hits } = await res.json() as { hits: Hit[] };
    const candidates: Video[] = [];
    for (const hit of hits) {
      const id = `pixabay-${hit.id}`;
      if (hit.duration < seconds + durationBufferSeconds || excluded.includes(id)) continue;
      const file = Object.values(hit.videos).filter(f => f.url && (orientation === OrientationEnum.portrait ? f.height > f.width : f.width > f.height) && Math.min(f.width, f.height) >= 720)
        .sort((a,b) => a.width - b.width)[0];
      if (file) candidates.push({ id, ...file });
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  async findVideo(
    searchTerms: string[],
    minDurationSeconds: number,
    excludeIds: string[] = [],
    orientation: OrientationEnum = OrientationEnum.portrait,
    timeout: number = defaultTimeoutMs,
    retryCounter: number = 0,
  ): Promise<Video> {
    // shuffle the search terms to randomize the search order
    const shuffledJokerTerms = jokerTerms.sort(() => Math.random() - 0.5);
    const shuffledSearchTerms = searchTerms.sort(() => Math.random() - 0.5);

    for (const searchTerm of [...shuffledSearchTerms, ...shuffledJokerTerms]) {
      if (process.env.PIXABAY_API_KEY && Math.random() < 0.5) {
        try {
          const clip = await this.findPixabay(searchTerm, minDurationSeconds, excludeIds, orientation, timeout);
          if (clip) return clip;
        } catch {
          logger.warn({ searchTerm }, "Pixabay unavailable, using Pexels");
        }
      }
      try {
        return await this._findVideo(
          searchTerm,
          minDurationSeconds,
          excludeIds,
          orientation,
          timeout,
        );
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          error instanceof DOMException &&
          error.name === "TimeoutError"
        ) {
          if (retryCounter < retryTimes) {
            logger.warn(
              { searchTerm, retryCounter },
              "Timeout error, retrying...",
            );
            return await this.findVideo(
              searchTerms,
              minDurationSeconds,
              excludeIds,
              orientation,
              timeout,
              retryCounter + 1,
            );
          }
          logger.error(
            { searchTerm, retryCounter },
            "Timeout error, retry limit reached",
          );
          throw error;
        }

        logger.error(error, "Error finding video in Pexels API for term");
      }
    }
    logger.error(
      { searchTerms },
      "No videos found in Pexels API for the given terms",
    );
    throw new Error("No videos found in Pexels API");
  }
}
