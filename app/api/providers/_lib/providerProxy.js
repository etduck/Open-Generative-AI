import { NextResponse } from 'next/server';

// Shared, hardened proxy factory for third-party AI providers.
//
// Security posture:
//  - Fixed upstream host per provider — the browser can never choose the URL,
//    so this cannot be used as a generic forwarding proxy (SSRF-safe).
//  - Strict per-provider path allowlist (method + regex).
//  - Header whitelist: only Authorization, Content-Type and Accept are
//    forwarded upstream. Cookies, Host, Connection, Cloudflare headers and
//    any unrelated auth headers (e.g. x-api-key) are dropped.
//  - Request bodies are size-capped; upstream calls are time-limited.
//  - API keys and request bodies are never logged; upstream error text is
//    sanitized before being returned.

const SECRET_PATTERNS = [
    /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
    /sk-[A-Za-z0-9_-]{8,}/g,
];

function sanitize(text) {
    let out = String(text ?? '');
    for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, '***');
    return out.slice(0, 2000);
}

function buildUpstreamHeaders(request) {
    const headers = new Headers();
    const auth = request.headers.get('authorization');
    if (auth && /^Bearer\s+\S+$/i.test(auth)) headers.set('authorization', auth);
    const contentType = request.headers.get('content-type');
    if (contentType) headers.set('content-type', contentType);
    const accept = request.headers.get('accept');
    if (accept) headers.set('accept', accept);
    return headers;
}

/**
 * @param {Object} config
 * @param {string} config.provider       Provider id (for error payloads)
 * @param {string} config.upstreamBase   e.g. 'https://api.kie.ai' — fixed, never client-controlled
 * @param {Array<{method: string, pattern: RegExp}>} config.allowedRoutes
 * @param {number} [config.maxBodyBytes] Default 26 MB (covers base64 image uploads)
 * @param {number} [config.timeoutMs]    Default 300s (Agnes image generation is synchronous)
 */
export function createProviderProxy({ provider, upstreamBase, allowedRoutes, maxBodyBytes = 26 * 1024 * 1024, timeoutMs = 300000 }) {
    async function handle(request, { params }) {
        const slug = await params;
        const path = (slug.path || []).join('/');
        const method = request.method.toUpperCase();

        const allowed = allowedRoutes.some(
            (route) => route.method === method && route.pattern.test(path)
        );
        if (!allowed) {
            return NextResponse.json(
                { error: { provider, code: 'not_found', message: `Path not allowed: ${method} /${sanitize(path).slice(0, 100)}` } },
                { status: 404 }
            );
        }

        if (!request.headers.get('authorization')) {
            return NextResponse.json(
                { error: { provider, code: 'auth', message: 'Missing Authorization header' } },
                { status: 401 }
            );
        }

        const contentLength = Number(request.headers.get('content-length') || 0);
        if (contentLength > maxBodyBytes) {
            return NextResponse.json(
                { error: { provider, code: 'invalid_request', message: 'Request body too large' } },
                { status: 413 }
            );
        }

        const { search } = new URL(request.url);
        const targetUrl = `${upstreamBase}/${path}${search}`;
        const headers = buildUpstreamHeaders(request);

        let body;
        if (method !== 'GET' && method !== 'HEAD') {
            body = await request.arrayBuffer();
            if (body.byteLength > maxBodyBytes) {
                return NextResponse.json(
                    { error: { provider, code: 'invalid_request', message: 'Request body too large' } },
                    { status: 413 }
                );
            }
        }

        try {
            const upstream = await fetch(targetUrl, {
                method,
                headers,
                body,
                redirect: 'error',
                signal: AbortSignal.timeout(timeoutMs),
            });

            // Stream the upstream body straight through (required for SSE chat
            // streaming) with a minimal, safe header set.
            const responseHeaders = new Headers();
            const upstreamContentType = upstream.headers.get('content-type');
            if (upstreamContentType) responseHeaders.set('content-type', upstreamContentType);
            responseHeaders.set('cache-control', 'no-store');
            return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
        } catch (error) {
            const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
            return NextResponse.json(
                {
                    error: {
                        provider,
                        code: isTimeout ? 'timeout' : 'upstream',
                        message: isTimeout ? 'Upstream request timed out' : sanitize(error?.message || 'Upstream request failed').slice(0, 200),
                    },
                },
                { status: isTimeout ? 504 : 502 }
            );
        }
    }

    return { GET: handle, POST: handle };
}
