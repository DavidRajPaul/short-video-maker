import { Img, staticFile } from "remotion";

export const Watermark = () => (
  <Img src={staticFile("grace-logo.jpg")} style={{
    position: "absolute", right: "6%", bottom: "12%", width: "11%",
    aspectRatio: "1", borderRadius: "50%", opacity: 0.92,
  }} />
);
