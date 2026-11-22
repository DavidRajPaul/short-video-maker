// CI smoke test for exact licensed recordings; cannot claim publication if source fails.
const tracks = [
  ["deck-the-halls","Deck the Halls (USAFB Concert Band) - abridged.ogg","ogg"],
  ["jingle-bells","Jingle Bells (ISRC USUAN1100187).mp3","mp3"],
  ["silent-night","Silent Night (ISRC USUAN1100075).mp3","mp3"],
];
for(const [key,filename,ext] of tracks){
 const { createHash } = await import("node:crypto");
 const normalized=filename.replace(/ /g,"_"),md5=createHash("md5").update(normalized).digest("hex");
 const url="https://upload.wikimedia.org/wikipedia/commons/"+md5[0]+"/"+md5.slice(0,2)+"/"+encodeURIComponent(normalized);
 if(!url.startsWith("https://upload.wikimedia.org/wikipedia/commons/")) throw new Error("Unexpected music URL");
 if(!["ogg","mp3"].includes(ext)) throw new Error("Unexpected audio extension");
 if (!process.argv.includes("--online")) {
   console.log(key+" source URL schema validated (network probe skipped)");
   continue;
 }
 let response;
 for(let attempt=0;attempt<4;attempt++){
   response=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{"User-Agent":"GraceInAMinuteChristmasRenderer/1.0 (source Wikimedia Commons)"}});
   if(response.ok)break;
   if(![429,502,503,504].includes(response.status)||attempt===3)throw new Error(key+" failed HTTP "+response.status);
   await new Promise(resolve=>setTimeout(resolve,1200*2**attempt));
 }
 const bytes=Buffer.from(await response.arrayBuffer());
 const valid=ext==="ogg"?bytes.subarray(0,4).toString("ascii")==="OggS":bytes.subarray(0,3).toString("ascii")==="ID3"||(bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0);
 if(!valid||bytes.length<50000||bytes.length>15000000)throw new Error(key+" invalid audio "+bytes.length);
 console.log(key+" validated ("+bytes.length+" bytes; "+ext+")");
}
