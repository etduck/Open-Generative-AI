// Multi-provider dispatch layer.
//
// The studios keep calling generateImage / generateI2I / generateVideo /
// generateI2V / uploadFile with the exact same signatures they used against
// the MuAPI client. This module looks up the selected model, resolves its
// API provider (`apiProvider`, defaulting to 'muapi'), and routes the call
// to the right adapter. Results from non-MuAPI providers are normalized to
// the same `{ ..., url }` shape the UI already consumes.
//
// Provider isolation: the `apiKey` argument (the MuAPI key prop) is ONLY ever
// passed to the MuAPI adapter. Kie and Agnes keys are read from their own
// storage slots by requireProviderKey() and never cross providers.

import {
    getModelById,
    getI2IModelById,
    getVideoModelById,
    getI2VModelById,
} from '../models.js';
import { PROVIDERS, getProvider, listProviders, resolveModelProvider, providerHasCapability, requireProviderKey, isModelAvailable, testProviderConnection } from './providerRegistry.js';
import {
    getProviderKey, setProviderKey, clearProviderKey,
    isProviderEnabled, setProviderEnabled, isProviderConfigured,
    getProviderMeta, setProviderMeta, maskKey,
} from './keys.js';
import { ProviderError, normalizeError, sanitizeMessage } from './errors.js';
import { makeResult } from './normalize.js';
import { textModels, getTextModelById } from './textModels.js';
import * as muapiClient from '../muapi.js';

// ── Generation dispatch ───────────────────────────────────────────────────────

async function dispatch({ muapiKey, model, muapiFn, adapterFn, params }) {
    const providerId = resolveModelProvider(model);
    if (providerId === 'muapi') {
        // Legacy path — untouched MuAPI client, same payloads as before.
        return muapiFn(muapiKey, params);
    }
    const provider = getProvider(providerId);
    if (!provider?.adapter?.[adapterFn]) {
        throw new ProviderError({
            provider: providerId,
            code: 'config',
            message: `${provider?.label || providerId} does not support this operation.`,
        });
    }
    const key = requireProviderKey(providerId);
    const result = await provider.adapter[adapterFn](key, model, params);
    // UI expects `.url` (and uses `.outputs`, `.id` opportunistically).
    return { ...result, id: result.requestId || undefined };
}

export async function generateImage(apiKey, params) {
    const model = getModelById(params.model);
    return dispatch({ muapiKey: apiKey, model, muapiFn: muapiClient.generateImage, adapterFn: 'generateImage', params });
}

export async function generateI2I(apiKey, params) {
    const model = getI2IModelById(params.model);
    return dispatch({ muapiKey: apiKey, model, muapiFn: muapiClient.generateI2I, adapterFn: 'generateI2I', params });
}

export async function generateVideo(apiKey, params) {
    const model = getVideoModelById(params.model);
    return dispatch({ muapiKey: apiKey, model, muapiFn: muapiClient.generateVideo, adapterFn: 'generateVideo', params });
}

export async function generateI2V(apiKey, params) {
    const model = getI2VModelById(params.model);
    return dispatch({ muapiKey: apiKey, model, muapiFn: muapiClient.generateI2V, adapterFn: 'generateI2V', params });
}

// ── File upload dispatch ──────────────────────────────────────────────────────

/** Resolve a model id across every capability list to its API provider. */
function findAnyModelProvider(modelId) {
    if (!modelId) return null;
    const model =
        getModelById(modelId) ||
        getI2IModelById(modelId) ||
        getVideoModelById(modelId) ||
        getI2VModelById(modelId);
    return model ? resolveModelProvider(model) : null;
}

const DATA_URI_MAX_BYTES = 8 * 1024 * 1024;

