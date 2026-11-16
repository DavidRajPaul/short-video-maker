# Bible Brain Teaser — preview-only implementation

This standalone feature is intentionally not wired into the live 3-slot n8n workflow. It introduces a puzzle data contract, deduplication checks, a Scripture-validation gate, answer-in-description template, and an 18-second storyboard/render plan. It does not auto-post or schedule comments.

## Prototype

Example: How many animals did Moses take on the ark? with A/B/C choices. The video ends with Comment your answer! Then check the description. The answer and Scripture reference occur only in the generated description, separated by emoji lines.

Important: Video platforms do not guarantee that a caption separator hides the answer behind a more control. Check YouTube, Instagram, and Facebook on a normal viewer account before enabling publishing.

The first standalone local preview is shared separately in ChatGPT; it uses a simple synthetic narrator, not the production Kokoro voice.

## Usage

Import EXAMPLE, validatePuzzle, duplicateReason, buildRenderPlan and buildDescription from brain-teaser.mjs. Call validatePuzzle(EXAMPLE, allHistoryRows) before rendering. buildRenderPlan(EXAMPLE) returns a preview-only 18-second scene specification.

Run tests: node --test tools/bible-brain-teaser/brain-teaser.test.mjs

## Required permanent history fields

puzzle_id, question, canonical_concept, answer_fact_id, format, answer, scripture_reference, scripture_verified, approved, status, created_at, published_at, youtube_id, instagram_id, facebook_id.

Caller must map Sheet columns to camelCase properties. Compare candidates against all reserved/published history. Reserve before rendering. Use an atomic reservation or single writer to avoid concurrency duplicates.

## Rules before enabling live slot

1. Generate a variety of puzzle formats and stories. Compare normalized question, canonical concept, and answer-fact ID.
2. Current lexical overlap check is a first filter only. Add independent semantic comparison to reject paraphrases; do not claim perfect duplicate protection.
3. Verify Scripture against a trusted Bible text before setting scriptureVerified=true. Do not trust an AI-generated boolean.
4. Keep current three slots unchanged; integrate teaser as separate n8n path only after review.
5. Adapt scene plan to Kokoro and Remotion in existing renderer; this standalone feature does not modify render endpoints.
6. Test description expansion and answer visibility on all three platforms from a viewer account.
7. Track YouTube, Facebook and Instagram publish statuses independently; do not automatically enable publishing based on this PR.

## Staged rollout

Stage A: contract, validation, dedupe, sample storyboard, tests (this PR).
Stage B: Google Sheets history adapter, n8n candidates, scripture and semantic checks.
Stage C: Bible illustrations + Kokoro/Remotion integration.
Stage D: private platform tests then optionally enable a fourth daily slot.

## V2 preview design adjustments (Nov 16, 2026)

Second local MP4 preview supplied in ChatGPT: 18s, 720x1280, 30 FPS, H.264/AAC with faststart. Keep existing three live slots unchanged.

Rendering rules for future Remotion implementation:
- Use a large quiz card with a generous minimum 24 px interior horizontal margin at 540px base width.
- Create independently measured bounding boxes for title, question, answer buttons, and CTA. Do not allow text outside its assigned bounding box.
- Fit font sizes to measured widths, line counts and heights, and wrap on words (never clip or overflow).
- Favor heavy playful display headings (Inter Black used in local V2 preview); body text must stay readable on phone screens.
- The answer should not appear in on-screen cards or narration. Keep it in the description after the viewer's comment prompt.
- Export mobile-safe H.264 yuv420p + AAC with faststart, 30 FPS, vertical aspect ratio.
- Verify extreme-length questions and four/five-line variants before merging render integration.

Note: V2 is currently a local preview render, not a connected Railway production render. The draft PR remains unmerged and has no n8n workflow changes.

## Narration quality gate (review feedback)

V1/V2 local previews used a robotic placeholder speech synthesizer. That voice is REJECTED for release; do not reuse it or describe it as production quality.

For the next production-quality preview:
- Generate narration through the existing deployed Kokoro pipeline, NOT the local placeholder TTS.
- Use a bright, warm, conversational quiz-host delivery, with natural rise and fall rather than reading headings mechanically.
- Narrate the trick question as a single thought, with a short pause after "Moses"; do not audibly emphasize the correct answer.
- Pace slightly faster for the hook, slower and clear for the question and options, then excited but not shouty for the comment CTA.
- Narration text must exclude emojis, markdown punctuation, scene headings, markup, and Scripture answer.
- Split phrases into separately timed clips, adding ~200–400 ms pauses, rather than synthesizing entire card text as one flat utterance.
- Align scene duration to actual speech length; never speed-compress narration just to reach exactly 18 seconds.
- Mix background music well below the speech; duck music while speaking; avoid competing sound effects.
- Before publishing, listen to the actual MP4 narration; reject clips with robotic intonation, incorrect emphasis, cut-off words, or poor pronunciation.
- Do not generate another claimed "voice-fixed" preview until it has actually been synthesized and listened to using the approved production pipeline.

## Approved male voice

User selected Kokoro voice ID `am_michael` for Bible Brain Teaser. The scene render plan now explicitly requests that voice at baseline speed 1.0, with phrase pauses, music ducking and narration-length-aware timing. This is metadata for later renderer integration, not proof of generated audio. Do not merge this preview-only PR assuming that Railway or n8n has been updated. Existing daily slots must retain their current narrator.

## Approved posting time — 4:00 PM IST daily

The approved new slot is **16:00 Asia/Kolkata every day**. File `n8n-bible-teaser-4pm-draft.json` provides an **inactive, importable n8n scaffold** with a schedule trigger, workflow timezone, and a no-publishing guard. It is not connected to the existing FINAL 3 Slots workflow and does not publish content.

Schedule trigger cron: `0 16 * * *` with workflow setting `timezone: Asia/Kolkata` (UTC+05:30; 10:30 UTC). It must be imported as a separate workflow and remain inactive until puzzle generation, complete Google Sheets history, approved Scripture verification, correct Kokoro `am_michael` rendering, and independent platform publishing are tested. Never enable the schedule before the guard is replaced by the validated pipeline.

The existing three video slots stay unchanged. The draft workflow is committed to GitHub only; no active n8n schedule has been created.
