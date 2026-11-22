const bases=[
"https://incompetech.com/music/royalty-free/mp3-royaltyfree/",
"https://incompetech.com/royalty-free/",
"https://incompetech.com/music/royalty-free/",
];
const names=["Deck the Halls B.mp3","Jingle Bells.mp3","Silent Night.mp3","Jingle_Bells.m4a"];
for(const base of bases){
 for(const file of names){
  const url=base+encodeURIComponent(file);
  try {
   const res=await fetch(url,{headers:{"Range":"bytes=0-8192","User-Agent":"GraceInAMinuteMusicVerification/1.0"},signal:AbortSignal.timeout(9000)});
   const body=Buffer.from(await res.arrayBuffer());
   const mp3=body.subarray(0,3).toString()==="ID3"||(body[0]===255&&(body[1]&224)===224);
   const m4a=body.subarray(4,8).toString()==="ftyp";
   console.log(JSON.stringify({url,status:res.status,contentType:res.headers.get("content-type"),
     len:body.length,mp3,m4a}));
  }catch(e){console.log(JSON.stringify({url,error:String(e).slice(0,120)}))}
 }
}
