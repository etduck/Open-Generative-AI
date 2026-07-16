'use client';

import { useState, useCallback } from 'react';
import {
  listProviders,
  getProviderKey,
  setProviderKey,
  clearProviderKey,
  isProviderEnabled,
  setProviderEnabled,
  testProviderConnection,
  getProviderMeta,
  maskKey,
} from 'studio';

// API Providers settings — one card per provider (MuAPI / Kie.ai / Agnes AI).
// Keys are stored in separate localStorage slots and never mixed; masked
// display only, no key ever echoed to console or network responses.

const PROVIDER_NOTES = {
  muapi: {
    capabilities: 'Images, video, audio, lip sync & more. Workflows, Agents, Design Agent, templates and community content are MuAPI-exclusive and always use this key.',
    accent: '#22d3ee',
  },
  kie: {
    capabilities: 'Connected models: Nano Banana (text-to-image), Nano Banana Edit (image editing), Kling 2.6 (text-to-video & image-to-video).',
    accent: '#34d399',
  },
  agnes: {
    capabilities: 'Connected models: Agnes 2.0 Flash (chat in Text Studio, streaming), Agnes Image 2.1 Flash (generation + editing), Agnes Video 2.0 (text/image-to-video). Base URL is fixed to the official apihub.agnes-ai.com.',
    accent: '#fb923c',
  },
};

function ProviderCard({ provider, balance, onKeysChanged }) {
  const [storedKey, setStoredKey] = useState(() => getProviderKey(provider.id));
  const [enabled, setEnabled] = useState(() => isProviderEnabled(provider.id));
  const [meta, setMeta] = useState(() => getProviderMeta(provider.id));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [showDraft, setShowDraft] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const note = PROVIDER_NOTES[provider.id] || {};

  const refresh = useCallback(() => {
    setStoredKey(getProviderKey(provider.id));
    setEnabled(isProviderEnabled(provider.id));
    setMeta(getProviderMeta(provider.id));
    onKeysChanged?.(provider.id);
  }, [provider.id, onKeysChanged]);

  const handleSave = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setProviderKey(provider.id, trimmed);
    setDraft('');
    setEditing(false);
    setShowDraft(false);
    setTestResult(null);
    refresh();
  };

  const handleDelete = () => {
    clearProviderKey(provider.id);
    setTestResult(null);
    refresh();
  };

  const handleToggleEnabled = () => {
    setProviderEnabled(provider.id, !enabled);
    refresh();
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testProviderConnection(provider.id);
      setTestResult(result);
      setMeta(getProviderMeta(provider.id));
    } finally {
      setTesting(false);
    }
  };

  const lastTest = testResult || (meta.lastTestAt
    ? { ok: meta.lastTestOk, message: meta.lastTestMessage, latency: meta.lastTestLatency, checkedAt: meta.lastTestAt }
    : null);

  return (
    <div className={`bg-white/[0.03] border rounded-xl p-5 transition-colors ${enabled ? 'border-white/10' : 'border-white/5 opacity-70'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full" style={{ background: storedKey && enabled ? (note.accent || '#22d3ee') : 'rgba(255,255,255,0.15)' }} />
          <h3 className="text-sm font-bold text-white">{provider.label}</h3>
          {provider.id === 'muapi' && balance !== null && balance !== undefined && (
            <span className="text-[10px] font-bold bg-white/5 border border-white/10 rounded-full px-2 py-0.5 text-white/70">
              ${balance}
            </span>
          )}
          {!enabled && (
            <span className="text-[9px] font-bold uppercase tracking-wide text-white/30 border border-white/10 rounded-full px-2 py-0.5">disabled</span>
          )}
        </div>
        {/* Enable toggle */}
        <button
          type="button"
          onClick={handleToggleEnabled}
          title={enabled ? 'Disable provider' : 'Enable provider'}
          className={`relative w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-[#22d3ee]/70' : 'bg-white/10'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${enabled ? 'left-[18px]' : 'left-0.5'}`} />
        </button>
      </div>

      <p className="text-[11px] text-white/35 leading-relaxed mb-4">{note.capabilities}</p>

      {/* Key row */}
      {storedKey && !editing ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white/5 border border-white/[0.05] rounded-md px-3 py-2 text-[12px] font-mono text-white/70 truncate">
            {maskKey(storedKey)}
          </div>
          <button
            type="button"
            onClick={() => { setEditing(true); setDraft(''); }}
            className="h-8 px-3 rounded-md bg-white/5 border border-white/10 text-[11px] font-bold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="h-8 px-3 rounded-md bg-red-500/10 border border-red-500/20 text-[11px] font-bold text-red-400 hover:bg-red-500/20 transition-colors"
          >
            Delete
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type={showDraft ? 'text' : 'password'}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Paste your ${provider.label} API key`}
              autoComplete="off"
              className="w-full bg-white/5 border border-white/[0.05] rounded-md px-3 py-2 pr-9 text-[12px] text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-[#22d3ee]/30"
            />
            <button
              type="button"
              onClick={() => setShowDraft((v) => !v)}
              title={showDraft ? 'Hide key' : 'Show key'}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
            >
              {showDraft ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={!draft.trim()}
            className="h-8 px-4 rounded-md bg-[#22d3ee] text-black text-[11px] font-bold hover:bg-[#e5ff33] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Save
          </button>
          {storedKey && (
            <button
              type="button"
              onClick={() => { setEditing(false); setDraft(''); }}
              className="h-8 px-3 rounded-md bg-white/5 border border-white/10 text-[11px] font-bold text-white/60 hover:text-white transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Test connection */}
      <div className="flex items-center gap-3 mt-3">
        <button
          type="button"
          onClick={handleTest}
          disabled={testing || !storedKey || !enabled}
          className="h-7 px-3 rounded-md bg-white/5 border border-white/10 text-[11px] font-bold text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {testing && <span className="animate-spin text-[#22d3ee]">◌</span>}
          {testing ? 'Testing…' : 'Test connection'}
        </button>
        {lastTest && (
          <div className="flex-1 min-w-0 text-[10px] leading-snug">
            <span className={lastTest.ok ? 'text-emerald-400' : 'text-red-400'}>
              {lastTest.ok ? '✓ ' : '✕ '}
              {lastTest.message}
            </span>
            <span className="text-white/25 ml-2">
              {lastTest.latency !== undefined ? `${lastTest.latency}ms · ` : ''}
              {lastTest.checkedAt ? new Date(lastTest.checkedAt).toLocaleString() : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProviderSettingsModal({ onClose, balance, onKeysChanged }) {
  const providers = listProviders();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in-up p-4">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl w-full max-w-xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 pb-4 border-b border-white/[0.05] flex items-start justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">API Providers</h2>
            <p className="text-white/40 text-[12px] mt-1">
              Connect MuAPI, Kie.ai and Agnes AI. Each key is stored separately and only ever sent to its own provider.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          {providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              balance={provider.id === 'muapi' ? balance : undefined}
              onKeysChanged={onKeysChanged}
            />
          ))}

          <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg px-4 py-3">
            <p className="text-[11px] text-amber-200/70 leading-relaxed">
              <span className="font-bold">Security note:</span> keys are currently stored in this
              browser's localStorage (personal test phase). Anyone with access to this browser
              profile can read them — don't use shared machines, and prefer scoped/limited keys.
              Requests are relayed through this site's server proxy to fixed official provider
              endpoints only. A future phase will move keys fully server-side.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
