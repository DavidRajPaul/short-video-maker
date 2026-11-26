import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPublisherRequests} from './publisher-contract.mjs';
const input={mediaSha256:'a'.repeat(64),videoUrl:'https://media.example/video.mp4',title:'Hope',description:'A message of hope',tags:['#Faith','Faith','GraceInAMinute'],platforms:['youtube','facebook','instagram'],allowedMediaOrigins:['https://media.example']};
test('defaults to validation only and normalizes hashtags',()=>{const r=buildPublisherRequests(input);assert.equal(r.length,3);assert.ok(r.every(x=>x.publisherInput.mode==='validateOnly'));assert.deepEqual(r[0].publisherInput.tags,['Faith','GraceInAMinute']);});
test('approved mode maps each platform independently',()=>{const r=buildPublisherRequests({...input,approved:true});assert.deepEqual(r.map(x=>x.publisherInput.mode),['publishYouTube','publishFacebook','publishInstagram']);});
test('same media keeps its identity after edits or retry',()=>{const [a]=buildPublisherRequests(input);const [b]=buildPublisherRequests({...input,title:'Different',platforms:['facebook','facebook']});assert.equal(a.publisherInput.contentId,b.publisherInput.contentId);assert.equal(buildPublisherRequests({...input,platforms:['facebook','facebook']}).length,1);});
test('fails closed on unknown origin, missing hash, invalid platform, invalid tag or blank title',()=>{for(const patch of [{videoUrl:'http://media.example/file'},{videoUrl:'https://evil.example/file'},{mediaSha256:''},{platforms:['other']},{tags:['bad tag']},{title:' '}])assert.throws(()=>buildPublisherRequests({...input,...patch}));});
test('truthy strings cannot approve public posting',()=>{assert.equal(buildPublisherRequests({...input,approved:'true'})[0].publisherInput.mode,'validateOnly');});
