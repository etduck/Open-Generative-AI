// Per-provider API key storage (phase 1: browser localStorage).
//
// Keys are stored under separate storage keys and are NEVER mixed between
// providers — each adapter reads only its own key. The legacy 'muapi_key'
// storage key is kept for backward compatibility with existing installs.
//
// Phase 2 note: this module is the single place the rest of the code asks for
// credentials. Moving keys server-side later means swapping this module for
// one that returns opaque session handles — adapters and UI stay unchanged.

const KEY_STORAGE = {
    muapi: 'muapi_key',       // legacy key name kept for compatibility
    kie: 'kie_api_key',
    agnes: 'agnes_api_key',
};

const ENABLED_STORAGE_SUFFIX = '_provider_enabled';
const META_STORAGE_SUFFIX = '_provider_meta';

function storageAvailable() {
    try {
        return typeof window !== 'undefined' && !!window.localStorage;
    } catch {
        return false;
    }
}

export function getProviderKey(providerId) {
    if (!storageAvailable()) return null;
    const storageKey = KEY_STORAGE[providerId];
    if (!storageKey) return null;
    return window.localStorage.getItem(storageKey) || null;
}

export function setProviderKey(providerId, key) {
    if (!storageAvailable()) return;
    const storageKey = KEY_STORAGE[providerId];
    if (!storageKey) return;
    if (key) window.localStorage.setItem(storageKey, key);
    else window.localStorage.removeItem(storageKey);
    notifyKeysChanged(providerId);
}

export function clearProviderKey(providerId) {
    setProviderKey(providerId, null);
}

export function isProviderEnabled(providerId) {
    if (!storageAvailable()) return true;
    return window.localStorage.getItem(`${providerId}${ENABLED_STORAGE_SUFFIX}`) !== '0';
}

export function setProviderEnabled(providerId, enabled) {
    if (!storageAvailable()) return;
    window.localStorage.setItem(`${providerId}${ENABLED_STORAGE_SUFFIX}`, enabled ? '1' : '0');
    notifyKeysChanged(providerId);
}

/** True when the provider has a key AND is enabled. */
export function isProviderConfigured(providerId) {
    return isProviderEnabled(providerId) && !!getProviderKey(providerId);
}

/** Non-secret metadata: { lastTestAt, lastTestOk, lastTestMessage }. */
export function getProviderMeta(providerId) {
    if (!storageAvailable()) return {};
    try {
        return JSON.parse(window.localStorage.getItem(`${providerId}${META_STORAGE_SUFFIX}`) || '{}');
    } catch {
        return {};
    }
}

export function setProviderMeta(providerId, meta) {
    if (!storageAvailable()) return;
    const merged = { ...getProviderMeta(providerId), ...meta };
    window.localStorage.setItem(`${providerId}${META_STORAGE_SUFFIX}`, JSON.stringify(merged));
}

/** Masked display form of a key — safe to render. */
export function maskKey(key) {
    if (!key) return '';
    if (key.length <= 8) return '••••••••';
    return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}

function notifyKeysChanged(providerId) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('provider-keys-changed', { detail: { provider: providerId } }));
}
