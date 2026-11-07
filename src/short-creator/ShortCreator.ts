import { allowedText, runMedia, screenFootage } from "./libraries/StockSafety";
import { randomInt } from "node:crypto";
import { OrientationEnum } from "./../types/shorts";
/* eslint-disable @remotion/deterministic-randomness */
import fs from "fs-extra";
import cuid from "cuid";
import path from "path";

import { Kokoro } from "./libraries/Kokoro";
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
  private queue: {
    sceneInput: SceneInput[];
    config: RenderConfig;
    id: string;
  }[] = [];
  constructor(
    private config: Config,
    private remotion: Remotion,
    private kokoro: Kokoro,
    private whisper: Whisper,
    private ffmpeg: FFMpeg,
    private pexelsApi: PexelsAPI,
    private musicManager: MusicManager,
  ) {}

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
    this.queue.push({
      sceneInput,
      config,
      id,
    });
    if (this.queue.length === 1) {
      this.processQueue();
    }
    return id;
  }

  private async processQueue(): Promise<void> {
    // todo add a semaphore
    if (this.queue.length === 0) {
      return;
    }
    const { sceneInput, config, id } = this.queue[0];
    logger.debug(
      { sceneInput, config, id },
      "Processing video item in the queue",
    );
    try {
      await this.createShort(id, sceneInput, config);
      logger.debug({ id }, "Video created successfully");
    } catch (error: unknown) {
      logger.error(error, "Error creating video");
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
    let index = 0;
    for (const scene of inputScenes) {
      const audio = await this.kokoro.generate(
        scene.text,
        config.voice ?? "af_heart",
        config.speechSpeed ?? 1,
      );
      let { audioLength } = audio;
      const { audio: audioStream } = audio;

      // add the paddingBack in seconds to the last scene
      if (index + 1 === inputScenes.length && config.paddingBack) {
        audioLength += config.paddingBack / 1000;
      }

      const tempId = cuid();
      const tempWavFileName = `${tempId}.wav`;
      const tempMp3FileName = `${tempId}.mp3`;
      const tempVideoFileName = `${tempId}.mp4`;
      const tempWavPath = path.join(this.config.tempDirPath, tempWavFileName);
      const tempMp3Path = path.join(this.config.tempDirPath, tempMp3FileName);
      const tempVideoPath = path.join(
        this.config.tempDirPath,
        tempVideoFileName,
      );
      tempFiles.push(tempVideoPath);
      tempFiles.push(tempWavPath, tempMp3Path);

      await this.ffmpeg.saveNormalizedAudio(audioStream, tempWavPath);
      const captions = await this.whisper.CreateCaption(tempWavPath);

      await this.ffmpeg.saveToMp3(audioStream, tempMp3Path);
      let accepted = false;
      let selectedId = "";
      for (let attempt = 0; attempt < 8 && !accepted; attempt++) {
       try {
        const clip = await this.pexelsApi.findVideo(scene.searchTerms,audioLength,excludeVideoIds,orientation);
        excludeVideoIds.push(clip.id);
        const raw = tempVideoPath+".stock";
        tempFiles.push(raw);
        // Bound storage and time. Re-encode only the selected excerpt; discard stock audio.
        const vertical = orientation === OrientationEnum.portrait;
        const size = vertical ? "1080:1920" : "1920:1080";
        await runMedia("curl",["--fail","--location","--proto","=https","--max-time","60","--max-filesize","100000000","--output",raw,clip.url]);
        await runMedia("ffmpeg",["-y","-loglevel","error","-i",raw,"-t",String(audioLength+0.2),"-vf",`scale=${size}:force_original_aspect_ratio=increase,crop=${size},setsar=1`,"-an","-threads","2","-preset","ultrafast","-pix_fmt","yuv420p",tempVideoPath],{timeout:90000});
        accepted = await screenFootage(tempVideoPath,audioLength);
        selectedId = clip.id;
      } catch { logger.warn({videoId,index},"External clip unavailable"); }
      }
      if (!accepted) throw new Error("No approved moving footage found for scene " + (index+1));
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
