import React from "react";
import { AbsoluteFill, Audio, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Watermark } from "./Watermark";
import type { ChristmasCard } from "../../short-creator/christmas";

export type ChristmasVideoProps = {
  card: ChristmasCard;
  musicUrl: string;
};

const W = 1080;
const H = 1920;
const dots = Array.from({ length: 85 }, (_, i) => ({
  x: (i * 137.508 + 23) % W,
  y: (i * 315.7 + 47) % H,
  size: 2 + (i % 4) * 2,
  speed: 0.4 + (i % 7) * 0.19,
}));

/** Deterministic Remotion animation: no AI assets, no text running/marquee. */
export const ChristmasCountdownVideo: React.FC<ChristmasVideoProps> = ({ card, musicUrl }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / 25;
  const appear = interpolate(frame, [0, 22], [0.87, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fade = interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const palette = card.colorway === "blue"
    ? ["#071f42", "#17447b", "#65b9d2"]
    : card.colorway === "green"
      ? ["#082a28", "#165348", "#dfb85d"]
      : ["#340919", "#851f2b", "#f1a84a"];
  const sparkle = (i: number) => 0.38 + Math.sin(t * (2.4 + i % 3) + i * 7) * 0.30;

  return (
    <AbsoluteFill style={{ color: "#fff8df", overflow: "hidden", fontFamily: "Georgia, Times New Roman, serif" }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 46%, ${palette[1]} 0%, ${palette[0]} 80%)` }} />
      <div style={{ position: "absolute", inset: -100, opacity: 0.26,
        background: `radial-gradient(circle at 18% 10%,${palette[2]} 0%,transparent 23%),radial-gradient(circle at 82% 72%,${palette[2]} 0%,transparent 29%)` }} />

      {/* Elegant tree made of golden lights; leaves safe room for readable text. */}
      {Array.from({ length: 7 }, (_, row) => Array.from({ length: 7 + row * 2 }, (_, col) => {
        const total = 7 + row * 2;
        const xx = W / 2 + (col - (total - 1) / 2) * (17 + row * 7);
        const yy = 1205 + row * 58;
        return <div key={row + "-" + col} style={{
          position: "absolute", left: xx, top: yy, borderRadius: "50%",
          width: 7 + (col % 3) * 3, height: 7 + (col % 3) * 3,
          background: col % 4 === 0 ? "#ff646a" : "#fff2a8",
          boxShadow: "0 0 20px 7px #ffeb9859", opacity: sparkle(row * 15 + col),
        }} />;
      }))}

      {/* Subtle drifting snow and light flecks. */}
      {dots.map((dot, i) => (
        <div key={i} style={{
          position: "absolute", left: dot.x + Math.sin(t * 0.6 + i) * 25,
          top: (dot.y + t * (12 + dot.speed * 25)) % H,
          width: dot.size, height: dot.size, borderRadius: "50%",
          opacity: 0.25 + 0.45 * Math.abs(Math.sin(t + i)),
          background: i % 4 ? "#fffef1" : "#ffd16a", boxShadow: "0 0 12px #ffffff",
        }} />
      ))}

      {/* Light garland across the upper corners. */}
      <div style={{ position: "absolute", left: 0, top: 135, width: W, height: 4, background: "#e9b96b" }} />
      {Array.from({length: 15}, (_,i) => <div key={i} style={{
        position: "absolute", left: 38 + i * 72, top: 128,
        width: 23, height: 31, borderRadius: "50% 50% 45% 45%",
        background: i % 3 === 0 ? "#ffbd64" : i % 3 === 1 ? "#ed7471" : "#b6fff1",
        boxShadow: `0 0 ${16 + 7 * Math.sin(t * 2.5 + i)}px ${5 + 2 * Math.sin(t + i)}px #fff5b877`,
      }} />)}
      <div style={{ position:"absolute",top:290,left:70,right:70,textAlign:"center",fontSize:37,letterSpacing:9,fontFamily:"Arial, sans-serif",fontWeight:700,color:"#f8d388" }}>GRACE IN A MINUTE</div>

      <div style={{ position: "absolute", left: 50, right: 50, top: 475, textAlign: "center",
        transform: `scale(${appear})`, opacity: fade }}>
        {card.mode === "countdown" ? (
          <>
            <div style={{ fontFamily:"Georgia, serif", fontWeight: 900, fontSize: 245, lineHeight: 1.15,
              color:"#fff5d0",textShadow:"0 0 32px #ffdf76, 0 8px 30px #080d22" }}>{card.daysRemaining}</div>
            <div style={{fontFamily:"Arial, sans-serif",fontSize:53,letterSpacing:8,fontWeight:850,marginTop:20,
              color:"#ffffff",textShadow:"0 2px 18px #070c1e"}}>{card.daysRemaining === 1 ? "DAY TO" : "DAYS TO"}</div>
            <div style={{fontSize:card.emphasis === "Birth of Christ" ? 106 : card.emphasis === "Christmas Eve" ? 118 : 148,
              fontWeight:900,marginTop:65,lineHeight:1.06,color:"#ffe7a2",
              textShadow:"0 0 14px #ffe7a2, 0 0 36px #f7ba50, 0 7px 18px #30060b"}}>{card.emphasis}</div>
          </>
        ) : (
          <>
            <div style={{fontSize:card.mode==="finale"?100:147,lineHeight:1.15,fontWeight:900,
              color:"#fff4c8",textShadow:"0 0 22px #f8c656,0 0 48px #ce763b"}}>{card.headline}</div>
            <div style={{fontSize:83,marginTop:60,color:"#ffe29a",textShadow:"0 0 24px #f5c069"}}>{card.emphasis}</div>
          </>
        )}
        <div style={{marginTop:95,height:3,background:"linear-gradient(90deg,transparent,#efc771,transparent)"}} />
        <div style={{marginTop:36,fontFamily:"Arial, sans-serif",fontSize:43,lineHeight:1.35,fontWeight:700,
          textShadow:"0 3px 12px #071324"}}>{card.subline}</div>
      </div>
      {/* Brand and visual disclaimer free: no voice, no unreadable running caption. */}
      <Watermark />
      <Audio src={musicUrl} volume={(f)=>interpolate(f,[0,12,durationInFrames-24,durationInFrames],[0,0.82,0.82,0],{extrapolateLeft:"clamp",extrapolateRight:"clamp"})} />
    </AbsoluteFill>
  );
};