function fileToDataUri(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Upload a file and get back a URL usable as model input.
 *
 * The attempt order is provider-aware (pass the target model via
 * `options.modelId`): a Kie model prefers Kie's uploader, an Agnes model can
 * fall back to an inline data URI (officially supported by Agnes' image
 * endpoints) so it never depends on another provider's credit balance.
 * Every available uploader is tried in turn — a failure (e.g. MuAPI
 * "insufficient credits") falls through to the next option instead of
 * aborting the whole upload.
 *
 * @param {string|null} apiKey  MuAPI key (legacy prop; only used for MuAPI)
 * @param {File|Blob} file
 * @param {(pct: number) => void} [onProgress]
 * @param {{modelId?: string}} [options]  Target model for provider-aware routing
 */
export async function uploadFile(apiKey, file, onProgress, options = {}) {
    const target = findAnyModelProvider(options.modelId);
    const muapiAvailable = !!apiKey && isProviderEnabled('muapi');
    const kieAvailable = isProviderConfigured('kie');

    const tryMuapi = () => muapiClient.uploadFile(apiKey, file, onProgress);
    const tryKie = () => PROVIDERS.kie.adapter.uploadFile(requireProviderKey('kie'), file, onProgress);
    const tryDataUri = async () => {
        // Only images make sense inline, and only at reasonable sizes.
        if (!file.type || !file.type.startsWith('image/')) {
            throw new ProviderError({ provider: 'agnes', code: 'invalid_request', message: 'Only images can be sent inline; videos need an upload provider.' });
        }
        if (file.size > DATA_URI_MAX_BYTES) {
            throw new ProviderError({ provider: 'agnes', code: 'invalid_request', message: 'Image is too large to send inline (max 8MB). Add a MuAPI or Kie.ai key with balance for hosted uploads.' });
        }
        const uri = await fileToDataUri(file);
        if (onProgress) onProgress(100);
        return uri;
    };

    const chain = [];
    if (target === 'kie') {
        if (kieAvailable) chain.push(tryKie);
        if (muapiAvailable) chain.push(tryMuapi);
    } else if (target === 'agnes') {
        // Hosted URLs first (they work everywhere), inline data URI as the
        // provider-native fallback that needs no other account balance.
        if (muapiAvailable) chain.push(tryMuapi);
        if (kieAvailable) chain.push(tryKie);
        chain.push(tryDataUri);
    } else {
        if (muapiAvailable) chain.push(tryMuapi);
        if (kieAvailable) chain.push(tryKie);
    }

    if (chain.length === 0) {
        throw new ProviderError({
            provider: target || 'muapi',
            code: 'config',
            message: 'File uploads need a MuAPI or Kie.ai API key. Add one in Settings → API Providers.',
        });
    }

    let lastError = null;
    for (const attempt of chain) {
        try {
            return await attempt();
        } catch (err) {
            lastError = err;
        }
    }
    throw normalizeError(target || 'muapi', lastError);
}

// ── Text / chat ───────────────────────────────────────────────────────────────

/**
 * Chat completion routed by text model id.
 * @param {Object} options — { model, messages, stream, onDelta, signal, temperature, maxTokens }
 */
export async function chatCompletion(options) {
    const model = getTextModelById(options.model);
    if (!model) {
        throw new ProviderError({ provider: 'agnes', code: 'invalid_request', message: `Unknown text model "${options.model}".` });
    }
    const providerId = resolveModelProvider(model);
    const provider = getProvider(providerId);
    if (!provider?.adapter?.chatCompletion) {
        throw new ProviderError({ provider: providerId, code: 'config', message: `${provider?.label || providerId} does not support chat completions.` });
    }
    const key = requireProviderKey(providerId);
    return provider.adapter.chatCompletion(key, { ...options, model: model.providerModelId });
}

// ── Re-exports ────────────────────────────────────────────────────────────────

export {
    PROVIDERS,
    getProvider,
    listProviders,
    resolveModelProvider,
    providerHasCapability,
    isModelAvailable,
    testProviderConnection,
    getProviderKey,
    setProviderKey,
    clearProviderKey,
    isProviderEnabled,
    setProviderEnabled,
    isProviderConfigured,
    getProviderMeta,
    setProviderMeta,
    maskKey,
    ProviderError,
    normalizeError,
    sanitizeMessage,
    makeResult,
    textModels,
    getTextModelById,
};
