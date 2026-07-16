// MuAPI adapter — wraps the existing, battle-tested client in ../../muapi.js
// behind the unified adapter interface. MuAPI behavior is unchanged: same
// endpoints, same x-api-key auth, same polling. This wrapper only translates
// its results into the unified ProviderResult shape.

import {
    generateImage as muGenerateImage,
    generateI2I as muGenerateI2I,
    generateVideo as muGenerateVideo,
    generateI2V as muGenerateI2V,
    uploadFile as muUploadFile,
    getUserBalance,
} from '../../muapi.js';
import { normalizeError } from '../errors.js';
import { makeResult } from '../normalize.js';

const PROVIDER = 'muapi';

function toResult(model, capability, raw) {
    return makeResult({
        provider: PROVIDER,
        model: model?.id || raw?.model || null,
        capability,
        requestId: raw?.request_id || raw?.id || null,
        url: raw?.url || null,
        outputs: Array.isArray(raw?.outputs) ? raw.outputs : [],
        raw,
    });
}

export async function generateImage(apiKey, model, params) {
    try {
        const raw = await muGenerateImage(apiKey, params);
        return toResult(model, 'imageGeneration', raw);
    } catch (err) {
        throw normalizeError(PROVIDER, err);
    }
}

export async function generateI2I(apiKey, model, params) {
    try {
        const raw = await muGenerateI2I(apiKey, params);
        return toResult(model, 'imageEditing', raw);
    } catch (err) {
        throw normalizeError(PROVIDER, err);
    }
}

export async function generateVideo(apiKey, model, params) {
    try {
        const raw = await muGenerateVideo(apiKey, params);
        return toResult(model, 'videoGeneration', raw);
    } catch (err) {
        throw normalizeError(PROVIDER, err);
    }
}

export async function generateI2V(apiKey, model, params) {
    try {
        const raw = await muGenerateI2V(apiKey, params);
        return toResult(model, 'imageToVideo', raw);
    } catch (err) {
        throw normalizeError(PROVIDER, err);
    }
}

export async function uploadFile(apiKey, file, onProgress) {
    return muUploadFile(apiKey, file, onProgress);
}

/** Low-cost connection test via the existing account balance endpoint. */
export async function testConnection(apiKey) {
    const startedAt = Date.now();
    const checkedAt = new Date().toISOString();
    try {
        const data = await getUserBalance(apiKey);
        return {
            ok: true,
            provider: PROVIDER,
            message: data?.balance !== undefined ? `Connected — balance $${data.balance}` : 'Connected',
            latency: Date.now() - startedAt,
            checkedAt,
        };
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
