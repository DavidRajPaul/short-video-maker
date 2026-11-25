import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBridge} from './n8n-bridge.mjs';
test('bridge requires dedicated credential and calls existing publisher only',()=>{
 assert.throws(()=>buildBridge({}));
 const w=buildBridge({credentialId:'example',credentialName:'Test only'});
 assert.equal(w.nodes.length,3);
 assert.equal(w.nodes[0].parameters.authentication,'headerAuth');
 assert.equal(w.nodes[2].parameters.workflowId.value,'UyXSFUjWdkjuqK1p');
 assert.equal(w.nodes[2].parameters.options.waitForSubWorkflow,true);
 assert.ok(!JSON.stringify(w).includes('scheduleTrigger'));
 const validate=new Function('$input',w.nodes[1].parameters.jsCode);
 const p={contentType:'generic',contentId:'manual-'+'a'.repeat(40),mode:'validateOnly',videoUrl:'https://ik.imagekit.io/test/a.mp4'};
 assert.deepEqual(validate({first:()=>({json:{body:{publisherInput:p}}})}),[{json:{publisherInput:p}}]);
 for(const patch of [{videoUrl:'https://evil.test/a.mp4'},{contentId:'quiz-id'},{mode:'privateYouTubeQA'}])assert.throws(()=>validate({first:()=>({json:{body:{publisherInput:{...p,...patch}}}})}));
});
