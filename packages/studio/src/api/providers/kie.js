// Kie.ai adapter — https://docs.kie.ai
//
// Verified against the official docs (July 2026):
//   Base URL:       https://api.kie.ai
//   Auth:           Authorization: Bearer <KIE_API_KEY>
//   Create task:    POST /api/v1/jobs/createTask   { model, input }        → { code, msg, data: { taskId } }
//   Query task:     GET  /api/v1/jobs/recordInfo?taskId=…                  → data.state ∈ waiting|queuing|generating|success|fail
//                                                                            data.resultJson = '{"resultUrls":[…]}'
//   Credits:        GET  /api/v1/chat/credit                               → { code, msg, data: <number> }
//   Base64 upload:  POST /api/file-base64-upload                           → data.downloadUrl (files kept 3 days)
//
// In an http(s) browser all calls go through the Next.js allowlisted proxy at
// /api/providers/kie (CORS + key hygiene); SSR/Electron call upstream directly.

import { ProviderError, errorFromResponse, normalizeError, sanitizeMessage } from '../errors.js';
import { makeResult } from '../normalize.js';

export const KIE_UPSTREAM = 'https://api.kie.ai';

const PROVIDER = 'kie';

function baseUrl() {
    return (typeof window !== 'undefined' && window.location?.protocol?.startsWith('http'))
        ? '/api/providers/kie'
        : KIE_UPSTREAM;
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

async function createTask(apiKey, providerModelId, input) {
    let response;
    try {
        response = await fetch(`${baseUrl()}/api/v1/jobs/createTask`, {
            method: 'POST',
            headers: authHeaders(apiKey),
            body: JSON.stringify({ model: providerModelId, input }),
        });
    } catch (err) {
        throw normalizeError(PROVIDER, err);
    }
    if (!response.ok) {
        throw errorFromResponse(PROVIDER, response, await response.text());
    }
    const data = await readJson(response);
    if (data.code !== 200 || !data.data?.taskId) {
        throw new ProviderError({
            provider: PROVIDER,
            code: data.code === 401 ? 'auth' : data.code === 402 ? 'quota' : data.code === 429 ? 'rate_limit' : 'invalid_request',
            message: `Kie.ai task creation failed: ${sanitizeMessage(data.msg || 'unknown error')}`,
            statusCode: response.status,
            rawType: String(data.code),
        });
    }
    return data.data.taskId;
}

async function pollTask(apiKey, taskId, { maxAttempts = 300, interval = 3000 } = {}) {
    const url = `${baseUrl()}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`;
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
        const record = data.data || {};
        const state = String(record.state || '').toLowerCase();
        if (state === 'success') return record;
        if (state === 'fail') {
            throw new ProviderError({
                provider: PROVIDER,
                code: 'upstream',
                message: `Kie.ai generation failed: ${sanitizeMessage(record.failMsg || 'unknown error')}`,
                rawType: record.failCode ? String(record.failCode) : null,
            });
        }
        // waiting | queuing | generating → keep polling
    }
    throw new ProviderError({
        provider: PROVIDER,
        code: 'timeout',
        message: 'Kie.ai generation timed out while polling for the result.',
        retryable: true,
    });
}

function extractResultUrls(record) {
    try {
        const parsed = JSON.parse(record.resultJson || '{}');
        if (Array.isArray(parsed.resultUrls)) return parsed.resultUrls;
    } catch {
        // fall through
    }
    return [];
}

async function runJob({ apiKey, model, capability, input, maxAttempts, onRequestId }) {
    const taskId = await createTask(apiKey, model.providerModelId, input);
    if (onRequestId) onRequestId(taskId);
    const record = await pollTask(apiKey, taskId, { maxAttempts });
    const outputs = extractResultUrls(record);
    if (outputs.length === 0) {
        throw new ProviderError({
            provider: PROVIDER,
            code: 'upstream',
            message: 'Kie.ai task succeeded but returned no output URLs.',
        });
    }
    return makeResult({
        provider: PROVIDER,
        model: model.id,
        capability,
        requestId: taskId,
        outputs,
        raw: {
            taskId: record.taskId,
            model: record.model,
            state: record.state,
            costTime: record.costTime,
            creditsConsumed: record.creditsConsumed,
        },
    });
}

// ── Capability implementations ────────────────────────────────────────────────
// Input mapping from the studio's generic params to Kie's per-model `input`.

/** Text-to-image (verified model: google/nano-banana). */
export async function generateImage(apiKey, model, params) {
    const input = { prompt: params.prompt };
    if (params.aspect_ratio) input.aspect_ratio = params.aspect_ratio;
    input.output_format = model.providerConfig?.output_format || 'png';
    return runJob({ apiKey, model, capability: 'imageGeneration', input, maxAttempts: 120, onRequestId: params.onRequestId });
}

