import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const host='https://short-video-maker-production-4274.up.railway.app';
const workflow=JSON.parse(await fs.readFile(new URL('./n8n-bible-teaser-4pm-draft.json',import.meta.url),'utf8'));
const code=workflow.nodes.find(x=>x.name==='Choose Unused Verified Puzzle')?.parameters?.jsCode;
if(!code)throw new Error('No quiz bank');
const output=new Function('$input',code)({all:()=>[{json:{}}]});
const quiz=output[0].json;
if(!quiz?.renderRequest?.scenes?.length||!quiz.previewOnly||quiz.autoPublish!==false)
 throw new Error('Not a safe private quiz render');
if(quiz.renderRequest.scenes.some(scene=>scene.text.includes(quiz.answer)))
 throw new Error('Answer leaked into scene');
console.log('Private quiz:',quiz.puzzleId,'voice:',quiz.renderRequest.config.voice);
const response=await fetch(host+'/api/short-video',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(quiz.renderRequest),signal:AbortSignal.timeout(30000)});
if(!response.ok)throw new Error('Render request failed HTTP '+response.status);
const {videoId}=await response.json();
if(!/^[A-Za-z0-9_-]{8,80}$/.test(videoId??''))throw new Error('Missing valid videoId');
console.log('Accepted render ID:',videoId);
const statusUrl=host+'/api/short-video/'+encodeURIComponent(videoId)+'/status';
let ready=false;
for(let i=0;i<80;i++){
 await new Promise(resolve=>setTimeout(resolve,8000));
 const res=await fetch(statusUrl,{signal:AbortSignal.timeout(20000)});
 if(!res.ok)throw new Error('Status GET HTTP '+res.status);
 const {status}=await res.json();
 if(i%6===0)console.log('Render status:',status);
 if(status==='ready'){ready=true;break;}
 if(['failed','error','cancelled'].includes(status))throw new Error('Renderer reported '+status);
}
if(!ready)throw new Error('Renderer did not become ready before bounded timeout');
const videoUrl=host+'/api/short-video/'+encodeURIComponent(videoId);
const videoRes=await fetch(videoUrl,{signal:AbortSignal.timeout(90000)});
if(!videoRes.ok)throw new Error('Video GET HTTP '+videoRes.status);
const video=Buffer.from(await videoRes.arrayBuffer());
if(video.length<100000)throw new Error('MP4 unexpectedly small: '+video.length);
await fs.writeFile('/tmp/bible-quiz-private.mp4',video);
const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration,size:stream=codec_type,width,height','-of','json','/tmp/bible-quiz-private.mp4'],{encoding:'utf8'});
if(probe.status!==0)throw new Error('ffprobe error '+probe.stderr.slice(0,500));
const info=JSON.parse(probe.stdout);
const v=info.streams.find(x=>x.codec_type==='video'),a=info.streams.find(x=>x.codec_type==='audio');
if(!v||!a)throw new Error('MP4 lacks video or audio stream');
if(!(v.height>v.width))throw new Error('Video is not portrait');
const duration=Number(info.format.duration);
if(!(duration>=10&&duration<=45))throw new Error('Duration outside safe short-video range: '+duration);
console.log(JSON.stringify({videoUrl,videoId,bytes:video.length,portrait:`${v.width}x${v.height}`,hasAudio:true,durationSeconds:duration},null,2));
