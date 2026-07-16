"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { chatCompletion, textModels, isProviderConfigured, getProvider, resolveModelProvider } from "../api/index.js";

// Text Studio — lightweight chat workspace for text providers (Agnes AI
// today; the model list in api/textModels.js is the extension point for
// future text providers). Conversation history lives in localStorage only.

const PERSIST_KEY = "hg_text_studio_persistent";

const PROVIDER_BADGES = {
  kie: { label: "Kie.ai", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/25" },
  agnes: { label: "Agnes AI", cls: "bg-orange-500/10 text-orange-600 border-orange-500/25" },
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copy response"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="opacity-0 group-hover:opacity-100 transition-opacity text-ink/55 hover:text-ink/90 flex items-center gap-1 text-[10px] font-semibold"
    >
      {copied ? (
        <>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
          Copied
        </>
      ) : (
        <>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
          Copy
        </>
      )}
    </button>
  );
}

export default function TextStudio({ onGenerationError }) {
  const [selectedModelId, setSelectedModelId] = useState(textModels[0]?.id || "");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [messages, setMessages] = useState([]); // [{role, content}]
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState(null); // null = idle
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [providerReady, setProviderReady] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const dropdownRef = useRef(null);

  const selectedModel = textModels.find((m) => m.id === selectedModelId) || textModels[0];
  const providerId = selectedModel ? resolveModelProvider(selectedModel) : null;
  const providerLabel = providerId ? getProvider(providerId)?.label : "";

  const refreshProviderReady = useCallback(() => {
    setProviderReady(providerId ? isProviderConfigured(providerId) : false);
  }, [providerId]);

  // ── Persistence ──────────────────────────────────────────────────────────
  useEffect(() => {
    setHasMounted(true);
    try {
      const stored = localStorage.getItem(PERSIST_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.selectedModelId && textModels.some((m) => m.id === data.selectedModelId)) {
          setSelectedModelId(data.selectedModelId);
        }
        if (data.systemPrompt) setSystemPrompt(data.systemPrompt);
        if (Array.isArray(data.messages)) setMessages(data.messages);
      }
    } catch {
      /* corrupted persistence — start fresh */
    }
  }, []);

  useEffect(() => {
    if (!hasMounted) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          PERSIST_KEY,
          JSON.stringify({ selectedModelId, systemPrompt, messages: messages.slice(-100) })
        );
      } catch {
        /* storage full */
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [hasMounted, selectedModelId, systemPrompt, messages]);

  // ── Provider availability (reacts to Settings changes) ──────────────────
  useEffect(() => {
    refreshProviderReady();
    window.addEventListener("provider-keys-changed", refreshProviderReady);
    window.addEventListener("focus", refreshProviderReady);
    return () => {
      window.removeEventListener("provider-keys-changed", refreshProviderReady);
      window.removeEventListener("focus", refreshProviderReady);
    };
  }, [refreshProviderReady]);

  // ── Auto-scroll on new content ───────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamingText]);

  // ── Dropdown outside click ───────────────────────────────────────────────
  useEffect(() => {
    if (!modelDropdownOpen) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setModelDropdownOpen(false);
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [modelDropdownOpen]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleClear = useCallback(() => {
    if (generating) handleStop();
    setMessages([]);
    setStreamingText(null);
    setError(null);
  }, [generating, handleStop]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || generating || !selectedModel) return;
    setError(null);

    const history = [...messages, { role: "user", content: trimmed }];
    setMessages(history);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const requestMessages = [];
    if (systemPrompt.trim()) requestMessages.push({ role: "system", content: systemPrompt.trim() });
    requestMessages.push(...history.map(({ role, content }) => ({ role, content })));

    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);

    const useStreaming = selectedModel.capabilities?.streaming !== false;
    setStreamingText(useStreaming ? "" : null);

    try {
      const result = await chatCompletion({
        model: selectedModel.id,
        messages: requestMessages,
        stream: useStreaming,
        signal: controller.signal,
        onDelta: useStreaming ? (delta) => setStreamingText((prev) => (prev || "") + delta) : undefined,
      });
      const finalText = result.text || "";
      if (finalText) {
        setMessages((prev) => [...prev, { role: "assistant", content: finalText }]);
      }
    } catch (e) {
      if (e?.name !== "AbortError") {
        const message = e?.message?.slice(0, 200) || "Chat request failed";
        setError(message);
        onGenerationError?.(message);
      }
    } finally {
      setStreamingText(null);
      setGenerating(false);
      abortRef.current = null;
    }
  }, [input, generating, selectedModel, messages, systemPrompt, onGenerationError]);

  const handleTextareaInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  };

  if (!hasMounted) return null;

  return (
    <div className="w-full h-full flex flex-col items-center bg-app-bg relative overflow-hidden">
      <div className="w-full max-w-3xl flex-1 min-h-0 flex flex-col px-4 md:px-6 pt-4">

        {/* ── Top bar: model picker + actions ── */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-ink/10">
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setModelDropdownOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-ink/15 bg-ink/5 text-[12px] font-bold text-ink/90 hover:text-ink hover:bg-ink/10 transition-colors"
            >
              <span>{selectedModel?.name || "Select model"}</span>
              {providerId && PROVIDER_BADGES[providerId] && (
                <span className={`text-[8px] font-bold px-1.5 py-px rounded-full border ${PROVIDER_BADGES[providerId].cls}`}>
                  {PROVIDER_BADGES[providerId].label}
                </span>
              )}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            {modelDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-surface border border-ink/15 rounded-xl p-2 shadow-2xl z-50">
                {textModels.map((m) => {
                  const pid = resolveModelProvider(m);
                  const ready = isProviderConfigured(pid);
                  return (
                    <div
                      key={m.id}
                      onClick={() => { setSelectedModelId(m.id); setModelDropdownOpen(false); }}
                      className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all hover:bg-ink/5 ${selectedModelId === m.id ? "bg-ink/5" : ""}`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                          {m.name}
                          {PROVIDER_BADGES[pid] && (
                            <span className={`text-[8px] font-bold px-1.5 py-px rounded-full border ${PROVIDER_BADGES[pid].cls}`}>
                              {PROVIDER_BADGES[pid].label}
                            </span>
                          )}
                        </span>
                        {!ready && (
                          <span className="text-[9px] text-amber-700">API key required — add in Settings</span>
                        )}
                      </div>
                      {selectedModelId === m.id && (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSystemPrompt((v) => !v)}
              className={`px-3 py-1.5 rounded-md border text-[11px] font-bold transition-colors ${
                showSystemPrompt || systemPrompt.trim()
                  ? "border-accent/30 bg-accent/10 text-accent"
                  : "border-ink/15 bg-ink/5 text-ink/75 hover:text-ink"
              }`}
            >
              System Prompt
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={messages.length === 0 && !generating}
              className="px-3 py-1.5 rounded-md border border-ink/15 bg-ink/5 text-[11px] font-bold text-ink/75 hover:text-red-600 hover:border-red-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Clear Chat
            </button>
          </div>
        </div>

        {/* ── System prompt editor ── */}
        {showSystemPrompt && (
          <div className="pt-3">
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="System prompt (optional) — sets the assistant's behavior for this conversation"
              rows={2}
              className="w-full bg-ink/5 border border-ink/10 rounded-lg px-4 py-2.5 text-[12px] text-ink/90 placeholder:text-ink/45 focus:outline-none focus:ring-1 focus:ring-accent/30 resize-y"
            />
          </div>
        )}

        {/* ── Provider not configured banner ── */}
        {!providerReady && (
          <div className="mt-3 flex items-center gap-3 bg-amber-500/5 border border-amber-500/20 rounded-lg px-4 py-3">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" className="shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            <p className="text-[12px] text-amber-800">
              <span className="font-bold">{providerLabel}</span> is not configured or is disabled.
              Add its API key under Settings → API Providers to start chatting.
            </p>
          </div>
        )}

        {/* ── Messages ── */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar py-5 flex flex-col gap-4">
          {messages.length === 0 && streamingText === null && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-ink/55">
              <div className="w-12 h-12 rounded-2xl bg-accent/5 border border-accent/10 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
              </div>
              <p className="text-sm font-bold text-ink/70">Text Studio</p>
              <p className="text-[12px] max-w-sm">
                Chat with text models. Conversations are stored only in this browser.
              </p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`group flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
                  msg.role === "user"
                    ? "bg-accent/10 border border-accent/15 text-ink"
                    : "bg-ink/5 border border-ink/10 text-ink/90"
                }`}
              >
                {msg.content}
              </div>
              {msg.role === "assistant" && (
                <div className="mt-1 ml-1">
                  <CopyButton text={msg.content} />
                </div>
              )}
            </div>
          ))}

          {streamingText !== null && (
            <div className="flex flex-col items-start">
              <div className="max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap break-words bg-ink/5 border border-ink/10 text-ink/90">
                {streamingText || (
                  <span className="inline-flex gap-1 items-center text-ink/65">
                    <span className="animate-pulse">●</span>
                    <span className="animate-pulse" style={{ animationDelay: "150ms" }}>●</span>
                    <span className="animate-pulse" style={{ animationDelay: "300ms" }}>●</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="self-center bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-2 text-[11px] text-red-600 max-w-md text-center">
              {error}
            </div>
          )}
        </div>

        {/* ── Composer ── */}
        <div className="pb-5">
          <div className="bg-surface border border-ink/15 rounded-2xl p-3 flex items-end gap-3 focus-within:border-accent/30 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onInput={handleTextareaInput}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={providerReady ? "Send a message… (Enter to send, Shift+Enter for newline)" : "Add an API key in Settings to start chatting"}
              rows={1}
              disabled={!providerReady}
              className="flex-1 bg-transparent border-none text-[13px] text-ink placeholder:text-ink/45 focus:outline-none focus:ring-0 resize-none max-h-[180px] disabled:cursor-not-allowed"
            />
            {generating ? (
              <button
                type="button"
                onClick={handleStop}
                className="shrink-0 h-9 px-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-600 text-xs font-bold hover:bg-red-500/25 transition-colors flex items-center gap-2"
              >
                <span className="w-2 h-2 bg-red-400 rounded-[2px]" />
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || !providerReady}
                className="shrink-0 h-9 px-4 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Send
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
