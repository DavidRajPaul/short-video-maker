# Bible Brain Teaser — Safe 4 PM Publishing Staging

## Status (2026-11-16)
- Existing FINAL 3 Slots (`TCMiKoaj2xkNvK1L`) remains active and unmodified.
- Six-node private quiz draft (`iEiu5vka5sAVMxMl`) remains unpublished.
- Separate 17-node staging (`nB10Ub0ZIxCe5gHI`) is **inactive** and does not publish. It reads and reserves approved puzzle history, renders via Railway, waits for ready, then archives the resulting MP4 on ImageKit.
- All three social platform nodes are **disconnected by design**, not tested for real uploads.
- Live end-to-end PRIVATE test verified an archived MP4 with a public ImageKit URL and successful HTTP HEAD. The temporary test workflow was removed.
- Read-only OAuth/Graph requests returned successful responses for YouTube, Facebook and Instagram; these are **not** proof of publishing permission or a completed upload.

## Why ImageKit, not Cloudinary
The original production node named "Upload Scenic Background to Cloudinary" actually points to ImageKit's `upload.imagekit.io` API, using an existing HTTP Basic credential. The staging builder uses that existing ImageKit credential and API with a `file` URL and `fileName` ending in `.mp4`.

This solves Railway's ephemeral preview URL problem: the rendered video is uploaded to an external persistent media store before any potential Facebook or Instagram operations.

## Safe use
`node tools/bible-brain-teaser/build-publisher-staging.mjs` requires an `N8N_API_KEY` environment variable (set only in GitHub Actions secrets; never commit it). It creates or updates the named staging workflow **only while inactive**. It retrieves credential references from the original live workflow without printing secrets and asserts that the publishing nodes are not reachable from the schedule.

Do not activate or publish the staging workflow as a full fourth slot until:
1. Upload a quiz **privately** to YouTube and verify its metadata and correct channel.
2. Verify that the public ImageKit MP4 can create an Instagram Reel container; test Instagram publish on an approved test account or with explicit publishing authorization.
3. Test Facebook's start/transfer/finish stages, especially the `file_url` header and status polling, without reusing the old broken Railway link.
4. Confirm that each platform receives the answer in its description, not in the spoken video.
5. Update the puzzle history row with each platform ID and success/failure independently, and retry only the failed platform without selecting a new puzzle.
6. Ensure only one active 4 PM IST trigger across the quiz workflows and confirm no duplicates on retries.

The approved quiz visual design is the dedicated Remotion `quizCard` renderer: a short hook, stationary question and A/B/C options through the final frame, looping playful background, Kokoro `am_michael`, no Whisper word-by-word captions, correct answer only in descriptions.
