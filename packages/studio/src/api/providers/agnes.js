// Agnes AI adapter — https://agnes-ai.com/zh-Hans/docs/overview
//
// Verified against the official docs (wiki.agnes-ai.com, July 2026):
//   Base URL:   https://apihub.agnes-ai.com/v1
//   Auth:       Authorization: Bearer <AGNES_API_KEY>
//   Text:       POST /v1/chat/completions        model 'agnes-2.0-flash'
//               OpenAI-compatible; streaming via "stream": true (SSE);
//               multimodal user content supports {type:'image_url'} parts.
//   Images:     POST /v1/images/generations      models 'agnes-image-2.0-flash',
//               'agnes-image-2.1-flash'. Synchronous. 2.1 uses size tiers
//               ('1K'…'4K') + `ratio`; image-to-image via extra_body.image
//               (public URLs or data URIs) with extra_body.response_format.
//   Video:      POST /v1/videos                  model 'agnes-video-v2.0'
//               (async; prompt, optional `image` URL for image-to-video)
//               Poll: GET /v1/videos/<task_id> → status queued|in_progress|
//               completed|failed; output in `url`.
//
// The official docs do not describe a /v1/models listing endpoint, so the
// connection test uses a minimal 1-token chat completion instead.
//
// In an http(s) browser all calls go through the Next.js allowlisted proxy at
// /api/providers/agnes; SSR/Electron call upstream directly.

import { ProviderError, errorFromResponse, normalizeError, sanitizeMessage } from '../errors.js';
import { makeResult } from '../normalize.js';

export const AGNES_UPSTREAM = 'https://apihub.agnes-ai.com';

const PROVIDER = 'agnes';
const TEST_MODEL = 'agnes-2.0-flash';

function baseUrl() {
    return (typeof window !== 'undefined' && window.location?.protocol?.startsWith('http'))
        ? '/api/providers/agnes'
        : AGNES_UPSTREAM;
}

function authHeaders(apiKey) {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
    };
}

async function readJson(response) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch {
        throw new ProviderError({
            provider: PROVIDER,
            code: 'upstream',
            message: `Unexpected non-JSON response (${response.status}): ${sanitizeMessage(text).slice(0, 120)}`,
            statusCode: response.status,
        });
    }
}

// ── Text / chat completions ───────────────────────────────────────────────────

/**
 * OpenAI-style chat completion.
 *
 * @param {string} apiKey
 * @param {Object} options
 * @param {string} options.model            Agnes model id (e.g. 'agnes-2.0-flash')
 * @param {Array}  options.messages         [{role, content}] — content may be a
 *                                          string or multimodal content parts
 * @param {boolean} [options.stream]        Stream deltas via onDelta
 * @param {(text: string) => void} [options.onDelta]
 * @param {AbortSignal} [options.signal]    Cancels the request / stream
 * @param {number} [options.temperature]
 * @param {number} [options.maxTokens]
 * @returns {Promise<import('../types.js').ProviderResult>}
 */
export async function chatCompletion(apiKey, { model, messages, stream = false, onDelta, signal, temperature, maxTokens }) {
    const body = { model, messages };
    if (temperature !== undefined) body.temperature = temperature;
    if (maxTokens !== undefined) body.max_tokens = maxTokens;
    if (stream) body.stream = true;

    let response;
    try {
        response = await fetch(`${baseUrl()}/v1/chat/completions`, {
            method: 'POST',
            headers: authHeaders(apiKey),
            body: JSON.stringify(body),
            signal,
        });
    } catch (err) {
        throw normalizeError(PROVIDER, err);
    }
    if (!response.ok) {
        throw errorFromResponse(PROVIDER, response, await response.text());
    }

    if (!stream) {
        const data = await readJson(response);
        const text = data.choices?.[0]?.message?.content ?? '';
        return makeResult({
            provider: PROVIDER,
            model,
            capability: 'text',
            requestId: data.id || null,
            text,
            usage: data.usage || null,
            raw: { id: data.id, model: data.model, finish_reason: data.choices?.[0]?.finish_reason },
        });
    }

    // SSE stream: lines of "data: {json}" terminated by "data: [DONE]".
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let usage = null;
    let requestId = null;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // keep incomplete tail
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                const payload = trimmed.slice(5).trim();
                if (payload === '[DONE]') continue;
                let chunk;
                try {
                    chunk = JSON.parse(payload);
                } catch {
                    continue;
                }
                requestId = requestId || chunk.id || null;
                if (chunk.usage) usage = chunk.usage;
                const delta = chunk.choices?.[0]?.delta?.content;
                if (delta) {
                    fullText += delta;
                    if (onDelta) onDelta(delta);
                }
            }
        }
    } catch (err) {
        if (err?.name === 'AbortError') {
            // Cancellation is a valid outcome — return what we have so far.
            return makeResult({
                provider: PROVIDER, model, capability: 'text',
                requestId, text: fullText, usage, raw: { cancelled: true },
            });
        }
        throw normalizeError(PROVIDER, err);
    }
    return makeResult({
        provider: PROVIDER, model, capability: 'text',
        requestId, text: fullText, usage, raw: null,
    });
}

