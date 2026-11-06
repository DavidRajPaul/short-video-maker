import { AbsoluteFill, Img, staticFile } from "remotion";

export type Cover = { title: string; scene: number };
export function GraceCover({title,scene}:Cover) {
  const light = ["#f7ca77","#a5dbdc","#fed39b","#c1cafa","#efba93","#b6ddba"][scene];
  return <AbsoluteFill style={{background:"#111"}}>
    <Img src={staticFile(`grace/scene-${scene}.jpg`)} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
    <AbsoluteFill style={{background:"linear-gradient(0deg,rgba(8,13,22,.96),rgba(8,13,22,.60) 40%,transparent 83%)"}}/>
    <div style={{position:"absolute",left:"9%",right:"12%",bottom:"28%",color:light,fontSize: title.length>65 ? 82 : 102,lineHeight:1.04,fontWeight:700,fontFamily:scene%2?"Georgia,serif":"sans-serif",textShadow:"0 3px 18px #111"}}>{title}</div>
  </AbsoluteFill>;
}
