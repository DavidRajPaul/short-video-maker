import { AbsoluteFill, Img, staticFile } from "remotion";

export type Cover = {
  title: string;
  scene: number;
  background?: string;
  subtitle?: string;
};

export function GraceCover({ title, scene, background, subtitle }: Cover) {
  const accents = ["#f7ca77", "#a5dbdc", "#fed39b", "#c1cafa", "#efba93", "#b6ddba"];
  const accent = accents[scene % accents.length];
  return (
    <AbsoluteFill style={{ background: "#111" }}>
      <Img src={background ?? staticFile(`grace/scene-${scene}.jpg`)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <AbsoluteFill style={{
        background: "linear-gradient(0deg,rgba(8,13,22,.96),rgba(8,13,22,.65) 42%,transparent 85%)",
      }} />
      <div style={{
        position: "absolute", left: "9%", right: "12%", bottom: "28%",
        color: "white", fontSize: title.length > 35 ? 88 : 110,
        lineHeight: 1.08, fontWeight: 700, fontFamily: "Georgia,serif",
        textShadow: "0 3px 18px #111", overflowWrap: "break-word",
      }}>
        {subtitle && <div style={{
          fontSize: 32, color: accent, fontFamily: "sans-serif",
          marginBottom: 28, letterSpacing: 2,
        }}>{subtitle}</div>}
        {title}
      </div>
    </AbsoluteFill>
  );
}
