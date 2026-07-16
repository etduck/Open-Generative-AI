# Multi-Provider Architecture (MuAPI · Kie.ai · Agnes AI)

mufa.ai supports three AI API providers behind a unified adapter layer. This
document describes the architecture, connected models, capability boundaries,
key handling, and how to add another provider.

## Provider capability boundaries

| Capability | MuAPI | Kie.ai | Agnes AI |
|---|---|---|---|
| Text chat (Text Studio) | — | — | ✅ (streaming) |
| Text-to-image | ✅ (200+ models) | ✅ | ✅ |
| Image editing / image-to-image | ✅ | ✅ | ✅ |
| Text-to-video | ✅ | ✅ | ✅ |
| Image-to-video | ✅ | ✅ | ✅ |
| Audio / lip sync / recast / clipping | ✅ | — | — |
| Workflows | ✅ (exclusive) | — | — |
| Agents / Design Agent | ✅ (exclusive) | — | — |
| Templates & community content | ✅ (exclusive) | — | — |
| Balance display in header | ✅ | credits via test | — |
| File upload service | ✅ | ✅ (base64, 3-day retention) | — |

**MuAPI-exclusive features** (Workflows, Agents, Design Agent, MuAPI templates,
community content, header balance) always use the MuAPI key and are not
abstracted over other providers.

## Connected models

### MuAPI
All pre-existing models remain unchanged (same endpoints, same `x-api-key`
auth, same polling via `/api/v1/predictions/{id}/result`).

### Kie.ai (base URL `https://api.kie.ai`, auth `Authorization: Bearer`)
All Kie models use the unified Jobs API:
`POST /api/v1/jobs/createTask` → `GET /api/v1/jobs/recordInfo?taskId=…`
(states: `waiting/queuing/generating/success/fail`; outputs in
`resultJson.resultUrls`).

| Internal id | Official model id | Capability |
|---|---|---|
| `kie-nano-banana` | `google/nano-banana` | Text-to-image |
| `kie-nano-banana-edit` | `google/nano-banana-edit` | Image editing (up to 10 input images) |
| `kie-kling-2.6-t2v` | `kling-2.6/text-to-video` | Text-to-video (5/10s, sound off) |
| `kie-kling-2.6-i2v` | `kling-2.6/image-to-video` | Image-to-video (5/10s) |

Connection test: `GET /api/v1/chat/credit` (remaining credits).
File upload: `POST /api/file-base64-upload` (≤10MB, used as fallback when no
MuAPI key is configured).

### Agnes AI (base URL `https://apihub.agnes-ai.com/v1`, auth `Authorization: Bearer`)
The base URL is **fixed in code** — users cannot enter a custom base URL.

| Internal id | Official model id | Capability | Endpoint |
|---|---|---|---|
| `agnes-2.0-flash` (Text Studio) | `agnes-2.0-flash` | Chat (streaming, system prompt, multimodal) | `POST /v1/chat/completions` |
| `agnes-image-2.1-flash` | `agnes-image-2.1-flash` | Text-to-image (size tiers 1K–4K + ratio) | `POST /v1/images/generations` (synchronous) |
| `agnes-image-2.1-flash-edit` | `agnes-image-2.1-flash` | Image editing via `extra_body.image` | `POST /v1/images/generations` (synchronous) |
| `agnes-video-v2.0` | `agnes-video-v2.0` | Text-to-video (async) | `POST /v1/videos` → poll `GET /v1/videos/{task_id}` |
| `agnes-video-v2.0-i2v` | `agnes-video-v2.0` | Image-to-video via `image` param (async) | same as above |

Video task states: `queued / in_progress / completed / failed`; output in `url`.

Connection test: 1-token chat completion against `agnes-2.0-flash`
(the official docs do not document a `/v1/models` listing endpoint).

## Architecture

```text
packages/studio/src/api/
├── index.js             # dispatch layer — same call signatures the studios always used
├── types.js             # unified result/error/test typedefs
├── errors.js            # ProviderError + sanitization (keys never leak into messages)
├── normalize.js         # makeResult() → { provider, model, capability, status,
│                        #   requestId, url, outputs, text, usage, raw, error }
├── keys.js              # per-provider key storage (localStorage, phase 1)
├── textModels.js        # Text Studio model definitions
├── providerRegistry.js  # provider metadata + capability flags + adapter lookup
└── providers/
    ├── muapi.js         # wraps the untouched legacy client in ../muapi.js
    ├── kie.js           # Kie Jobs API adapter (create/poll/upload/test)
    └── agnes.js         # Agnes OpenAI-style adapter (chat/images/videos/test)

app/api/providers/
├── _lib/providerProxy.js       # hardened shared proxy factory
├── kie/[[...path]]/route.js    # allowlist → https://api.kie.ai only
└── agnes/[[...path]]/route.js  # allowlist → https://apihub.agnes-ai.com only
```

