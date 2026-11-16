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
