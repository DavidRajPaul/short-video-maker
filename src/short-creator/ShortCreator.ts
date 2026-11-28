import { allowedText, runMedia, screenFootage } from "./libraries/StockSafety";
import { christmasCard } from "./christmas";
import { ensureChristmasMusic } from "./christmasMusic";
import { getChristmasFootage, rememberChristmasClips } from "./christmasFootage";
import { randomInt } from "node:crypto";
import { OrientationEnum } from "./../types/shorts";
/* eslint-disable @remotion/deterministic-randomness */
import fs from "fs-extra";
import cuid from "cuid";
import path from "path";

import { Kokoro } from "./libraries/Kokoro";
import { planNarration } from "./libraries/NarrationPlanner";
import { composeNarrationAudio } from "./libraries/NarrationAudio";
import { Remotion } from "./libraries/Remotion";
import { Whisper } from "./libraries/Whisper";
import { FFMpeg } from "./libraries/FFmpeg";
import { PexelsAPI } from "./libraries/Pexels";
import { Config } from "../config";
import { logger } from "../logger";
import { MusicManager } from "./music";
import type {
  SceneInput,
  RenderConfig,
  Scene,
  VideoStatus,
  MusicMoodEnum,
  MusicTag,
  MusicForVideo,
} from "../types/shorts";

export class ShortCreator {
  private queue: (
    | { kind: "short"; sceneInput: SceneInput[]; config: RenderConfig; id: string }
    | { kind: "christmas"; date: string; id: string }
  )[] = [];
  private failures = new Map<string, string>();
  constructor(
    private config: Config,
    private remotion: Remotion,
    private kokoro: Kokoro,
    private whisper: Whisper,
    private ffmpeg: FFMpeg,
    private pexelsApi: PexelsAPI,
    private musicManager: MusicManager,
  ) {}

  public failureMessage(id: string): string | undefined {
    return this.failures.get(id);
  }

  public status(id: string): VideoStatus {
    const videoPath = this.getVideoPath(id);
    if (this.queue.find((item) => item.id === id)) {
      return "processing";
    }
    if (fs.existsSync(videoPath)) {
      return "ready";
    }
    return "failed";
  }

  public addToQueue(sceneInput: SceneInput[], config: RenderConfig): string {
    // todo add mutex lock
    const id = cuid();
    this.failures.delete(id);
    this.queue.push({
      kind: "short",
      sceneInput,
      config,
      id,
    });
    if (this.queue.length === 1) {
      this.processQueue();
    }
    return id;
  }

  /** Silent music-led seasonal shorts run in the existing serial render queue. */
  public addChristmasToQueue(date: string): string {
    if (!christmasCard(date)) throw new Error("Christmas countdown is not active on " + date);
    const id = cuid();
    this.failures.delete(id);
    this.queue.push({ kind: "christmas", date, id });
    if (this.queue.length === 1) void this.processQueue();
    return id;
  }

  private async createChristmas(id: string, date: string): Promise<void> {
    const card = christmasCard(date);
    if (!card) throw new Error("Christmas countdown is not active");
    const { music, track } = await ensureChristmasMusic(this.config, card);
    const { clips, selectedIds, historyFile, cleanup } =
      await getChristmasFootage(card, id, this.config, this.pexelsApi);
    try {
      await this.remotion.renderChristmas({
        card, musicUrl: music.url, backgroundClips: clips,
      }, id);
      rememberChristmasClips(historyFile, selectedIds);
      logger.info({ id, date, music: track.title, clips: selectedIds },
        "Christmas short rendered with real approved stock footage");
    } finally {
      await cleanup();
    }
  }

  private async processQueue(): Promise<void> {
    // todo add a semaphore
    if (this.queue.length === 0) {
      return;
    }
    const item = this.queue[0];
    const { id } = item;
    logger.debug({ id, kind: item.kind }, "Processing video item in the queue");
    try {
      if (item.kind === "christmas") {
        await this.createChristmas(id, item.date);
      } else {
        await this.createShort(id, item.sceneInput, item.config);
      }
      this.failures.delete(id);
      logger.debug({ id }, "Video created successfully");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.failures.set(id, message);
      logger.error({ videoId: id, error: message }, "Error creating video");
    } finally {
      this.queue.shift();
      this.processQueue();
    }
  }

