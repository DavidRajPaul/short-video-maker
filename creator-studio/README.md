# Grace In A Minute Creator Studio

Phase 1: local, mobile-first preview. Open `index.html` in a browser (or serve this directory with a static HTTP server). Select MP4/MOV/WebM up to 100 MB, review the original video, enter editable metadata, choose destinations and review the local request. No video leaves the browser. AI suggestions, branded rendering, authentication and live publishing are deliberately disabled.

## Run the contract tests

```sh
node --test creator-studio/publisher-contract.test.mjs
```

## Next integration (not deployed)

- GitHub Pages may host the static UI, but does not protect the UI or supply backend credentials. Put authentication, rate limits, request authorization and secrets in a dedicated Railway service. Use separate creator accounts, secure sessions and a strict allowed origin; no reusable n8n credential in the browser. A same-origin private deployment is also an option.
- Accept authenticated uploads, inspect actual file signatures and ffprobe metadata, bound size/duration, and store originals privately with expiry. Preserve audio, aspect ratio and provenance markings. Add the channel logo using FFmpeg, with preview and explicit approval. Generate optional title/caption/tags from the video using a server-side multimodal provider; permit manual entry on quota failure.
- Store processed MP4 in controlled, temporary hosting that allows the social platforms to fetch it. The backend—not browser input—must derive trusted media URL, source SHA-256 and content ID. Persist source identity across renders; never accept arbitrary user-supplied remote URLs or redirects. The contract helper checks allowed HTTPS origins but does not perform network or media verification.
- Build a separate authenticated n8n Manual Intake parent workflow, invoking internal Shared Publisher (UyXSFUjWdkjuqK1p) one platform at a time. Use `validateOnly` first. Check the live generic-content contract and ledger rules before enabling public modes. Explicit approval must come from an authenticated, server-side job transition. Never use this helper as a security boundary.
- Store a durable job and per-platform receipts (including uncertain states); reconcile remotely before retrying a claimed/uncertain upload. Prevent double-submit; retries target only reconciled failed platforms. No public upload during tests.
- Deploy to a separate service and test an unpublished video before enabling live posts. Do not modify or deactivate scheduled workflows. The older main workflow's own publishing nodes remain independent according to existing documentation.

No credentials, public webhook or actual publishing are included in this phase.
