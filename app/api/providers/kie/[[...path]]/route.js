import { createProviderProxy } from '../../_lib/providerProxy.js';

// Allowlisted proxy for Kie.ai (https://docs.kie.ai).
// Only the exact endpoints the Kie adapter uses are reachable; the upstream
// host is fixed and never client-controlled. Kie keys arrive as
// `Authorization: Bearer …` and are forwarded ONLY to api.kie.ai.

export const dynamic = 'force-dynamic';

const { GET, POST } = createProviderProxy({
    provider: 'kie',
    upstreamBase: 'https://api.kie.ai',
    allowedRoutes: [
        { method: 'POST', pattern: /^api\/v1\/jobs\/createTask$/ },
        { method: 'GET', pattern: /^api\/v1\/jobs\/recordInfo$/ },
        { method: 'GET', pattern: /^api\/v1\/chat\/credit$/ },
        { method: 'POST', pattern: /^api\/file-base64-upload$/ },
    ],
    // createTask/poll are quick; the 26MB default cap covers base64 uploads.
    timeoutMs: 120000,
});

export { GET, POST };