  private async createShort(
    videoId: string,
    inputScenes: SceneInput[],
    config: RenderConfig,
  ): Promise<string> {
    logger.debug(
      {
        inputScenes,
        config,
      },
      "Creating short video",
    );
    if (!inputScenes.length || inputScenes.some(s=>!allowedText([s.text,...s.searchTerms].join(" ")))) throw new Error("Content screening rejected script or search terms");
    const scenes: Scene[] = [];
    let totalDuration = 0;
    const historyPath = path.join(this.config.videosDirPath, "..", "clip-history.json");
    const history: string[][] = fs.existsSync(historyPath) ? fs.readJsonSync(historyPath) : [];
    const excludeVideoIds = history.slice(-(config.clipHistorySize ?? 60)).flat();
    const usedIds: string[] = [];
    const tempFiles: string[] = [];
    const motifs = [/seed|grow|begin/i,/rain|morning|window/i,/olive|root|endure/i,/night|rest|sea|sleep/i,/home|lonely|door/i,/path|walk|guide/i];
    const hook = inputScenes[0].text;
    const recent = history.slice(-2).flat();
    const eligible = motifs.map((pattern,index)=>({index,match:pattern.test(hook)})).filter(x=>!recent.includes("cover-"+x.index));
    const matches = eligible.filter(x=>x.match);
    const choices = matches.length ? matches : eligible;
    const artStart = choices[randomInt(choices.length)].index;
    usedIds.push("cover-"+artStart);
    try {

    const orientation: OrientationEnum =
      config.orientation || OrientationEnum.portrait;

    let coverBackground: string | undefined;
    let previousFootage: { path: string; id: string } | undefined;
    let index = 0;
    for (const scene of inputScenes) {
      const plan = planNarration(scene, config);
      const tempId = cuid();
      const tempWavFileName = `${tempId}.wav`;
      const tempMp3FileName = `${tempId}.mp3`;
      const tempVideoFileName = `${tempId}.mp4`;
      const tempWavPath = path.join(this.config.tempDirPath, tempWavFileName);
      const tempMp3Path = path.join(this.config.tempDirPath, tempMp3FileName);
      const tempVideoPath = path.join(this.config.tempDirPath, tempVideoFileName);
      tempFiles.push(tempVideoPath, tempWavPath, tempMp3Path);

      const speechSegments = [];
      for (const [segmentIndex, segment] of plan.segments.entries()) {
        // Directions remain metadata and are NEVER passed to the TTS engine.
        const speech = await this.kokoro.generate(
          segment.text, config.voice ?? "af_heart", plan.speed,
        );
        const segmentPath = path.join(this.config.tempDirPath, `${tempId}-segment-${segmentIndex}.wav`);
        tempFiles.push(segmentPath);
        await this.ffmpeg.saveNormalizedAudio(speech.audio, segmentPath);
        // Bible Brain Teaser shows a persistent question/options card instead of
        // word-by-word subtitle pages. Skip Whisper entirely for quiz requests:
        // Whisper timestamps can exceed short Kokoro audio segments and abort
        // otherwise valid videos. Devotional subtitles retain their behavior.
        const segmentCaptions = config.quizCard
          ? []
          : await this.whisper.CreateCaption(segmentPath);
        const wav = fs.readFileSync(segmentPath);
        speechSegments.push({
          wav: Uint8Array.from(wav).buffer,
          captions: segmentCaptions,
          pauseAfterMs: segment.pauseAfterMs,
        });
      }
      const composed = composeNarrationAudio(speechSegments);
      const audioStream = composed.audio;
      const captions = composed.captions;
      let audioLength = composed.audioLength;

      // Add the trailing visual padding in seconds only for the last scene.
      if (index + 1 === inputScenes.length && config.paddingBack) {
        audioLength += config.paddingBack / 1000;
      }

      await this.ffmpeg.saveNormalizedAudio(audioStream, tempWavPath);
      await this.ffmpeg.saveToMp3(audioStream, tempMp3Path);
      // Quiz backgrounds and fixed option cards are drawn directly by Remotion.
      // Avoid fetching stock clips that will never be displayed in this mode.
      if (config.quizCard) {
        scenes.push({
          captions: [],
          video: "",
          audio: {
            url: `http://localhost:${this.config.port}/api/tmp/${tempMp3FileName}`,
            duration: audioLength,
          },
        });
        totalDuration += audioLength;
        index++;
        continue;
      }
      let selectedId: string | undefined;
      const strictChristianVisuals = config.strictChristianVisuals ?? true;
      const maxAttempts = strictChristianVisuals ? 30 : 12;
      const vertical = orientation === OrientationEnum.portrait;
      const size = vertical ? "1080:1920" : "1920:1080";
      const crop = `scale=${size}:force_original_aspect_ratio=increase,crop=${size},setsar=1`;
      const raw = tempVideoPath + ".stock";
      tempFiles.push(raw);

      const selectStock = async (
        pexelsApi: PexelsAPI,
        searchTerms: string[],
        visualRequirement: boolean | "nature",
        attempts: number,
      ): Promise<string | undefined> => {
        for (let attempt = 0; attempt < attempts; attempt++) {
          try {
            const clip = await pexelsApi.findVideo(
              visualRequirement === "nature" ? [searchTerms[attempt % searchTerms.length]] : searchTerms,
              audioLength, excludeVideoIds, orientation,
              visualRequirement === "nature" ? 5000 : undefined, visualRequirement === true,
            );
            excludeVideoIds.push(clip.id);
            await runMedia("curl", [
              "--fail", "--location", "--proto", "=https", "--max-time", "60",
              "--max-filesize", "100000000", "--output", raw, clip.url,
            ]);
            await runMedia("ffmpeg", [
              "-y", "-loglevel", "error", "-i", raw, "-t", String(audioLength + 0.2),
              "-vf", crop, "-an", "-threads", "2", "-preset", "ultrafast",
              "-pix_fmt", "yuv420p", tempVideoPath,
            ], { timeout: 90000 });
            if (await screenFootage(tempVideoPath, audioLength, visualRequirement)) return clip.id;
          } catch (error) {
            const cause = error instanceof Error ? error.message : String(error);
            logger.warn(
              { videoId, index, visualRequirement, reason: cause.slice(0, 300).replace(/https?:\/\/\S+/g, "[url]") },
              "External clip unavailable",
            );
          }
        }
        return undefined;
      };

      selectedId = await selectStock(this.pexelsApi, scene.searchTerms, strictChristianVisuals, maxAttempts);
      if (!selectedId && strictChristianVisuals) {
        const natureTerms = [
          "ocean waves rocky coast",
          "forest river flowing",
          "mountain lake moving clouds",
        ];
        const firstTerm = index % natureTerms.length;
        const rotatedTerms = [...natureTerms.slice(firstTerm), ...natureTerms.slice(0, firstTerm)];
        selectedId = await selectStock(this.pexelsApi, rotatedTerms, "nature", 6);
        if (selectedId) {
          logger.info({ videoId, index, selectedId }, "Using screened moving nature fallback");
        } else if (previousFootage) {
          await runMedia("ffmpeg", [
            "-y", "-loglevel", "error", "-stream_loop", "-1", "-i", previousFootage.path,
            "-t", String(audioLength + 0.2), "-an", "-threads", "2", "-preset", "ultrafast",
            "-pix_fmt", "yuv420p", tempVideoPath,
          ], { timeout: 90000 });
          selectedId = previousFootage.id;
          logger.warn({ videoId, index, selectedId }, "Nature fallback exhausted; continuing approved moving footage");
        } else {
          throw new Error(`No approved moving footage for devotional scene ${index + 1}`);
        }
      }
      if (!selectedId) {
        // Last-resort, bundled stills keep a scene renderable without weakening
        // the safety or devotional checks applied to downloaded footage.
        const fallbackPath = path.join(
          this.config.packageDirPath,
          "public",
          "grace",
          `scene-${index % 6}.jpg`,
        );
        if (!fs.existsSync(fallbackPath)) {
          throw new Error(
            `Stock footage exhausted for scene ${index + 1} after ${maxAttempts} attempts and bundled fallback image is missing.`,
          );
        }
        await runMedia(
          "ffmpeg",
          [
            "-y", "-loglevel", "error", "-loop", "1", "-i", fallbackPath,
            "-t", String(audioLength + 0.2),
            "-vf", crop,
            "-r", "30", "-an", "-threads", "2", "-preset", "ultrafast",
            "-pix_fmt", "yuv420p", tempVideoPath,
          ],
          { timeout: 90000 },
        );
        selectedId = `bundled-still-${index % 6}`;
        logger.warn(
          { videoId, index, attempts: maxAttempts, fallback: path.basename(fallbackPath) },
          "Stock footage exhausted; using bundled still-image fallback",
        );
      }
      if (strictChristianVisuals && previousFootage?.id !== selectedId) {
        previousFootage = { path: tempVideoPath, id: selectedId };
      }
      logger.info({videoId,index,selectedId},"Approved scene source");
      usedIds.push(selectedId);

      if (index === 0) {
        const coverFile = tempVideoPath + ".jpg";
        tempFiles.push(coverFile);
        await runMedia("ffmpeg", ["-y", "-loglevel", "error", "-i", tempVideoPath,
          "-frames:v", "1", "-q:v", "2", coverFile], { timeout: 30000 });
        coverBackground = `http://localhost:${this.config.port}/api/tmp/${path.basename(coverFile)}`;
      }

      scenes.push({
        captions,
        video: `http://localhost:${this.config.port}/api/tmp/${tempVideoFileName}`,
        audio: {
          url: `http://localhost:${this.config.port}/api/tmp/${tempMp3FileName}`,
          duration: audioLength,
        },
      });

      totalDuration += audioLength;
      index++;
    }


    const selectedMusic = this.findMusic(totalDuration, config.music);
    logger.debug({ selectedMusic }, "Selected music for the video");

    await this.remotion.render(
      {
        music: selectedMusic,
        scenes,
        config: {
          cover: {
            title: config.coverTitle ?? inputScenes[0].text.split(/(?<=[.!?])\s/)[0].split(/\s+/).slice(0,6).join(" "),
            subtitle: config.coverSubtitle,
            background: coverBackground,
            scene: artStart,
          },
          durationMs: totalDuration * 1000,
          paddingBack: config.paddingBack,
          quizCard: config.quizCard,
          ...{
            captionBackgroundColor: config.captionBackgroundColor,
            captionPosition: config.captionPosition,
          },
          musicVolume: config.musicVolume,
        },
      },
      videoId,
      orientation,
    );

    fs.writeJsonSync(historyPath + ".tmp", [...history, usedIds].slice(-365));
    fs.renameSync(historyPath + ".tmp", historyPath);
    return videoId;
    } catch (error) {
      fs.removeSync(this.getVideoPath(videoId));
      fs.removeSync(path.join(this.config.videosDirPath,videoId+".jpg"));
      throw error;
    } finally {
    for (const file of tempFiles) {
      fs.removeSync(file);
    }

    }
  }