// ── Images (synchronous) ──────────────────────────────────────────────────────

// Agnes Image 2.1 Flash uses size tiers + ratio; 2.0 Flash uses pixel sizes.
const RATIO_TO_PIXELS = {
    '1:1': '1024x1024',
    '3:4': '768x1024',
    '4:3': '1024x768',
    '16:9': '1280x720',
    '9:16': '720x1280',
    '2:3': '768x1152',
    '3:2': '1152x768',
    '21:9': '1344x576',
};

function buildImagePayload(model, params) {
    const payload = {
        model: model.providerModelId,
        prompt: params.prompt || '',
    };
    const sizeMode = model.providerConfig?.sizeMode || 'tier';
    if (sizeMode === 'tier') {
        payload.size = params.quality || params.resolution || '1K';
        if (params.aspect_ratio) payload.ratio = params.aspect_ratio;
    } else {
        payload.size = RATIO_TO_PIXELS[params.aspect_ratio] || '1024x1024';
    }
    const imageUrls = params.images_list?.length > 0
        ? params.images_list
        : (params.image_url ? [params.image_url] : []);
    if (imageUrls.length > 0) {
        payload.extra_body = {
            image: imageUrls,
            response_format: 'url',
        };
    }
    return payload;
}

async function requestImage(apiKey, model, params, capability) {
    const payload = buildImagePayload(model, params);
    let response;
    try {
        response = await fetch(`${baseUrl()}/v1/images/generations`, {
            method: 'POST',
            headers: authHeaders(apiKey),
            body: JSON.stringify(payload),
        });
    } catch (err) {
        throw normalizeError(PROVIDER, err);
    }
    if (!response.ok) {
        throw errorFromResponse(PROVIDER, response, await response.text());
    }
    const data = await readJson(response);
    const outputs = (data.data || [])
        .map((item) => item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : null))
        .filter(Boolean);
    if (outputs.length === 0) {
        throw new ProviderError({ provider: PROVIDER, code: 'upstream', message: 'Agnes AI returned no image output.' });
    }
    return makeResult({
        provider: PROVIDER,
        model: model.id,
        capability,
        outputs,
        raw: { created: data.created },
    });
}

/** Text-to-image (verified models: agnes-image-2.0-flash / agnes-image-2.1-flash). */
export async function generateImage(apiKey, model, params) {
    return requestImage(apiKey, model, params, 'imageGeneration');
}

/** Image editing via extra_body.image (officially documented image-to-image). */
export async function generateI2I(apiKey, model, params) {
    const hasImage = params.images_list?.length > 0 || params.image_url;
    if (!hasImage) {
        throw new ProviderError({ provider: PROVIDER, code: 'invalid_request', message: 'An input image is required for image editing.' });
    }
    return requestImage(apiKey, model, params, 'imageEditing');
}

// ── Video (asynchronous) ──────────────────────────────────────────────────────

