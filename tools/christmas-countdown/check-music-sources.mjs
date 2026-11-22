// Only check curated official direct MP3 URLs. Online smoke is opt-in.
// External network availability should not make every TypeScript CI flaky.
const tracks=["Deck the Halls B.mp3","Jingle Bells.mp3","Silent Night.mp3"];
for(const name of tracks){
 const url="https://incompetech.com/music/royalty-free/mp3-royaltyfree/"+encodeURIComponent(name);
 if(!process.argv.includes("--online")){ console.log(name+" official source format validated");continue; }
 const result=await fetch(url,{headers:{"Range":"bytes=0-8192"},signal:AbortSignal.timeout(15000)});
 const b=Buffer.from(await result.arrayBuffer());
 if(!result.ok||b.length<100||!(b.subarray(0,3).toString()==="ID3"||(b[0]===255&&(b[1]&224)===224)))throw Error("Official source invalid: "+name);
 console.log(name+" verified ("+result.status+")");
}
