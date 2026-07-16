'use client';

import { useState } from 'react';

export default function ApiKeyModal({ onSave, onClose, onSkip, overlay = false, title, subtitle }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) { setError('Please enter your API key'); return; }
    onSave(trimmed);
  };

  const wrapperClass = overlay
    ? 'fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4 font-inter animate-fade-in-up'
    : 'min-h-screen bg-app-bg flex items-center justify-center px-4 font-inter';

  return (
    <div className={wrapperClass}>
      <div className="w-full max-w-sm bg-surface/90 backdrop-blur-xl border border-ink/15 rounded-xl p-10 shadow-2xl relative">
        {overlay && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 w-8 h-8 rounded-md text-ink/65 hover:text-ink hover:bg-ink/10 transition-colors flex items-center justify-center"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-14 h-14 bg-accent/5 rounded-2xl flex items-center justify-center border border-accent/10 mb-6 group hover:border-accent/30 transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" className="group-hover:scale-110 transition-transform">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L12 17.25l-4.5-4.5L15.5 7.5z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-ink tracking-tight mb-2">
            {title || 'Open Generative AI'}
          </h1>
          <p className="text-ink/65 text-[13px] leading-relaxed px-4">
            {subtitle || (
              <>Enter your <a href="https://muapi.ai/access-keys" target="_blank" rel="noreferrer" className="text-accent hover:text-accent-hover transition-colors">Muapi.ai</a> API key to start creating</>
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-ink/55 ml-1">
              API Access Key
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => { setKey(e.target.value); setError(''); }}
              placeholder="Paste your key here..."
              className="w-full bg-ink/5 border border-ink/10 rounded-md px-5 py-3 text-sm text-ink placeholder:text-ink/45 focus:outline-none focus:ring-1 focus:ring-accent/30 focus:bg-ink/10 transition-all"
              suppressHydrationWarning
            />
            {error && <p className="mt-2 text-red-500/80 text-[11px] font-medium ml-1">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full bg-accent text-white font-medium py-2.5 rounded-md hover:bg-accent-hover hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-accent/5"
            suppressHydrationWarning
          >
            Get Started
          </button>

          <p className="text-center text-[12px] text-ink/45 pt-2">
            Need a key?{' '}
            <a href="https://muapi.ai/access-keys" target="_blank" rel="noreferrer" className="text-ink/65 hover:text-accent transition-colors font-medium">
              Get one free →
            </a>
          </p>

          {onSkip && (
            <p className="text-center text-[12px] text-ink/45">
              Using Kie.ai or Agnes AI instead?{' '}
              <button
                type="button"
                onClick={onSkip}
                className="text-ink/65 hover:text-accent transition-colors font-medium underline underline-offset-2"
              >
                Skip — configure providers in Settings
              </button>
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