/** Image editing / image-to-image (verified model: google/nano-banana-edit). */
export async function generateI2I(apiKey, model, params) {
    const imageUrls = params.images_list?.length > 0
        ? params.images_list
        : (params.image_url ? [params.image_url] : []);
    if (imageUrls.length === 0) {
        throw new ProviderError({ provider: PROVIDER, code: 'invalid_request', message: 'An input image is required for image editing.' });
    }
    const input = {
        prompt: params.prompt || '',
        image_urls: imageUrls.slice(0, model.maxImages || 10),
    };
    if (params.aspect_ratio) input.aspect_ratio = params.aspect_ratio;
    input.output_format = model.providerConfig?.output_format || 'png';
    return runJob({ apiKey, model, capability: 'imageEditing', input, maxAttempts: 120, onRequestId: params.onRequestId });
}

/** Text-to-video (verified model: kling-2.6/text-to-video). */
export async function generateVideo(apiKey, model, params) {
    const input = {
        prompt: params.prompt,
        // `sound` is a required boolean for Kling on Kie.ai
        sound: model.providerConfig?.sound ?? false,
    };
    if (params.aspect_ratio) input.aspect_ratio = params.aspect_ratio;
    if (params.duration) input.duration = String(params.duration);
    return runJob({ apiKey, model, capability: 'videoGeneration', input, maxAttempts: 600, onRequestId: params.onRequestId });
}

/** Image-to-video (verified model: kling-2.6/image-to-video). */
export async function generateI2V(apiKey, model, params) {
    const imageUrls = params.images_list?.length > 0
        ? params.images_list
        : (params.image_url ? [params.image_url] : []);
    if (imageUrls.length === 0) {
        throw new ProviderError({ provider: PROVIDER, code: 'invalid_request', message: 'An input image is required for image-to-video.' });
    }
    const input = {
        prompt: params.prompt || '',
        image_urls: imageUrls.slice(0, 1),
        sound: model.providerConfig?.sound ?? false,
    };
    if (params.duration) input.duration = String(params.duration);
    return runJob({ apiKey, model, capability: 'imageToVideo', input, maxAttempts: 600, onRequestId: params.onRequestId });
}

// ── File upload ───────────────────────────────────────────────────────────────

/**
 * Upload a File/Blob through Kie's base64 upload endpoint.
 * Returns a public (3-day) download URL usable as image input.
 */
export async function uploadFile(apiKey, file, onProgress) {
    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
        throw new ProviderError({ provider: PROVIDER, code: 'invalid_request', message: 'Kie.ai base64 uploads are limited to 10MB per file.' });
    }
    const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file for upload'));
        reader.readAsDataURL(file);
    });
    if (onProgress) onProgress(50);
    let response;
    try {
        response = await fetch(`${baseUrl()}/api/file-base64-upload`, {
            method: 'POST',
            headers: authHeaders(apiKey),
            body: JSON.stringify({
                base64Data,
                uploadPath: 'images/user-uploads',
                fileName: file.name || undefined,
            }),
        });
    } catch (err) {
        throw normalizeError(PROVIDER, err);
    }
    if (!response.ok) {
        throw errorFromResponse(PROVIDER, response, await response.text());
    }
    const data = await readJson(response);
    const url = data.data?.downloadUrl;
    if (!url) {
        throw new ProviderError({ provider: PROVIDER, code: 'upstream', message: 'Kie.ai upload returned no download URL.' });
    }
    if (onProgress) onProgress(100);
    return url;
}

// ── Connection test ───────────────────────────────────────────────────────────

/** Low-cost connection test using the account credits endpoint. */
export async function testConnection(apiKey) {
    const startedAt = Date.now();
    const checkedAt = new Date().toISOString();
    try {
        const response = await fetch(`${baseUrl()}/api/v1/chat/credit`, { headers: authHeaders(apiKey) });
        const latency = Date.now() - startedAt;
        if (!response.ok) {
            const err = errorFromResponse(PROVIDER, response, await response.text());
            return { ok: false, provider: PROVIDER, message: err.message, latency, checkedAt };
        }
        const data = await readJson(response);
        if (data.code !== 200) {
            return { ok: false, provider: PROVIDER, message: sanitizeMessage(data.msg || `Error code ${data.code}`), latency, checkedAt };
        }
        return { ok: true, provider: PROVIDER, message: `Connected — ${data.data} credits remaining`, latency, checkedAt };
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
