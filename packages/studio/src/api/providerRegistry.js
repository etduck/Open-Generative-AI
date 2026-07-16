// Provider registry — the single source of truth for which API providers
// exist, what they can do, and which adapter serves them.
//
// Capability flags reflect what is actually implemented and verified against
// each vendor's official documentation — not what the vendor might offer.

import * as muapiAdapter from './providers/muapi.js';
import * as kieAdapter from './providers/kie.js';
import * as agnesAdapter from './providers/agnes.js';
import { getProviderKey, isProviderEnabled, isProviderConfigured, setProviderMeta } from './keys.js';
import { ProviderError } from './errors.js';

export const PROVIDERS = Object.freeze({
    muapi: {
        id: 'muapi',
        label: 'MuAPI',
        authType: 'x-api-key',
        keyStorageKey: 'muapi_key',
        docsUrl: 'https://muapi.ai',
        keysUrl: 'https://muapi.ai/access-keys',
        capabilities: {
            text: false,
            textStreaming: false,
            imageGeneration: true,
            imageEditing: true,
            videoGeneration: true,
            imageToVideo: true,
            audio: true,
            workflows: true,
            agents: true,
            balance: true,
            fileUpload: true,
        },
        adapter: muapiAdapter,
    },
    kie: {
        id: 'kie',
        label: 'Kie.ai',
        authType: 'bearer',
        keyStorageKey: 'kie_api_key',
        docsUrl: 'https://docs.kie.ai',
        keysUrl: 'https://kie.ai/api-key',
        capabilities: {
            text: false,
            textStreaming: false,
            imageGeneration: true,   // google/nano-banana
            imageEditing: true,      // google/nano-banana-edit
            videoGeneration: true,   // kling-2.6/text-to-video
            imageToVideo: true,      // kling-2.6/image-to-video
            audio: false,
            workflows: false,
            agents: false,
            balance: true,           // /api/v1/chat/credit
            fileUpload: true,        // /api/file-base64-upload
        },
        adapter: kieAdapter,
    },
    agnes: {
        id: 'agnes',
        label: 'Agnes AI',
        authType: 'bearer',
        keyStorageKey: 'agnes_api_key',
        docsUrl: 'https://agnes-ai.com/zh-Hans/docs/overview',
        keysUrl: 'https://agnes-ai.com',
        capabilities: {
            text: true,              // agnes-2.0-flash via /v1/chat/completions
            textStreaming: true,
            imageGeneration: true,   // agnes-image-2.1-flash via /v1/images/generations
            imageEditing: true,      // documented image-to-image via extra_body.image
            videoGeneration: true,   // agnes-video-v2.0 via /v1/videos (async)
            imageToVideo: true,      // documented `image` param of /v1/videos
            audio: false,
            workflows: false,
            agents: false,
            balance: false,
            fileUpload: false,       // no official upload endpoint documented
        },
        adapter: agnesAdapter,
    },
});

export function getProvider(providerId) {
    return PROVIDERS[providerId] || null;
}

export function listProviders() {
    return Object.values(PROVIDERS);
}

/** The API provider that serves a model definition (defaults to MuAPI). */
export function resolveModelProvider(model) {
    return model?.apiProvider || 'muapi';
}

export function providerHasCapability(providerId, capability) {
    return !!getProvider(providerId)?.capabilities?.[capability];
}

/**
 * Ensure a non-MuAPI provider is enabled and has a key; returns the key.
 * MuAPI keeps its legacy prop-based key flow, so this is only used for
 * kie/agnes routing.
 */
export function requireProviderKey(providerId) {
    const provider = getProvider(providerId);
    if (!provider) {
        throw new ProviderError({ provider: providerId, code: 'config', message: `Unknown provider "${providerId}".` });
    }
    if (!isProviderEnabled(providerId)) {
        throw new ProviderError({
            provider: providerId,
            code: 'config',
            message: `${provider.label} is disabled. Enable it in Settings → API Providers.`,
        });
    }
    const key = getProviderKey(providerId);
    if (!key) {
        throw new ProviderError({
            provider: providerId,
            code: 'config',
            message: `No ${provider.label} API key configured. Add one in Settings → API Providers.`,
        });
    }
    return key;
}

/** Whether a model can currently generate (its provider is enabled + keyed). */
export function isModelAvailable(model, muapiKey) {
    const providerId = resolveModelProvider(model);
    if (providerId === 'muapi') return !!muapiKey && isProviderEnabled('muapi');
    return isProviderConfigured(providerId);
}

/**
 * Run a provider's connection test and persist non-secret result metadata.
 * @returns {Promise<import('./types.js').ConnectionTestResult>}
 */
export async function testProviderConnection(providerId, keyOverride = null) {
    const provider = getProvider(providerId);
    if (!provider) {
        return { ok: false, provider: providerId, message: 'Unknown provider', latency: 0, checkedAt: new Date().toISOString() };
    }
    const key = keyOverride || getProviderKey(providerId);
    if (!key) {
        return { ok: false, provider: providerId, message: 'No API key configured', latency: 0, checkedAt: new Date().toISOString() };
    }
    const result = await provider.adapter.testConnection(key);
    setProviderMeta(providerId, {
        lastTestAt: result.checkedAt,
        lastTestOk: result.ok,
        lastTestMessage: result.message,
        lastTestLatency: result.latency,
    });
    return result;
}
