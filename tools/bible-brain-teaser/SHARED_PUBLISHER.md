# Grace In A Minute — Shared publishing and daily Bible quiz

## Production status: 2026-11-16

**4 PM Bible quiz is publicly enabled for YouTube, Facebook and Instagram.**

| Workflow | n8n ID | State |
| --- | --- | --- |
| Original FINAL 3 Slots | `TCMiKoaj2xkNvK1L` | Active; original publishing nodes unchanged |
| 4 PM Bible Brain Teaser | `nB10Ub0ZIxCe5gHI` | Active; daily 16:00 Asia/Kolkata, 29 nodes |
| Reusable internal publisher | `UyXSFUjWdkjuqK1p` | Published; 58 nodes; no external trigger |
| Old six-node quiz draft | `iEiu5vka5sAVMxMl` | Unpublished; does not run |

The original FINAL 3 Slots has **not** yet been migrated to the shared publisher. It keeps using its existing public upload nodes. The 4 PM quiz calls the shared publisher independently three times, once per platform, after private Railway render and permanent ImageKit MP4 archiving.

## Input contract

```json
{
  "publisherInput": {
    "contentId": "jonah-great-fish",
    "contentType": "bible_quiz",
    "videoUrl": "https://ik.imagekit.io/.../quiz.mp4",
    "title": "Bible Brain Teaser | Jonah and the Great Fish",
    "description": "Question and options...\nANSWER: B. Jonah. Scripture: Jonah 1:17.",
    "tags": ["BibleQuiz", "GraceInAMinute"],
    "mode": "publishFacebook"
  }
}
```

Modes: `validateOnly`, `privateYouTubeQA`, `draftMeta`, `publishYouTube`, `publishFacebook`, `publishInstagram`.

Public modes are guarded by the `Bible_Publish_Attempts` tab in the existing Bible Database spreadsheet: `1GEw7bdgmqC9bb6lfAdJV9ILkRa23qSbW_-6nn6XHqSk`. A `claimed` event is appended **before** any remote public API call, and a `published` or `uncertain` event is appended when a result is available. If the same content ID/platform already has a claim, the shared publisher stops. **Do not automatically retry an uncertain post**: reconcile the remote platform ID with the ledger first. This is intentional fail-closed deduplication.

### Verified public test (2026-11-16)

A single archived Jonah puzzle was published using the shared publisher's actual end-to-end modes:

- YouTube: `https://www.youtube.com/watch?v=WkBbdVRPFb0`
- Facebook: `https://www.facebook.com/reel/2637879256674893`
- Instagram: `https://www.instagram.com/reel/DfzW3jslNvu/`

All three public receipts and remote IDs were saved to `Bible_Publish_Attempts`; temporary public test parent workflows were deleted. The private YouTube mode had separately passed metadata/privacy validation; the Meta draft-only modes had also passed without public posting.

### Scheduled sequence

1. Read `Bible_Puzzle_History`, select an unused approved Bible fact and **reserve** it before rendering.
2. Render the approved persistent question + A/B/C animated 9:16 card with Kokoro `am_michael`.
3. Poll Railway until ready and upload MP4 into ImageKit to avoid ephemeral Railway URLs.
4. Validate shared publisher metadata, then launch independent `publishYouTube`, `publishFacebook`, `publishInstagram` calls.
5. Each child checks its own platform claim, publishes, writes its own outcome, and returns a receipt.
6. Each parent platform branch catches errors so a failure on one social platform does not block the other two.

The correct answer and Bible reference are in the description, not displayed on-screen.

### Question bank supply

The quiz currently includes **77 distinct curated fact/concept entries** and a permanent dedupe check. The source of truth is `tools/bible-brain-teaser/n8n-bible-teaser-4pm-draft.json`, with the 69 additional approved entries also stored in `curated-additional-puzzles.json`. The active bank was synced and read-back verified through `sync-curated-bank.mjs`.

**This bank is finite.** Replenish with further Scripture-checked unique facts before fewer than 14 remain. Do not repeat a canonical concept or answer-fact ID. Never generate unverified Bible answers for an automatic public post.

### Safety and maintenance

- Use the stored `N8N_API_KEY` GitHub Actions secret; never paste its value into code or chat.
- GitHub Action public-POST test is **manual-only** and should not be rerun casually; the ledger blocks duplicate posts.
- Existing three-slot publishing remains unaffected.
- The shared publisher has no schedule, webhook, or other public trigger. It only handles calls from authenticated n8n workflows.
- Both deployment scripts are idempotent after successful production activation.
- Google Sheets and Meta credentials are referenced from the original n8n workflows, not copied as literal secrets into GitHub.
- The original production publisher-settings node contains a long-lived Meta token literal; rotate that token in n8n separately after verifying the migrated publisher, so it is not embedded in workflow exports.

## Links

- 4 PM workflow: `https://meetdavidraj7.n8n-wsk.com/workflow/nB10Ub0ZIxCe5gHI`
- Shared publisher: `https://meetdavidraj7.n8n-wsk.com/workflow/UyXSFUjWdkjuqK1p`
- Original 3 Slots: `https://meetdavidraj7.n8n-wsk.com/workflow/TCMiKoaj2xkNvK1L`
