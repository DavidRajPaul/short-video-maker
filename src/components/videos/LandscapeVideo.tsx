import { Watermark } from "./Watermark";
import { ClosingBeat } from "./ClosingBeat";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  Audio,
  OffthreadVideo,
  interpolate,
} from "remotion";
import { z } from "zod";
import { loadFont } from "@remotion/google-fonts/BarlowCondensed";

import {
  calculateVolume,
  createCaptionPages,
  shortVideoSchema,
} from "../utils";

const { fontFamily } = loadFont(); // "Barlow Condensed"

export const LandscapeVideo: React.FC<z.infer<typeof shortVideoSchema>> = ({
  scenes,
  music,
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const captionBackgroundColor = config.captionBackgroundColor ?? "blue";

  const activeStyle = {
    backgroundColor: captionBackgroundColor,
    padding: "10px",
    marginLeft: "-10px",
    marginRight: "-10px",
    borderRadius: "10px",
  };

  const captionPosition = config.captionPosition ?? "center";
  let captionStyle = {};
  if (captionPosition === "top") {
    captionStyle = { top: 100 };
  }
  if (captionPosition === "center") {
    captionStyle = { top: "50%", transform: "translateY(-50%)" };
  }
  if (captionPosition === "bottom") {
    captionStyle = { bottom: 100 };
  }

  const [musicVolume, musicMuted] = calculateVolume(config.musicVolume);
  const musicFadeFrames = Math.min(
    Math.round(fps * 0.9),
    Math.round(((config.paddingBack ?? 0) / 1000) * fps),
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "white" }}>
      <Audio
        loop
        src={music.url}
        startFrom={music.start * fps}
        endAt={music.end * fps}
        volume={() =>
          musicFadeFrames > 0
            ? musicVolume * interpolate(
                frame,
                [durationInFrames - musicFadeFrames, durationInFrames - 1],
                [1, 0],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              )
            : musicVolume
        }
        muted={musicMuted}
      />

      {scenes.map((scene, i) => {
        const { captions, audio, video } = scene;
        const pages = createCaptionPages({
          captions,
          lineMaxLength: 30,
          lineCount: 1,
          maxDistanceMs: 1000,
        });

        // Calculate the start and end time of the scene
        const startFrame =
          scenes.slice(0, i).reduce((acc, curr) => {
            return acc + curr.audio.duration;
          }, 0) * fps;
        const durationInFrames = Math.max(1, Math.round(audio.duration * fps));

        return (
          <Sequence
            from={Math.round(startFrame)}
            durationInFrames={durationInFrames}
            key={`scene-${i}`}
          >
            <OffthreadVideo src={video} muted />
            <Audio src={audio.url} />
            {pages.map((page, j) => {
              return (
                <Sequence
                  key={`scene-${i}-page-${j}`}
                  from={Math.round((page.startMs / 1000) * fps)}
                  durationInFrames={Math.round(
                    ((page.endMs - page.startMs) / 1000) * fps,
                  )}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      width: "100%",
                      ...captionStyle,
                    }}
                  >
                    {page.lines.map((line, k) => {
                      return (
                        <p
                          style={{
                            fontSize: "8em",
                            fontFamily: fontFamily,
                            fontWeight: "black",
                            color: "white",
                            WebkitTextStroke: "2px black",
                            WebkitTextFillColor: "white",
                            textShadow: "0px 0px 10px black",
                            textAlign: "center",
                            width: "100%",
                            // uppercase
                            textTransform: "uppercase",
                          }}
                          key={`scene-${i}-page-${j}-line-${k}`}
                        >
                          {line.texts.map((text, l) => {
                            const active =
                              frame >=
                                startFrame + (text.startMs / 1000) * fps &&
                              frame <= startFrame + (text.endMs / 1000) * fps;
                            return (
                              <>
                                <span
                                  style={{
                                    fontWeight: "bold",
                                    ...(active ? activeStyle : {}),
                                  }}
                                  key={`scene-${i}-page-${j}-line-${k}-text-${l}`}
                                >
                                  {text.text}
                                </span>
                                {l < line.texts.length - 1 ? " " : ""}
                              </>
                            );
                          })}
                        </p>
                      );
                    })}
                  </div>
                </Sequence>
              );
            })}
          </Sequence>
        );
      })}
      <ClosingBeat
        title={config.cover?.title}
        subtitle={config.cover?.subtitle}
        durationMs={config.paddingBack}
      />
      <Watermark />
    </AbsoluteFill>
  );
};
