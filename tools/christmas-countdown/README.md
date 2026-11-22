# Temporary Christmas Countdown (2026)

**Feature branch only. NOT yet live in n8n or Railway.** This is a short-lived seasonal replacement for the **13:00 IST afternoon quote**. The 07:00 morning video, 16:00 quiz, and evening verse must remain untouched.

## Render pipeline

POST `/api/christmas-countdown` with `{"date":"2026-11-22"}` (YYYY-MM-DD, Asia/Kolkata).
It returns HTTP 201 with `videoId`, `contentId`, `title`, `description`, music license and tags. Poll the existing `/api/short-video/:videoId/status`, download `/api/short-video/:videoId` only once it is ready, archive permanently to ImageKit, then pass the URL to the existing shared publisher (modes `publishYouTube`, `publishFacebook`, `publishInstagram`). Use returned `contentId=christmas-countdown-YYYY-MM-DD` for the publisher ledger to block duplicate posts. No automatic retry of an uncertain publish.

Outside 2026-11-22 through 2026-12-26 the endpoint returns HTTP 409 with `{"active":false,"mode":"normal_quote"}`: the parent n8n afternoon branch should fall through to its original quote path, *not* retry this endpoint.

Date card rules: Nov 22 to Dec 24 countdown (accurate Christmas Eve counts); Dec 25 special Merry Christmas / Birth of Christ; Dec 26 emotional finale; Dec 27 and later restored normal quotes. Only the words **Christmas**, **Christmas Eve**, **Birth of Christ** are rotated.

Video: 13 seconds, vertical 1080×1920, 25 fps, glowing letters, festive garland, gently falling snow, illuminated tree, small Grace watermark, no narration, music-led and fade-out.

## Real Christmas instrumentals — commercial-use licenses

On first render the server downloads the selected Kevin MacLeod official recording into the renderer's existing temp directory and serves it locally; there is **no separate user download step**. Downloads fail closed on network/invalid audio. Existing render music and other 3 slots are unaffected.

** `Deck the Halls B` — Kevin MacLeod, CC BY 4.0, https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100368n federal government recording, https://commons.wikimedia.org/wiki/File:Deck_the_Halls_(USAFB_Concert_Band)_-_abridged.ogg
** `Jingle Bells` — Kevin MacLeod, CC BY 4.0, https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100187ns.wikimedia.org/wiki/File:Jingle_Bells_(ISRC_USUAN1100187).mp3
** `Silent Night` — Kevin MacLeod, CC BY 4.0, https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100075ns.wikimedia.org/wiki/File:Silent_Night_(ISRC_USUAN1100075).mp3

**Required:** Publish the API-provided `description` unchanged including the attribution text. These tracks may still receive erroneous automated Content ID matches; monitor and resolve claims. The copyrighted movie recording of *The Polar Express* is NOT in the soundtrack; use it only with suitable cross-platform synchronization rights.

## Rollout prerequisites

1. CI must pass (tests + TypeScript build). Read-only n8n workflow inspection in CI identifies the exact quote branch.
2. Review sample privately, verify both audible music and full-frame text, Christmas date, watermark, source recording, MP4 decode and JPEG cover.
3. Merge PR and verify Railway deployed the renderer successfully.
4. Make a non-destructive backup/export of n8n workflow `TCMiKoaj2xkNvK1L` and modify **only** the afternoon quote branch: date gate → Christmas API → poll/archive → shared publisher; if not seasonal → original quote.
5. Check shared publisher deduplication for `christmas_countdown`, and verify tests/private posts before activation. Never run both regular quote and Christmas video in the same afternoon.
6. On Dec 27 the gate must stop Christmas entirely and route back to quotes. No schedule beyond the finale.
7. Check FB/IG/YT public posting receipts rather than assuming renderer success means publication.

All steps must be verified before calling the production flow live.

## Verified 2026 Christmas live rollout (Nov 22)

**Production:** the original 3-slot workflow `TCMiKoaj2xkNvK1L` routes only its afternoon quote output through `Christmas 2026 Date Gate`. True during 2026-11-22 to 2026-12-26 (Asia/Kolkata), it calls internal Christmas child `lw6IvbrIW71nU1nO` with no independent schedule, which renders moving Christmas footage, archives to ImageKit and calls shared publisher `UyXSFUjWdkjuqK1p` independently for YouTube, Facebook and Instagram. Outside this period it falls back to the original quote path, including Dec 27 onwards. No morning/evening/quiz nodes were changed.

**Visuals:** two moving 6.5-second clips from Pexels/Pixabay, chosen using seasonal search terms, source URL/tag relevance and actual video-frame Christmas-classification checks; curated verified festive Pexels video IDs are available as fallback. Generic winter towns/sunsets are rejected. Only elegant glowing gold text with letter-clipped glitter and a small channel watermark overlay the footage. No synthetic tree/snow decorations.

**Music:** confirmed licensed Kevin MacLeod instrumental tracks downloaded from the official site: `Deck the Halls B`, `Jingle Bells`, `Silent Night` (CC BY 4.0, attribution must be in every platform description). No copyrighted film soundtrack.

**One-off launch:** a guarded one-time webhook runs only on Nov 22, with authentication derived from the secret held in GitHub Actions, and publishes the seasonal content only once per platform using the shared publisher's claim ledger. Publication is not confirmed until the per-platform receipt is verified. Never blindly retry an uncertain public post.

**Previous private test:** https://github.com/DavidRajPaul/short-video-maker/actions/runs/45008332028 (passed, actual Christmas tree and gifts footage with audible music).
