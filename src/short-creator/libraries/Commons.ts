import type { Video } from "../../types/shorts";
import { allowedText } from "./StockSafety";

// Only CC0: attribution/share-alike assets need a different publishing pipeline.
export async function findCommons(term:string, seconds:number, excluded:string[], timeout:number):Promise<Video | undefined> {
  const params=new URLSearchParams({action:"query",format:"json",generator:"search",gsrsearch:`filetype:video ${term} incategory:"CC-Zero"`,gsrnamespace:"6",gsrlimit:"16",prop:"videoinfo",viprop:"url|size|metadata|extmetadata"});
  const response=await fetch("https://commons.wikimedia.org/w/api.php?"+params,{headers:{"User-Agent":"GraceInAMinute/1.0 (https://github.com/DavidRajPaul/short-video-maker)"},signal:AbortSignal.timeout(timeout)});
  if (!response.ok) return;
  type Page={pageid:number; title:string; videoinfo?:{url:string;width:number;height:number;duration?:number;metadata?:{name:string;value:string}[];extmetadata?:Record<string,{value:string}>}[]};
  const json=await response.json();
  for(const page of Object.values(json.query?.pages ?? {}) as Page[]) {
    const info=page.videoinfo?.[0];
    const id="commons-"+page.pageid;
    if (!info || excluded.includes(id) || !allowedText(page.title)) continue;
    const license=info.extmetadata?.LicenseShortName?.value;
    const duration=Number(info.duration ?? info.metadata?.find(m=>m.name==="length")?.value);
    if (license !== "CC0" || !(duration >= seconds) || !/^https:\/\/upload\.wikimedia\.org\//.test(info.url) || !/\.(webm|mp4)$/i.test(info.url)) continue;
    return {id,url:info.url,width:info.width,height:info.height};
  }
}
