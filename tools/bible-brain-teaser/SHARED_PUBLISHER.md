# Reusable Grace In A Minute publisher — integration state

## Workflows

- **Original production (untouched):** `TCMiKoaj2xkNvK1L`, FINAL 3 Slots.
- **4 PM quiz & ImageKit archival workflow:** `nB10Ub0ZIxCe5gHI`, 20 nodes, published, cron `0 16 * * *`, timezone `Asia/Kolkata`.
- **Internal shared publisher:** `UyXSFUjWdkjuqK1p`, published, 36 nodes, `executeWorkflowTrigger` with `inputSource: passthrough`. No schedule or webhooks.
- **Old six-node quiz preview:** `iEiu5vka5sAVMxMl`, unpublished and unused.

The shared publisher is extracted from the real production YouTube, Facebook and Instagram nodes and **reuses their credential references within n8n**. No account access tokens are committed to GitHub.

## Input contract

Call the shared publisher using an Execute Sub-workflow node with one JSON object:

```json
{
  "publisherInput": {
    "contentId": "jonah-great-fish",
    "contentType": "bible_quiz",
    "videoUrl": "https://ik.imagekit.io/.../video.mp4",
    "title": "Bible Brain Teaser | Who spent three days inside a great fish?",
    "description": "Question and options ...\n\nANSWER: Jonah. Jonah 1:17.",
    "tags": ["BibleQuiz", "GraceInAMinute"],
    "mode": "validateOnly"
  }
}
```

Supported modes and *verified behaviour*:

| Mode | Actual result |
| --- | --- |
| `validateOnly` | Schema and answer/reference guard. No platform request. **Passed** real parent→child execution. |
| `privateYouTubeQA` | Downloads ImageKit MP4, uploads to YouTube with `privacyStatus=private`. **Passed** with independent read-back of YouTube privacy and description. |
| `draftMeta` | Creates an IG media container and Facebook Reel upload session, transfers the hosted MP4 using the `file_url` header. **Passed**, without invoking IG Publish or FB Finish. |

There is **no `publicAll` mode yet**. All Facebook finish and Instagram publish nodes remain disabled/disconnected. YouTube privacy is fixed to Private. This prevents accidental public uploads.

## Original three slots

The three-slot workflow has not been switched to the shared publisher: it still follows the existing direct upload graph. Once the shared workflow's public-publish path, logging, and retry logic pass real end-to-end tests, modify the original three-slot routing in a separate change and verify that all three original slots still publish before removing the old graph. Avoid making that migration at the same time as the new quiz's first public post.

## Bible quiz flow

The 4 PM workflow now archives MP4 to ImageKit and calls the internal publisher in `validateOnly` mode. The input contains the unique puzzle ID, published-quality ImageKit MP4 URL, quiz title and description (correct answer and Scripture in description only). This confirms the handoff without sending a public post.

## Reliability work before public activation

1. Implement IG `media_publish` and Facebook `upload_phase=finish` in the shared workflow and verify the returned published IDs and links.
2. Add a public YouTube mode, verify correct account, title, privacy, and answer metadata.
3. Read/write `Bible_Publish_Attempts` in the existing Bible Database (sheet ID `1GEw7bdgmqC9bb6lfAdJV9ILkRa23qSbW_-6nn6XHqSk`). Record one result per platform and content ID. Use platform-specific idempotency to avoid re-uploading YouTube when Facebook fails.
4. Fail closed if a content ID/platform is already published, and never retry an uncertain post automatically.
5. Connect the 4 PM workflow to the public publisher only after a controlled end-to-end test. **Do not assume publishing is live from an n8n active flag; verify `activeVersionId` and test execution.**

## Tests and rollback

- Read-only inventory: `inspect-shared-publisher.mjs`.
- Extract source nodes: `build-shared-publisher.mjs`.
- Publish internal-only version (validated restrictions): `enable-shared-publisher-internal.mjs`.
- Add safe Meta draft ingestion: `extend-shared-publisher-meta.mjs`.
- Private YouTube and Meta ingestion QA tests: dedicated test scripts and GitHub Actions. These are one-time tests and should **not** run on every commit.
- Connect the quiz handoff: `connect-quiz-shared-publisher.mjs`.

Rollback just the quiz handoff by restoring its previous published version in n8n or stopping the 4 PM workflow; the original three-slot publisher is unaffected.