Routing: every model definition may carry `apiProvider` (`'muapi' | 'kie' |
'agnes'`, default `'muapi'`) and `providerModelId` (the vendor's official
model id). `packages/studio/src/api/index.js` resolves the provider from the
selected model and calls the matching adapter — UI components never branch on
provider ids, endpoints, or auth headers. The internal `id` is the stable
mufa.ai identifier; the same underlying model can exist once per provider.

> Note: the pre-existing `provider` field on model definitions names the model
> *creator* (Google, Kling…) for logos/filtering in the picker — the routing
> field is `apiProvider`.

## Key storage & isolation (phase 1)

- Keys are entered in **Settings → API Providers** and stored in browser
  `localStorage` under separate slots:
  `muapi_key` (legacy name, fully backward compatible), `kie_api_key`,
  `agnes_api_key`.
- Each adapter reads only its own key: the MuAPI key is only sent as
  `x-api-key` to MuAPI endpoints; Kie and Agnes keys are only sent as
  `Authorization: Bearer` through their own fixed-host proxies. There is no
  code path that passes one provider's key to another.
- Per-provider enable/disable flags (`<id>_provider_enabled`) and non-secret
  test metadata (`<id>_provider_meta`) live alongside the keys.
- Deleting one key never touches the other providers.

### Security limitations of browser-stored keys
Anyone with access to the browser profile (or any XSS) can read localStorage.
This is acceptable only for the current personal-test phase — use scoped or
low-balance keys. **Never commit API keys to Git**, config files, screenshots
or logs; `.env.example` contains placeholders only.

### Phase 2: moving keys server-side
`packages/studio/src/api/keys.js` is the single credential source for
adapters and UI. To migrate:
1. Put real keys in server env vars (`MUAPI_API_KEY`, `KIE_API_KEY`,
   `AGNES_API_KEY` — see `.env.example`).
2. In `app/api/providers/*/route.js`, inject `Authorization: Bearer
   ${process.env.…}` server-side instead of forwarding the client header.
3. Replace `keys.js` getters with a "server-managed" sentinel so the settings
   UI shows the provider as connected without exposing a key.
Adapters and studios need no changes.

## Server proxy security

- Browsers cannot choose upstream URLs — each proxy has a fixed host and a
  strict method+path allowlist (no generic URL forwarder, SSRF-safe).
- Only `Authorization`, `Content-Type` and `Accept` are forwarded; cookies,
  `Host`, `Connection`, Cloudflare headers and `x-api-key` are dropped.
- Bodies are size-capped (26MB), upstream calls are time-limited, redirects
  are refused, and error text is sanitized (bearer tokens stripped) before
  being returned. Keys and request bodies are never logged.
- Existing CSP / X-Frame-Options / Referrer-Policy middleware is unchanged;
  all provider traffic flows through same-origin `/api/providers/*`.

## Adding a fourth provider

1. Research the official API (endpoints, auth, task lifecycle, output shape).
2. Create `packages/studio/src/api/providers/<id>.js` implementing the
   capabilities you verified (`generateImage`, `generateI2I`, `generateVideo`,
   `generateI2V`, `chatCompletion`, `uploadFile`, `testConnection` — only the
   ones that exist officially).
3. Register it in `providerRegistry.js` with honest capability flags and a
   key storage slot in `keys.js`.
4. Add an allowlisted proxy at `app/api/providers/<id>/[[...path]]/route.js`
   with the provider's fixed official host.
5. Add model definitions with `apiProvider: '<id>'` + `providerModelId` to
   `models.js` (or `textModels.js` for chat models).
6. The settings UI, model pickers, and dispatch layer pick it up
   automatically.

## Setting up keys on mufa.ai

1. Open `https://mufa.ai/studio` → **Settings** (top right) → **API Providers**.
2. Paste each provider's key into its own card and press **Save**:
   - MuAPI key from https://muapi.ai/access-keys
   - Kie.ai key from https://kie.ai/api-key
   - Agnes AI key from https://agnes-ai.com (API Hub)
3. Press **Test connection** on each card — MuAPI reports balance, Kie.ai
   reports remaining credits, Agnes runs a 1-token chat ping.
4. Toggle a provider off to hide/disable its models without deleting the key.
