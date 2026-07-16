import { createProviderProxy } from '../../_lib/providerProxy.js';

// Allowlisted proxy for Agnes AI (https://apihub.agnes-ai.com).
// The Base URL is fixed in code per Agnes' official docs — users cannot point
// the client at arbitrary hosts. Agnes keys arrive as
// `Authorization: Bearer …` and are forwarded ONLY to apihub.agnes-ai.com.
// Chat completions stream (SSE) straight through.

export const dynamic = 'force-dynamic';

const { GET, POST } = createProviderProxy({
    provider: 'agnes',
    upstreamBase: 'https://apihub.agnes-ai.com',
    allowedRoutes: [
        { method: 'POST', pattern: /^v1\/chat\/completions$/ },
        { method: 'POST', pattern: /^v1\/images\/generations$/ },
        { method: 'POST', pattern: /^v1\/videos$/ },
        { method: 'GET', pattern: /^v1\/videos\/[A-Za-z0-9._-]+$/ },
    ],
    maxBodyBytes: 26 * 1024 * 1024, // multimodal data-URI images
    timeoutMs: 360000, // Agnes image generation is synchronous (60–360s per docs)
});

export { GET, POST };