  public getVideoPath(videoId: string): string {
    return path.join(this.config.videosDirPath, `${videoId}.mp4`);
  }

  public deleteVideo(videoId: string): void {
    const videoPath = this.getVideoPath(videoId);
    fs.removeSync(videoPath);
    fs.removeSync(path.join(this.config.videosDirPath,videoId+".jpg"));
    logger.debug({ videoId }, "Deleted video file");
  }

  public getVideo(videoId: string): Buffer {
    const videoPath = this.getVideoPath(videoId);
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video ${videoId} not found`);
    }
    return fs.readFileSync(videoPath);
  }

  private findMusic(videoDuration: number, tag?: MusicMoodEnum): MusicForVideo {
    const musicFiles = this.musicManager.musicList().filter((music) => {
      if (tag) {
        return music.mood === tag;
      }
      return true;
    });
    return musicFiles[Math.floor(Math.random() * musicFiles.length)];
  }

  public ListAvailableMusicTags(): MusicTag[] {
    const tags = new Set<MusicTag>();
    this.musicManager.musicList().forEach((music) => {
      tags.add(music.mood as MusicTag);
    });
    return Array.from(tags.values());
  }

  public listAllVideos(): { id: string; status: VideoStatus }[] {
    const videos: { id: string; status: VideoStatus }[] = [];

    // Check if videos directory exists
    if (!fs.existsSync(this.config.videosDirPath)) {
      return videos;
    }

    // Read all files in the videos directory
    const files = fs.readdirSync(this.config.videosDirPath);

    // Filter for MP4 files and extract video IDs
    for (const file of files) {
      if (file.endsWith(".mp4")) {
        const videoId = file.replace(".mp4", "");

        let status: VideoStatus = "ready";
        const inQueue = this.queue.find((item) => item.id === videoId);
        if (inQueue) {
          status = "processing";
        }

        videos.push({ id: videoId, status });
      }
    }

    // Add videos that are in the queue but not yet rendered
    for (const queueItem of this.queue) {
      const existingVideo = videos.find((v) => v.id === queueItem.id);
      if (!existingVideo) {
        videos.push({ id: queueItem.id, status: "processing" });
      }
    }

    return videos;
  }

  public ListAvailableVoices(): string[] {
    return this.kokoro.listAvailableVoices();
  }
}
