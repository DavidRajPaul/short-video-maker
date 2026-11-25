# Grace In A Minute Creator Studio

Phase 2 source implementation. Not deployed or live-tested. A same-origin Railway service is recommended instead of a public GitHub Pages login; the static HTML remains usable for local previews. This avoids browser-visible API keys and cross-origin authentication issues.

## Deployment (isolated from renderer)
Build from repository root using creator-studio/Dockerfile. Mount a persistent volume at STUDIO_DATA_DIR (/app/studio-data). Run a single instance. Set STUDIO_ORIGIN to the exact HTTPS service origin. Set separate STUDIO_CREATOR_PASSWORD and STUDIO_JANET_PASSWORD (16+ characters, generated securely, do not commit). Basic authentication is only for use over HTTPS. Both users own their respective jobs. Configure disk monitoring and retention before public rollout; media is stored privately on the volume until public publishing is approved. No automated expiry yet.

Optional GEMINI_API_KEY and STUDIO_GEMINI_MODEL enable multimodal analysis on prepared MP4 files up to 15 MB. User can decline AI analysis and enter text manually; provider failures leave preparation usable. FFmpeg normalizes to 720x1280, retains audio, and adds the logo in a separate top band when requested, preserving original visible attribution.

## Publishing integration (disabled by default)
Create a dedicated n8n HTTP Header Auth credential named for Creator Studio, with header x-studio-key and a random 32+ character secret. Use the same secret in STUDIO_N8N_SECRET on the server. Generate the bridge workflow with STUDIO_N8N_HEADER_CREDENTIAL_ID and STUDIO_N8N_HEADER_CREDENTIAL_NAME set, using node creator-studio/n8n-bridge.mjs. Alternatively STUDIO_CREATE_DRAFT=true and N8N_API_KEY create an inactive workflow through the API. The script never activates it or changes existing workflows.

After verifying authentication, validate-only handshake, live media accessibility, and response schema, publish the intake workflow. Set STUDIO_N8N_WEBHOOK to https://meetdavidraj7.n8n-wsk.com/webhook/grace-creator-studio-v1, IMAGEKIT_PRIVATE_KEY to the server-side media credential, and only then STUDIO_ENABLE_PUBLISH=true. Current shared publisher accepts ImageKit MP4s; the backend verifies actual downloaded bytes before invoking it. If ImageKit returns 403, fail closed, not a blind retry. A Railway URL fallback needs a separately reviewed shared-publisher change and is not included.

The bridge calls the existing Shared Publisher independently per destination. A stable content ID is derived from the original media SHA-256. The backend persists claims and confirmed URLs; unknown receipts remain uncertain and require reconciliation. Automatic retry, retention and cross-device draft metadata persistence are future work. The server currently marks processing interrupted after a restart, not automatically retried. No test should publish publicly without explicit user approval.

## Tests
node --check creator-studio/server.mjs
node --test creator-studio/*.test.mjs

Do not modify existing scheduled content workflows. Never commit credentials. Before go-live, verify live auth, browser behavior, large files, FFmpeg output, Gemini availability, persistent volume, archive download, webhook and receipt handling. No production workflow, deployment or actual publication is included in this PR.
