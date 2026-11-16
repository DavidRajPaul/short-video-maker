import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { z } from "zod";
import type { shortVideoSchema } from "../utils";
import { calculateVolume } from "../utils";

/**
 * Dedicated Bible-quiz presentation. Unlike the devotional renderer, no timed
 * Whisper captions are drawn. The full question and all three choices remain
 * visible together from the end of the hook until the very last frame.
 * Pure frame-driven animation makes visual output deterministic and asset-free.
 */
export const BibleQuizVideo: React.FC<z.infer<typeof shortVideoSchema>> = ({ scenes, music, config }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const quiz = config.quizCard!;
  const introFrames = Math.max(1, Math.round((scenes[0]?.audio.duration ?? 2) * fps));
  const showQuestion = frame >= introFrames;
  const [volume, muted] = calculateVolume(config.musicVolume);
  const t = frame / fps;
  const easeIn = interpolate(frame, [introFrames, introFrames + Math.round(fps * .4)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const questionFont = quiz.question.length > 94 ? 50 : quiz.question.length > 66 ? 58 : 68;
  const optionFont = Math.min(62, quiz.choices.some(o=>o.length>19) ? 47 : 59);
  const bar = Math.min(1, frame / Math.max(1, durationInFrames - 1)) * 100;
  const bob = Math.sin(t * 2.7) * 15;
  const tilt = Math.sin(t * 2.3) * 2.4;
  const font = "Arial, Helvetica, sans-serif";
  return (
    <AbsoluteFill style={{overflow:"hidden",background:"#79d7ff",fontFamily:font}}>
      {/* Continuous playful storybook animation, never stock footage. */}
      <AbsoluteFill style={{background:"linear-gradient(180deg,#4aa9f4 0%,#8be8e7 61%,#ffe1aa 100%)"}} />
      <div style={{position:"absolute",left:760,top:160,width:220,height:220,borderRadius:"50%",background:"#ffe97b",boxShadow:"0 0 0 22px #ffe97b40,0 0 80px #fff1a0"}} />
      {Array.from({length:8},(_,i)=><div key={"ray"+i} style={{position:"absolute",left:864,top:270,width:250,height:8,background:"#fff5a18a",borderRadius:10,transformOrigin:"0 50%",transform:`rotate(${i*45+t*5}deg)`}} />)}
      {[{x:35,y:300,s:1},{x:685,y:470,s:.85},{x:240,y:740,s:.65}].map((c,i)=>
        <div key={i} style={{position:"absolute",left:c.x+Math.sin(t*.45+i)*45,top:c.y,transform:`scale(${c.s})`,opacity:.95}}>
          <div style={{position:"absolute",left:0,top:25,width:210,height:76,borderRadius:80,background:"#fff"}} />
          <div style={{position:"absolute",left:44,top:-6,width:120,height:112,borderRadius:"50%",background:"#fff"}} />
          <div style={{position:"absolute",left:128,top:5,width:130,height:98,borderRadius:"50%",background:"#fff"}} />
        </div>)}
      <div style={{position:"absolute",left:780+Math.sin(t*.9)*60,top:590,fontSize:92,opacity:.88,transform:`rotate(${Math.sin(t*2)*10}deg)`}}>v</div>
      {/* Gently animated sea behind the ark. */}
      {[0,1,2].map((i)=><div key={i} style={{position:"absolute",left:-80,top:1530+i*118,width:1320,height:310,background:["#238cd1","#1977bf","#1160ab"][i],borderRadius:"50% 50% 0 0",transform:`translateX(${Math.sin(t*.8+i)*70}px) translateY(${Math.sin(t*1.4+i)*14}px)`}} />)}
      {/* Little floating ark with two peekaboo animals; it rocks continuously. */}
      <div style={{position:"absolute",left:310,top:1515+bob,width:830,height:360,transform:`scale(.43) rotate(${tilt}deg)`,transformOrigin:"top left"}}>
        <div style={{position:"absolute",left:250,top:50,width:340,height:185,background:"#c98b4f",border:"12px solid #874c27",borderRadius:28}} />
        <div style={{position:"absolute",left:213,top:14,width:415,height:52,background:"#ad6235",clipPath:"polygon(50% 0,100% 100%,0 100%)"}}/>
        {[320,460].map((x,i)=><div key={x} style={{position:"absolute",left:x,top:90,width:92,height:102,borderRadius:45,background:i===0?"#eec282":"#b9cad7",border:"7px solid #765a44"}}>
          {[19,54].map(ex=><div key={ex} style={{position:"absolute",left:ex,top:32,width:11,height:17,borderRadius:10,background:"#263746"}} />)}
          <div style={{position:"absolute",left:27,top:68,width:33,height:8,borderRadius:20,background:"#785b43"}}/>
        </div>)}
        <div style={{position:"absolute",left:76,top:212,width:692,height:138,background:"#a75b32",clipPath:"polygon(0 0,100% 0,86% 100%,14% 100%)",borderTop:"19px solid #f2b866"}} />
        {[257,297].map(y=><div key={y} style={{position:"absolute",left:186,top:y,width:470,height:11,background:"#efb96d",borderRadius:12}} />)}
      </div>
      <div style={{position:"absolute",left:0,right:0,top:180,height:88,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{background:"#163e69",color:"#fff",padding:"19px 58px",borderRadius:70,fontSize:39,fontWeight:900,letterSpacing:3,boxShadow:"0 10px 26px #1a517d60"}}>GRACE IN A MINUTE</span>
      </div>
      {!showQuestion ? (
        <div style={{position:"absolute",left:75,right:75,top:600,background:"#12385cF2",border:"7px solid #f9ce69",borderRadius:52,padding:"80px 48px",color:"#fff",textAlign:"center",boxShadow:"0 24px 70px #12385c66",transform:`scale(${1+Math.sin(t*3)*.025})`}}>
          <div style={{fontSize:75,fontWeight:950,color:"#ffe483",lineHeight:1.12}}>BIBLE BRAIN TEASER!</div>
          <div style={{marginTop:48,fontSize:53,fontWeight:700,lineHeight:1.22}}>{quiz.hook ?? "A little Bible trick question!"}</div>
          <div style={{marginTop:35,fontSize:86,color:"#ffe483",fontWeight:900}}>?</div>
        </div>
      ) : (
        <div style={{position:"absolute",left:64,right:64,top:445,bottom:340,background:"#103757F5",border:"7px solid #ffd26b",borderRadius:48,padding:"45px 46px",color:"#fff",boxShadow:"0 25px 80px #032b518a",display:"flex",flexDirection:"column",justifyContent:"center",opacity:easeIn,transform:`translateY(${(1-easeIn)*25}px)`}}>
          <div style={{fontSize:44,color:"#ffe17a",fontWeight:950,textAlign:"center",letterSpacing:2}}>BIBLE TRICK QUESTION</div>
          <div style={{fontSize:questionFont,fontWeight:900,textAlign:"center",lineHeight:1.15,margin:"42px 0 36px",overflowWrap:"break-word"}}>{quiz.question}</div>
          <div style={{display:"flex",flexDirection:"column",gap:22}}>
            {quiz.choices.map((choice,i)=><div key={i} style={{background:["#fff6d7","#eef7ff","#faeeff"][i],color:"#12385c",minHeight:115,display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",borderRadius:28,padding:"13px 28px",fontSize:optionFont,fontWeight:900,boxShadow:"0 7px 0 #092842",overflowWrap:"anywhere"}}>{String.fromCharCode(65+i)}. {choice}</div>)}
          </div>
          <div style={{marginTop:48,textAlign:"center",color:"#ffe17a",fontSize:41,fontWeight:800}}>{quiz.cta ?? "Comment A, B or C! 👇"}</div>
          <div style={{marginTop:22,textAlign:"center",fontSize:30,color:"#e6edf5"}}>Answer in the description</div>
        </div>
      )}
      <div style={{position:"absolute",left:65,right:65,bottom:170,display:"flex",justifyContent:"space-between",alignItems:"center",color:"#fff",fontWeight:900,fontSize:30,textShadow:"0 3px 9px #12385c"}}>
        <span>FUN BIBLE QUIZ</span><span>YOUR TURN!</span>
      </div>
      <div style={{position:"absolute",left:70,right:70,bottom:132,height:13,borderRadius:20,background:"#ffffff7a",overflow:"hidden"}}>
        <div style={{height:"100%",width:bar+"%",background:"#ffdf6c"}} />
      </div>
      {/* Narration is timed independently of the persistent text card. */}
      {scenes.map((scene,i)=>{
        const start=Math.round(scenes.slice(0,i).reduce((n,s)=>n+s.audio.duration,0)*fps);
        return <Sequence key={i} from={start} durationInFrames={Math.max(1,Math.round(scene.audio.duration*fps))}><Audio src={scene.audio.url}/></Sequence>;
      })}
      <Audio loop src={music.url} startFrom={music.start*fps} endAt={music.end*fps} volume={volume*.45} muted={muted}/>
    </AbsoluteFill>
  );
};
