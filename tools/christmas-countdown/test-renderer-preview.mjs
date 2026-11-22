import fs from "node:fs/promises";
const base="https://short-video-maker-production-4274.up.railway.app";
const result=await fetch(base+"/api/christmas-countdown",{
 method:"POST",headers:{"Content-Type":"application/json"},
 body:JSON.stringify({date:"2026-11-22"}),signal:AbortSignal.timeout(30000)
});
const text=await result.text();
if(!result.ok)throw Error("Renderer HTTP "+result.status+" "+text.slice(0,300));
const payload=JSON.parse(text);
if(payload.mode!=="countdown"||payload.active!==true||!payload.videoId||
   payload.contentId!=="christmas-countdown-2026-11-22")throw Error("Invalid Christmas metadata");
console.log(JSON.stringify({accepted:true,videoId:payload.videoId,track:payload.track,
 contentId:payload.contentId,license:payload.license}));
let ready=false;
for(let attempt=0;attempt<36;attempt++){
 await new Promise(resolve=>setTimeout(resolve,5000));
 const status=await fetch(base+"/api/short-video/"+payload.videoId+"/status",{signal:AbortSignal.timeout(10000)});
 if(!status.ok)throw Error("Status HTTP "+status.status);
 const data=await status.json();
 if(data.status==="ready"){ready=true;break}
 if(data.status==="failed")throw Error("Renderer failed: "+String(data.error||"no cause").slice(0,400));
 if(attempt%6===5)console.log("Renderer still processing "+attempt);
}
if(!ready)throw Error("Christmas renderer did not finish in preview test window");
const video=await fetch(base+"/api/short-video/"+payload.videoId,{signal:AbortSignal.timeout(60000)});
if(!video.ok)throw Error("MP4 HTTP "+video.status);
const bytes=Buffer.from(await video.arrayBuffer());
if(bytes.length<100000||bytes.subarray(4,8).toString()!=="ftyp")throw Error("Bad MP4 output");
await fs.writeFile("christmas-preview-2026-11-22.mp4",bytes);
const cover=await fetch(base+"/api/short-video/"+payload.videoId+"/cover.jpg",{signal:AbortSignal.timeout(30000)});
if(cover.ok){const b=Buffer.from(await cover.arrayBuffer());await fs.writeFile("christmas-preview-cover.jpg",b)}
console.log(JSON.stringify({renderReady:true,videoId:payload.videoId,bytes:bytes.length,
 temporaryVideoUrl:base+"/api/short-video/"+payload.videoId}));
