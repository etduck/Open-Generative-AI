// Normalized provider errors. Every adapter throws ProviderError so UI code
// can rely on one shape regardless of the upstream vendor.
//
// SECURITY: messages are sanitized — API keys, bearer tokens and long opaque
// secrets are stripped before they can reach the console, toasts or logs.

const SECRET_PATTERNS = [
    /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
    /sk-[A-Za-z0-9_-]{8,}/g,
    /(["']?(?:api[_-]?key|authorization|x-api-key)["']?\s*[:=]\s*)["']?[^"',\s}]{6,}["']?/gi,
];

export function sanitizeMessage(message) {
    let out = String(message == null ? 'Unknown error' : message);
    for (const pattern of SECRET_PATTERNS) {
        out = out.replace(pattern, (m, prefix) => (prefix ? `${prefix}***` : '***'));
    }
    return out.slice(0, 500);
}

export class ProviderError extends Error {
    /**
     * @param {Object} shape
     * @param {string} shape.provider
     * @param {string} shape.code       'auth' | 'quota' | 'rate_limit' | 'invalid_request' | 'not_found' | 'timeout' | 'upstream' | 'network' | 'config' | 'unknown'
     * @param {string} shape.message
     * @param {number|null} [shape.statusCode]
     * @param {boolean} [shape.retryable]
     * @param {string|null} [shape.rawType]
     */
    constructor({ provider, code, message, statusCode = null, retryable = false, rawType = null }) {
        super(sanitizeMessage(message));
        this.name = 'ProviderError';
        this.provider = provider;
        this.code = code;
        this.statusCode = statusCode;
        this.retryable = retryable;
        this.rawType = rawType;
    }

    /** Plain-object form matching the unified error structure. */
    toShape() {
        return {
            provider: this.provider,
            code: this.code,
            message: this.message,
            statusCode: this.statusCode,
            retryable: this.retryable,
            rawType: this.rawType,
        };
    }
}

const STATUS_TO_CODE = {
    400: 'invalid_request',
    401: 'auth',
    402: 'quota',
    403: 'auth',
    404: 'not_found',
    408: 'timeout',
    413: 'invalid_request',
    415: 'invalid_request',
    422: 'invalid_request',
    429: 'rate_limit',
};

export function codeForStatus(statusCode) {
    if (!statusCode) return 'unknown';
    if (STATUS_TO_CODE[statusCode]) return STATUS_TO_CODE[statusCode];
    if (statusCode >= 500) return 'upstream';
    return 'unknown';
}

export function isRetryableStatus(statusCode) {
    return statusCode === 408 || statusCode === 429 || (statusCode >= 500 && statusCode <= 599);
}

/**
 * Wrap an arbitrary thrown value into a ProviderError.
 * @param {string} provider
 * @param {*} err
 * @param {{statusCode?: number, code?: string, rawType?: string}} [extra]
 */
export function normalizeError(provider, err, extra = {}) {
    if (err instanceof ProviderError) return err;
    const statusCode = extra.statusCode ?? err?.statusCode ?? null;
    const isAbort = err?.name === 'AbortError';
    const isNetwork = err instanceof TypeError && /fetch|network/i.test(String(err.message));
    return new ProviderError({
        provider,
        code: extra.code
            || (isAbort ? 'timeout' : isNetwork ? 'network' : codeForStatus(statusCode)),
        message: err?.message || String(err),
        statusCode,
        retryable: extra.code === 'rate_limit' || isNetwork || isRetryableStatus(statusCode),
        rawType: extra.rawType ?? null,
    });
}

/**
 * Build a ProviderError from an HTTP response + response text.
 */
export function errorFromResponse(provider, response, bodyText, rawType = null) {
    return new ProviderError({
        provider,
        code: codeForStatus(response.status),
        message: `${response.status} ${response.statusText || ''} — ${sanitizeMessage(bodyText).slice(0, 200)}`,
        statusCode: response.status,
        retryable: isRetryableStatus(response.status),
        rawType,
    });
}
