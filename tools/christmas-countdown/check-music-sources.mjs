// CI smoke test for exact licensed recordings; cannot claim publication if source fails.
const tracks = [
  ["deck-the-halls","Deck the Halls (USAFB Concert Band) - abridged.ogg","ogg"],
  ["jingle-bells","Jingle Bells (ISRC USUAN1100187).mp3","mp3"],
  ["silent-night","Silent Night (ISRC USUAN1100075).mp3","mp3"],
];
for(const [key,filename,ext] of tracks){
 const url="https://commons.wikimedia.org/wiki/Special:Redirect/file/"+encodeURIComponent(filename);
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error(key+" failed HTTP "+response.status);
 const bytes=Buffer.from(await response.arrayBuffer());
 const valid=ext==="ogg"?bytes.subarray(0,4).toString("ascii")==="OggS":bytes.subarray(0,3).toString("ascii")==="ID3"||(bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0);
 if(!valid||bytes.length<50000||bytes.length>15000000)throw new Error(key+" invalid audio "+bytes.length);
 console.log(key+" validated ("+bytes.length+" bytes; "+ext+")");
}
