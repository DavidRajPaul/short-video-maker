// Preview Nov 23's scheduled countdown. Do NOT publish on any social platform.
import fs from "node:fs/promises";
const base="https://short-video-maker-production-4274.up.railway.app";
const date="2026-11-23";
const res=await fetch(base+"/api/christmas-countdown",{
 method:"POST",headers:{"Content-Type":"application/json"},
 body:JSON.stringify({date}),signal:AbortSignal.timeout(30000)
});
const text=await res.text();
if(!res.ok)throw Error("Renderer returned "+res.status+": "+text.slice(0,250));
const p=JSON.parse(text);
if(p.contentId!=="christmas-countdown-2026-11-23"||!p.videoId||p.active!==true)
 throw Error("Unexpected private preview metadata");
console.log(JSON.stringify({accepted:true,date:p.date,contentId:p.contentId,title:p.title,track:p.track,videoId:p.videoId}));
let status="queued";
for(let attempt=0;attempt<70;attempt++){
 await new Promise(r=>setTimeout(r,6000));
 const sr=await fetch(base+"/api/short-video/"+p.videoId+"/status",{signal:AbortSignal.timeout(15000)});
 if(!sr.ok)throw Error("Status HTTP "+sr.status);
 const s=await sr.json();status=s.status;
 if(status==="ready")break;
 if(status==="failed")throw Error("Private snowy-Christmas preview failed: "+String(s.error||"unknown").slice(0,320));
 if(attempt%10===9)console.log(JSON.stringify({poll:attempt+1,status}));
}
if(status!=="ready")throw Error("Private preview not ready within check window");
const vr=await fetch(base+"/api/short-video/"+p.videoId,{signal:AbortSignal.timeout(70000)});
if(!vr.ok)throw Error("Private MP4 GET HTTP "+vr.status);
const video=Buffer.from(await vr.arrayBuffer());
if(video.length<100000||video.subarray(4,8).toString("ascii")!=="ftyp"||video.indexOf(Buffer.from("soun"))<0)
 throw Error("Private preview missing MP4 or sound track");
await fs.writeFile("christmas-nov23-outdoor-preview.mp4",video);
const cr=await fetch(base+"/api/short-video/"+p.videoId+"/cover.jpg",{signal:AbortSignal.timeout(25000)});
if(cr.ok)await fs.writeFile("christmas-nov23-outdoor-cover.jpg",Buffer.from(await cr.arrayBuffer()));
console.log(JSON.stringify({ready:true,bytes:video.length,videoId:p.videoId,privateOnly:true}));
