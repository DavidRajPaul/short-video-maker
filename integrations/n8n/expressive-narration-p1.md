# P1 — n8n expressive narration integration

## Deployment state

This PR introduces a self-contained n8n **Code** node script and tests; it does **not** modify the active n8n instance, credentials, published workflows, or scheduled triggers. Wire it into a copy of the real workflow only after the existing node names and data structure have been inspected.

## Where to insert

Place a new **Code / JavaScript / Run Once for All Items** node after the source-selection / script-generation / verified verse lookup and **before** the existing video rendering HTTP/MCP node. Paste the exact contents of `expressive-narration.code.js`.

The incoming item must provide:

| Field | Morning or intense prayer | Evening verse |
| --- | --- | --- |
| `format` | `morning_prayer` or `intense_prayer` | `evening_verse` |
| `prayerText` | Required exact spoken prayer | Required exact spoken closing prayer |
| `verseText` | Omit | **Required exact verified scripture**, from the existing verse sheet |
| `verseReference` | Omit | Required |
| `explanationText` | Omit | Required |
| `searchTerms` | Required array | Required array |
| `sceneSearchTerms` | Optional keys: `prayer` | Optional keys: `scripture`, `explanation`, `prayer` |
| `prayerSegments` | Optional list of `{text}` whose joined text matches `prayerText` | Omit |
| `renderConfig` | Optional existing renderer options | Optional existing renderer options |

The node outputs `$json.renderPayload = { scenes, config }` ready for the existing renderer's **request body**. Adapt the *existing* HTTP/MCP node to use `{{$json.renderPayload}}` for request data, preserving the existing URL, authorization, timeout and render-id tracking. Do not replace publishing nodes.

### Delivery

- Default profile: **uplifting**, **75%**, **0.9×**, voice `af_heart`.
- Scripture: **reverent**, 900 ms silence following the verse.
- Explanation: **uplifting**, 500 ms following explanation.
- Prayer: **warm**, 800 ms following prayer.
- Intense prayer segments: **powerful**, 450 ms between sentences and 800 ms after final segment.
- Morning prayer segments: **uplifting**, 450 ms between sentences and 800 ms after final segment.

The audio composer creates real PCM silence. Tags are **metadata**, never embedded in the text sent to Kokoro. Kokoro **does not** express 75% emotional intensity natively.

## Required workflow guardrails

1. Before rendering, confirm the existing verse sheet supplies exact scripture text and reference; this adapter never generates or verifies scripture.
2. Ensure `verseText` is unchanged from the source sheet and is the **first** video scene for evening verses.
3. The adapter returns `narrationValidation.manualPreviewRequired = true` and `readyToPublish = false`; put a human approval gate before every publish node in the *staging copy*.
4. In the first test, run only through the existing **Download MP4** node. Do not execute YouTube, Instagram or Facebook publishing.
5. Review full verse audio, emphasis, pauses, caption sync, and render duration; verify no special characters or spoken tags.
6. After approval, add per-platform post success IDs and preserve the existing mark-verse-used guard. Only mark a verse used once confirmed publication completes.
7. The adapter **does not itself enforce a publishing gate** if existing n8n publishing nodes are already connected after rendering; isolate or disable those nodes during preview.

### Limits and backward compatibility

- P1 creates an adapter file in GitHub; **it does not modify the running n8n workflow**.
- Existing morning/evening workflows are unaffected until manually connected to the Code node.
- The renderer supports the new P0 schema starting at PR #11. Verify Railway production is healthy before n8n test renders.
- Do not send narrator instructions as plain text, whether SSML or bracketed stage directions.
- The source text is validated for some recognizable tags; final speech should still be inspected.
- Do not publish an image/quote from this video adapter; the separately requested afternoon image flow requires its own implementation and platform-specific publishing logic.

## Test commands

```bash
npx vitest run integrations/n8n/expressive-narration.test.ts
npx tsc --project tsconfig.build.json --noEmit
```
