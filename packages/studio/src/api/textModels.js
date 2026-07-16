// Text / chat model definitions for the Text Studio.
//
// `id` is the stable internal mufa.ai id; `providerModelId` is the vendor's
// official model id. Only models verified against official docs are listed.

export const textModels = [
    {
        id: 'agnes-2.0-flash',
        name: 'Agnes 2.0 Flash',
        apiProvider: 'agnes',
        providerModelId: 'agnes-2.0-flash',
        provider: 'agnes',
        provider_name: 'Agnes AI',
        capability: 'text',
        capabilities: {
            streaming: true,
            systemPrompt: true,
            multimodal: true, // image_url content parts, public URLs
            tools: true,
        },
        contextWindow: 524288,
        maxOutputTokens: 65536,
        enabled: true,
    },
];

export const getTextModelById = (id) => textModels.find((m) => m.id === id);
