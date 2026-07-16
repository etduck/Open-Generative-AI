// Helpers to build unified ProviderResult objects (see types.js).

/**
 * @param {Object} fields
 * @returns {import('./types.js').ProviderResult}
 */
export function makeResult({
    provider,
    model,
    capability,
    status = 'completed',
    requestId = null,
    url = null,
    outputs = [],
    text = null,
    usage = null,
    raw = null,
    error = null,
}) {
    const allOutputs = outputs.length > 0 ? outputs : (url ? [url] : []);
    return {
        provider,
        model,
        capability,
        status,
        requestId,
        url: url || allOutputs[0] || null,
        outputs: allOutputs,
        text,
        usage,
        raw,
        error,
    };
}