async function pollVideo(apiKey, taskId, { maxAttempts = 450, interval = 4000 } = {}) {
    const url = `${baseUrl()}/v1/videos/${encodeURIComponent(taskId)}`;
    let consecutiveErrors = 0;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, interval));
        let response;
        try {
            response = await fetch(url, { headers: authHeaders(apiKey) });
        } catch (err) {
            if (++consecutiveErrors > 5) throw normalizeError(PROVIDER, err);
            continue;
        }
        if (!response.ok) {
            if (response.status >= 500 && ++consecutiveErrors <= 5) continue;
            throw errorFromResponse(PROVIDER, response, await response.text());
        }
        consecutiveErrors = 0;
        const data = await readJson(response);
        const status = String(data.status || '').toLowerCase();
        if (status === 'completed') return data;
        if (status === 'failed') {
            throw new ProviderError({
                provider: PROVIDER,
                code: 'upstream',
                message: `Agnes AI video generation failed: ${sanitizeMessage(typeof data.error === 'string' ? data.error : JSON.stringify(data.error || 'unknown error'))}`,
            });
        }
        // queued | in_progress → keep polling
    }
    throw new ProviderError({
        provider: PROVIDER,
        code: 'timeout',
        message: 'Agnes AI video generation timed out while polling for the result.',
        retryable: true,
    });
}

async function requestVideo(apiKey, model, params, capability) {
    const payload = {
        model: model.providerModelId,
        prompt: params.prompt || '',
    };
    const imageUrl = params.image_url || params.images_list?.[0];
    if (imageUrl) payload.image = imageUrl;
    if (model.providerConfig?.num_frames) payload.num_frames = model.providerConfig.num_frames;
    if (model.providerConfig?.frame_rate) payload.frame_rate = model.providerConfig.frame_rate;

    let response;
    try {
        response = await fetch(`${baseUrl()}/v1/videos`, {
            method: 'POST',
            headers: authHeaders(apiKey),
            body: JSON.stringify(payload),
        });
    } catch (err) {
        throw normalizeError(PROVIDER, err);
    }
    if (!response.ok) {
        throw errorFromResponse(PROVIDER, response, await response.text());
    }
    const created = await readJson(response);
    const taskId = created.task_id || created.id;
    if (!taskId) {
        throw new ProviderError({ provider: PROVIDER, code: 'upstream', message: 'Agnes AI video task returned no task id.' });
    }
    if (params.onRequestId) params.onRequestId(taskId);
    const result = await pollVideo(apiKey, taskId);
    if (!result.url) {
        throw new ProviderError({ provider: PROVIDER, code: 'upstream', message: 'Agnes AI video completed but returned no URL.' });
    }
    return makeResult({
        provider: PROVIDER,
        model: model.id,
        capability,
        requestId: taskId,
        url: result.url,
        raw: { status: result.status, seconds: result.seconds, size: result.size },
    });
}

/** Text-to-video (verified model: agnes-video-v2.0, async). */
export async function generateVideo(apiKey, model, params) {
    return requestVideo(apiKey, model, params, 'videoGeneration');
}

/** Image-to-video via the documented `image` parameter of /v1/videos. */
export async function generateI2V(apiKey, model, params) {
    const hasImage = params.image_url || params.images_list?.length > 0;
    if (!hasImage) {
        throw new ProviderError({ provider: PROVIDER, code: 'invalid_request', message: 'An input image is required for image-to-video.' });
    }
    return requestVideo(apiKey, model, params, 'imageToVideo');
}

// ── Connection test ───────────────────────────────────────────────────────────

/**
 * Minimal-cost connection test: a 1-token chat completion.
 * (The official docs do not document a /v1/models listing endpoint.)
 */
export async function testConnection(apiKey) {
    const startedAt = Date.now();
    const checkedAt = new Date().toISOString();
    try {
        const response = await fetch(`${baseUrl()}/v1/chat/completions`, {
            method: 'POST',
            headers: authHeaders(apiKey),
            body: JSON.stringify({
                model: TEST_MODEL,
                messages: [{ role: 'user', content: 'ping' }],
                max_tokens: 1,
            }),
        });
        const latency = Date.now() - startedAt;
        if (!response.ok) {
            const err = errorFromResponse(PROVIDER, response, await response.text());
            return { ok: false, provider: PROVIDER, message: err.message, latency, checkedAt };
        }
        await readJson(response);
        return { ok: true, provider: PROVIDER, message: `Connected — ${TEST_MODEL} responded`, latency, checkedAt };
    } catch (err) {
        return {
            ok: false,
            provider: PROVIDER,
            message: normalizeError(PROVIDER, err).message,
            latency: Date.now() - startedAt,
            checkedAt,
        };
    }
}
