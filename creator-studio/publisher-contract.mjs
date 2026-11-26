// Server-side contract only. Never call n8n directly from a browser.
import { createHash } from 'node:crypto';
const modes = Object.freeze({youtube:'publishYouTube',facebook:'publishFacebook',instagram:'publishInstagram'});
export function buildPublisherRequests({mediaSha256, videoUrl, title, description, tags=[], platforms, allowedMediaOrigins, approved=false}) {
  if (!/^[a-f0-9]{64}$/.test(mediaSha256??'')) throw Error('Verified SHA-256 of rendered media required');
  const url = new URL(videoUrl);
  if(url.protocol!=='https:'||url.username||url.password||url.hash||!Array.isArray(allowedMediaOrigins)||!allowedMediaOrigins.includes(url.origin)) throw Error('Unapproved media origin');
  if(typeof title!=='string'||!title.trim()||title.trim().length>100) throw Error('Title must be 1–100 characters');
  if(typeof description!=='string'||!description.trim()||description.trim().length>2200) throw Error('Caption must be 1–2200 characters');
  if(!Array.isArray(tags)||tags.length>30||tags.some(t=>typeof t!=='string'||!/^#?[\p{L}\p{N}_]{1,60}$/u.test(t))) throw Error('Invalid hashtags');
  if(!Array.isArray(platforms)||!platforms.length||platforms.some(p=>!Object.hasOwn(modes,p))) throw Error('Invalid platform selection');
  // Stable identity across retries or edits to metadata. Compute media hash server-side.
  const contentId='manual-'+createHash('sha256').update(mediaSha256).digest('hex').slice(0,40);
  const input={contentId,contentType:'generic',videoUrl:url.href,title:title.trim(),description:description.trim(),tags:[...new Set(tags.map(t=>t.replace(/^#/,'')))]};
  return [...new Set(platforms)].map(platform=>({platform,publisherInput:{...input,mode:approved===true?modes[platform]:'validateOnly'}}));
}
