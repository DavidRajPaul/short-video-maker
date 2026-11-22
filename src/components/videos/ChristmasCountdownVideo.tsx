import React from "react";
import {
  AbsoluteFill, Audio, interpolate, OffthreadVideo, Sequence,
  useCurrentFrame, useVideoConfig,
} from "remotion";
import { loadFont as loadScriptFont } from "@remotion/google-fonts/GreatVibes";
import { loadFont as loadDisplayFont } from "@remotion/google-fonts/CinzelDecorative";
import { Watermark } from "./Watermark";
import type { ChristmasCard } from "../../short-creator/christmas";

const scriptFont = loadScriptFont().fontFamily;
const displayFont = loadDisplayFont().fontFamily;

export type ChristmasVideoProps = {
  card: ChristmasCard;
  musicUrl: string;
  /** REAL stock video clips from Pexels/Pixabay; mandatory for final render. */
  backgroundClips: { url: string; durationFrames: number; stockId: string }[];
};

/**
 * Nothing synthetic in the background: only real Pexels/Pixabay moving stock.
 * Glitter and golden Christmas lights are constrained to the LETTER SHAPES,
 * not a separate animated tree, border, snow overlay or floating particles.
 */
const GlitterText: React.FC<{
  children: string;
  size: number;
  script?: boolean;
  tracking?: number;
}> = ({children, size, script = false, tracking = 0}) => {
  const frame = useCurrentFrame();
  const tick = frame * 2;
  return (
    <div style={{
      fontFamily: script ? scriptFont : displayFont,
      fontSize: size,
      fontWeight: script ? 400 : 700,
      lineHeight: script ? 1.35 : 1.15,
      letterSpacing: tracking,
      width: "100%",
      textAlign: "center",
      // Motion in the GOLD foil texture, clipped to the exact glyphs.
      backgroundImage: "radial-gradient(circle at " + (18 + (tick % 68)) + "% 20%,#ffffff 0%,#fff9bf 7%,transparent 12%)," +
        "repeating-linear-gradient(108deg,transparent 0px,transparent 26px,#fff9cd 29px,transparent 33px,transparent 76px)," +
        "linear-gradient(90deg,#a36b20,#ffdf77,#fffdec,#e4aa3f,#fff9c0,#ac7227)",
      backgroundSize: "100% 100%, 280px 100%, 100% 100%",
      backgroundPosition: "0 0," + (tick % 280) + "px 0,0 0",
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 0 " + (5 + 2 * Math.sin(frame / 5)) + "px #ffe2a0) drop-shadow(0 4px 10px #10070c)",
      whiteSpace: "normal",
      overflowWrap: "normal",
    }}>{children}</div>
  );
};

export const ChristmasCountdownVideo: React.FC<ChristmasVideoProps> = ({ card, musicUrl, backgroundClips }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  if (!backgroundClips.length || backgroundClips.some(c=>!c.url || c.durationFrames <= 0)) {
    throw new Error("Christmas Countdown requires verified REAL stock background videos");
  }
  const appear = interpolate(frame, [0, 20], [0.92, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const fade = interpolate(frame, [durationInFrames - 18, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  let start = 0;
  return (
    <AbsoluteFill style={{overflow:"hidden", backgroundColor:"#05070a"}}>
      {backgroundClips.map((clip, i) => {
        const from = start;
        start += clip.durationFrames;
        return (
          <Sequence key={clip.stockId + i} from={from} durationInFrames={clip.durationFrames}>
            <AbsoluteFill>
              <OffthreadVideo src={clip.url} muted style={{
                width:"100%",height:"100%",objectFit:"cover",
              }} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
      {/* Gentle readability tint; the only decoration is on the LETTERING itself. */}
      <AbsoluteFill style={{
        background: "linear-gradient(180deg,rgba(7,9,15,0.04) 0%,rgba(10,13,22,0.33) 34%,rgba(12,10,18,0.47) 62%,rgba(7,9,15,0.15) 100%)",
      }} />
      <AbsoluteFill style={{
        justifyContent:"center", alignItems:"center",
        padding:"0 54px 160px", boxSizing:"border-box",
        transform:"scale(" + appear + ")", opacity:fade,
      }}>
        {card.mode === "countdown" ? (
          <>
            <GlitterText size={238}>{String(card.daysRemaining)}</GlitterText>
            <div style={{marginTop:16}}>
              <GlitterText size={53} tracking={5}>{card.daysRemaining === 1 ? "DAY TO" : "DAYS TO"}</GlitterText>
            </div>
            <div style={{marginTop:28,width:"100%"}}>
              <GlitterText script size={
                card.emphasis === "Birth of Christ" ? 116 :
                card.emphasis === "Christmas Eve" ? 148 : 190
              }>{card.emphasis}</GlitterText>
            </div>
          </>
        ) : card.mode === "christmas_day" ? (
          <>
            <GlitterText script size={190}>Merry Christmas</GlitterText>
            <GlitterText size={60}>BIRTH OF CHRIST</GlitterText>
          </>
        ) : (
          <>
            <GlitterText script size={154}>Until Next Christmas</GlitterText>
            <GlitterText size={62}>ONE MORE YEAR</GlitterText>
          </>
        )}
      </AbsoluteFill>
      <Watermark />
      <Audio src={musicUrl} volume={f => interpolate(
        f,[0,12,durationInFrames-22,durationInFrames],[0,0.86,0.86,0],
        {extrapolateLeft:"clamp",extrapolateRight:"clamp"},
      )}/>
    </AbsoluteFill>
  );
};
