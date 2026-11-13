import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

type ClosingBeatProps = {
  title?: string;
  subtitle?: string;
  durationMs?: number;
};

/** A short animated close over the last moving-footage scene. */
export const ClosingBeat: React.FC<ClosingBeatProps> = ({
  title,
  subtitle,
  durationMs = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const tailFrames = Math.min(Math.round((durationMs / 1000) * fps), fps * 2.4);

  if (tailFrames < 1) return null;

  const startFrame = durationInFrames - tailFrames;
  const progress = interpolate(frame, [startFrame, durationInFrames - 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(progress, [0, 0.3, 1], [0, 1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(progress, [0, 1], [34, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const accentWidth = interpolate(progress, [0, 1], [0, 104], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (frame < startFrame) return null;

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          top: "36%",
          background: "linear-gradient(180deg, transparent 0%, rgba(5, 10, 20, .34) 32%, rgba(5, 10, 20, .88) 100%)",
          opacity,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "9%",
          right: "9%",
          bottom: "19%",
          textAlign: "center",
          color: "#fff",
          opacity,
          transform: `translateY(${translateY}px)`,
          textShadow: "0 3px 18px rgba(0,0,0,.65)",
        }}
      >
        <div
          style={{
            width: accentWidth,
            height: 5,
            margin: "0 auto 24px",
            borderRadius: 8,
            background: "#e8bd69",
          }}
        />
        <div
          style={{
            fontFamily: "Georgia, serif",
            fontSize: title && title.length > 32 ? 58 : 72,
            fontWeight: 700,
            lineHeight: 1.12,
            overflowWrap: "break-word",
          }}
        >
          {title || "Grace for today"}
        </div>
        <div
          style={{
            marginTop: 20,
            fontFamily: "Arial, sans-serif",
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: 5,
            color: "#f0d89f",
            textTransform: "uppercase",
          }}
        >
          {subtitle || "Grace In A Minute"}
        </div>
      </div>
    </AbsoluteFill>
  );
};
