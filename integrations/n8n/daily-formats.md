# Grace In A Minute daily formats

Prepared configuration for the existing n8n workflow. Deployment and live previews remain pending.

Use timezone Asia/Kolkata with two Schedule Trigger rules, 07:00 and 19:00.
Morning format is morning_prayer; evening format is evening_verse.
Use the existing YouTube, Facebook and Instagram destination credentials.

## Morning prayer

Target 12–20 seconds with 22–35 spoken words. One short Christian encouragement and a prayer addressed to God, ending in Amen. Two or three moving scenes. A morning prayer does not mark a Bible verse as used.

## Evening verse

Read one unused verse from the existing sheet. Preserve the verse text and reference exactly. Follow with a faithful, plain-English explanation, a practical application, and a short prayer. Aim for 110–160 words and approximately 60–90 seconds. Let narration duration set the render length. Never accelerate the voice or cut the verse to force the duration. Divide narration into short sentences, each with relevant footage.

Use the reference as coverSubtitle and an accurate 3–6-word topic headline as coverTitle. Distinguish the quoted Scripture from the generated explanation. Validate the spoken verse against the sheet before rendering.

## Shared renderer config

    {
      "voice": "af_heart",
      "speechSpeed": 0.9,
      "orientation": "portrait",
      "musicVolume": "low",
      "paddingBack": 1200,
      "clipHistorySize": 60,
      "coverTitle": "Give It Time",
      "coverSubtitle": "Morning Prayer"
    }

Match each scene's searchTerms to that scene. Evening visuals must visibly relate to Christianity, for example an open Bible, Christian prayer, a church cross, or a Christian church. Avoid generic nature fallbacks for evening verses. The renderer tries Pexels, Commons, and Pixabay when configured. Every selected clip still passes motion and content screening. Metadata and automated classification cannot guarantee theological relevance; verify initial previews visually.

## Credentials and persistence

Set PIXABAY_API_KEY in Railway environment variables using the supplied credential. Never put it in a committed workflow or source file. Set DATA_DIR_PATH to a Railway persistent volume. The renderer keeps 24-hour Pixabay search cache and footage history under this directory. At two videos daily, excluding the last 60 successful renders provides roughly 30 days of exact-clip reuse protection. Similar footage with different IDs may still occur.

## Publishing and verification

Generate and inspect one unpublished preview per format before activating the schedule. Run the existing workflow only through Download MP4 for these tests. Verify the full verse, pacing, moving scenes after the opening cover, captions, music, watermark, and generated JPEG cover.

After approval, publish using the existing three platform branches. Store date + format + verse reference, render ID, and each platform's post ID and success status. Retry only failed destinations, using the already rendered video. Mark the evening verse used after confirmed publication. The morning run must bypass Mark Verse Used. A success state requires returned platform post IDs and confirmed processing, not merely a successful render.

The opening cover is embedded for 1.35 seconds and also exported as a JPEG. Selecting that image as the platform thumbnail requires the corresponding upload/cover setting. Verify actual account/API support, especially YouTube Shorts, before claiming the thumbnail is automatically selected.

## Cover guidance

Use a different approved scene frame for each video's background, one clear subject, an accurate short headline, readable type, high contrast, and the channel logo. Keep headline content near the center so platform crops retain it. Preview at phone size. Avoid sensational claims about healing, wealth, or promised miracles.

Sources reviewed 2026-11-07:
- https://support.google.com/youtube/answer/12340300
- https://pixabay.com/api/docs/
- https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md
