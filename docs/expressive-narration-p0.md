# Expressive Narration P0 (Kokoro-safe)

This change is opt-in. Existing requests with just `scenes[].text` and `config` continue with one speech segment per scene and the existing speed default (1x). No ElevenLabs or external provider is enabled.

## Uplifting preset

```json
{
  "scenes": [
    {
      "text": "The Lord is my shepherd. You are not alone.",
      "searchTerms": ["bible", "prayer"],
      "narration": {
        "segments": [
          {
            "text": "The Lord is my shepherd.",
            "delivery": "reverent",
            "pauseAfterMs": 900
          },
          {
            "text": "You are not alone.",
            "delivery": "uplifting",
            "pauseAfterMs": 500
          }
        ]
      }
    }
  ],
  "config": {
    "narrationProfile": {
      "mood": "uplifting",
      "intensity": 75
    },
    "speechSpeed": 0.9,
    "voice": "af_heart"
  }
}
```

The plain `scene.text` must match the concatenation of sanitized narration segments exactly. Preserve Bible verses as supplied by the verified verse source; this renderer **does not independently verify scripture translations or references**. Upstream n8n must still validate Scripture and narration sequencing.

If only `narrationProfile` is supplied, the renderer splits each scene at natural sentence boundaries and adds a 350-ms pause between sentences. For explicit segments, `pauseAfterMs` controls the inserted PCM silence (0–2000 ms per segment). The last pause, if set, is genuine audio silence; `paddingBack` remains separate visual trailing time.

Kokoro does **not** implement emotion intensity. `mood`, `delivery`, and `intensity` are safe metadata for later provider adapters, not spoken tags or acoustic guarantees. Real acoustic controls today: selected voice, speed, timed silence. No arbitrary SSML/audio tags are sent to Kokoro. Known stage directions are stripped and unknown bracketed non-reference directions are rejected.

Captions are transcribed from **each normalized speech segment**, their offsets then shifted by the measured segment durations plus inserted silence. The final scene audio is concatenated into one 16 kHz mono PCM WAV before conversion to MP3. Subtitles stay silent during pauses.

## Tests and rollout

- Run `npx vitest run src/short-creator/libraries/Narration.test.ts`.
- Run `npx tsc --project tsconfig.build.json --noEmit`.
- Before merging: verify tests, generate **unpublished** Kokoro previews with explicit segments and legacy single-text input, and listen for tag/asterisk narration and caption drift.
- Do not switch n8n scheduling or publishing in this PR. The changes do not configure Railway or enable paid providers.
