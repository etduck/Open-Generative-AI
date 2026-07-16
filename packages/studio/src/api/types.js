// Shared type definitions for the multi-provider API layer.
//
// Providers are the upstream API vendors (MuAPI, Kie.ai, Agnes AI) — distinct
// from the `provider` field on model definitions, which names the model
// *creator* (Google, Kling, …) and drives logos in the model picker. The
// routing field on a model is `apiProvider` ('muapi' | 'kie' | 'agnes'),
// defaulting to 'muapi' for every pre-existing model.

/**
 * @typedef {'muapi'|'kie'|'agnes'} ProviderId
 */

/**
 * @typedef {'text'|'imageGeneration'|'imageEditing'|'videoGeneration'|'imageToVideo'} Capability
 */

/**
 * Unified generation result. Every adapter resolves to this shape.
 * @typedef {Object} ProviderResult
 * @property {ProviderId} provider
 * @property {string} model          Internal (mufa.ai) model id
 * @property {Capability} capability
 * @property {'completed'|'failed'} status
 * @property {string|null} requestId Upstream task/request id
 * @property {string|null} url       Primary output URL
 * @property {string[]} outputs      All output URLs
 * @property {string|null} text      Text output (chat models)
 * @property {Object|null} usage     Token usage (chat models)
 * @property {Object|null} raw       Raw upstream response (never contains keys)
 * @property {ProviderErrorShape|null} error
 */

/**
 * Unified error shape (also carried by ProviderError instances).
 * Must never contain API keys, Authorization headers or full request bodies.
 * @typedef {Object} ProviderErrorShape
 * @property {ProviderId} provider
 * @property {string} code           Stable machine code, e.g. 'auth', 'quota', 'timeout'
 * @property {string} message        Sanitized human-readable message
 * @property {number|null} statusCode HTTP status if available
 * @property {boolean} retryable
 * @property {string|null} rawType   Upstream error type/code as reported
 */

/**
 * Connection test result.
 * @typedef {Object} ConnectionTestResult
 * @property {boolean} ok
 * @property {ProviderId} provider
 * @property {string} message
 * @property {number} latency   Milliseconds
 * @property {string} checkedAt ISO timestamp
 */

export const CAPABILITIES = Object.freeze({
    TEXT: 'text',
    IMAGE_GENERATION: 'imageGeneration',
    IMAGE_EDITING: 'imageEditing',
    VIDEO_GENERATION: 'videoGeneration',
    IMAGE_TO_VIDEO: 'imageToVideo',
});

export const PROVIDER_IDS = Object.freeze(['muapi', 'kie', 'agnes']);
