"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { processV2V } from "../muapi.js";
import { generateVideo, generateI2V, uploadFile } from "../api/index.js";
import {
  t2vModels,
  i2vModels,
  v2vModels,
  getAspectRatiosForVideoModel,
  getDurationsForModel,
  getResolutionsForVideoModel,
  getAspectRatiosForI2VModel,
  getDurationsForI2VModel,
  getResolutionsForI2VModel,
  getEffectsForI2VModel,
  getDefaultEffectForI2VModel,
  getModesForModel,
  getMaxImagesForI2VModel,
} from "../models.js";

// ── tiny helpers ──────────────────────────────────────────────────────────────

function getQualitiesForModel(modelList, modelId) {
  const model = modelList.find((m) => m.id === modelId);
  return model?.inputs?.quality?.enum || [];
}

async function downloadFile(url, filename) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank");
  }
}

// ── SVG icons (kept inline to avoid extra deps) ───────────────────────────────

const CheckSvg = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#2563eb"
    strokeWidth="4"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const VideoIconSvg = ({ className }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={className}
  >
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

const VideoReadySvg = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="text-primary"
  >
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    <polyline points="7 10 10 13 15 8" stroke="#2563eb" strokeWidth="2.5" />
  </svg>
);

// ── Dropdown components ───────────────────────────────────────────────────────

function DropdownItem({ label, selected, onClick }) {
  return (
    <div
      className="flex items-center justify-between p-3.5 hover:bg-ink/5 rounded-2xl cursor-pointer transition-all group"
      onClick={onClick}
    >
      <span className="text-xs font-bold text-ink opacity-80 group-hover:opacity-100 capitalize">
        {label}
      </span>
      {selected && <CheckSvg />}
    </div>
  );
}

const PROVIDER_LOGOS = {
  openai: "https://cdn.muapi.ai/models/openai.png",
  google: "https://cdn.muapi.ai/models/gemini.png",
  kling: "https://cdn.muapi.ai/models/kling.png",
  alibaba: "https://cdn.muapi.ai/models/alibaba.png",
  bytedance: "https://cdn.muapi.ai/models/bytedance.png",
  blackforest: "https://cdn.muapi.ai/models/bfl.png",
  minimax: "https://cdn.muapi.ai/models/minimax.png",
  suno: "https://cdn.muapi.ai/models/suno.png",
  anthropic: "https://cdn.muapi.ai/models/claude.png",
  meshy: "https://cdn.muapi.ai/models/meshy-3.png",
  tripo3d: "https://cdn.muapi.ai/models/tripo3d.png",
  grok: "https://cdn.muapi.ai/models/xai.png",
  muapi: "https://cdn.muapi.ai/models/muapi.png",
  midjourney: "https://cdn.muapi.ai/models/midjourney.png",
  vidu: "https://cdn.muapi.ai/models/vidu.png",
  runway: "https://cdn.muapi.ai/models/runway.png",
  luma: "https://cdn.muapi.ai/models/luma.png",
  ideogram: "https://cdn.muapi.ai/models/ideogram.png",
  leonardoai: "https://cdn.muapi.ai/models/leonardoai.png",
  hunyuan: "https://cdn.muapi.ai/models/hunyuan.png",
  hidream: "https://cdn.muapi.ai/models/hidream.png",
  lightricks: "https://cdn.muapi.ai/models/lightricks.png",
  pixverse: "https://cdn.muapi.ai/models/pixverse.png",
  reve: "https://cdn.muapi.ai/models/reve.png",
  stability: "https://cdn.muapi.ai/models/stability.png"
};

const invertLogos = []; // dark-logo inversion was for the dark theme; logos render as-is on light

function ModelDropdown({ imageMode, selectedModel, onSelect, onClose }) {
  const [search, setSearch] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("all");

  const generationModels = imageMode ? i2vModels : t2vModels;

  const getProviderStyle = (provider) => {
    switch (provider) {
      case "grok":
        return { text: "xI", bg: "bg-orange-500/10 text-orange-600 border-orange-500/25" };
      case "openai":
        return { text: "O", bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/25" };
      case "google":
        return { text: "G", bg: "bg-blue-500/10 text-blue-600 border-blue-500/25" };
      case "blackforest":
        return { text: "BF", bg: "bg-amber-500/10 text-amber-600 border-amber-500/25" };
      case "bytedance":
        return { text: "BD", bg: "bg-purple-500/10 text-purple-600 border-purple-500/25" };
      case "midjourney":
        return { text: "MJ", bg: "bg-indigo-500/10 text-indigo-600 border-indigo-500/25" };
      case "kling":
        return { text: "KL", bg: "bg-rose-500/10 text-rose-600 border-rose-500/25" };
      case "vidu":
        return { text: "VD", bg: "bg-cyan-500/10 text-cyan-600 border-cyan-500/25" };
      case "minimax":
        return { text: "MX", bg: "bg-pink-500/10 text-pink-600 border-pink-500/25" };
      case "ideogram":
        return { text: "ID", bg: "bg-yellow-500/10 text-yellow-600 border-yellow-500/25" };
      case "luma":
        return { text: "LM", bg: "bg-teal-500/10 text-teal-600 border-teal-500/25" };
      case "alibaba":
        return { text: "AL", bg: "bg-sky-500/10 text-sky-600 border-sky-500/25" };
      case "leonardoai":
        return { text: "LE", bg: "bg-violet-500/10 text-violet-600 border-violet-500/25" };
      case "stability":
        return { text: "SD", bg: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/25" };
      default:
        const name = provider ? provider.toUpperCase() : "AI";
        return { text: name.substring(0, 2), bg: "bg-primary/10 text-primary border-primary/25" };
    }
  };

  // Dynamically compute list of providers from the input models lists
  const availableProviders = [];
  const seenProviders = new Set();
  const allCurrentModels = [...generationModels, ...v2vModels];
  
  allCurrentModels.forEach(m => {
    const pId = m.provider || 'muapi';
    const pName = m.provider_name || 'Muapi';
    if (!seenProviders.has(pId)) {
      seenProviders.add(pId);
      availableProviders.push({ id: pId, name: pName });
    }
  });

  const lf = search.toLowerCase();

  const filterFn = (m) => {
    // 1. Filter by provider tab
    if (selectedProvider !== "all") {
      const pId = m.provider || 'muapi';
      if (pId !== selectedProvider) return false;
    }
    // 2. Filter by search query
    return (
      m.name.toLowerCase().includes(lf) ||
      m.id.toLowerCase().includes(lf)
    );
  };

  const filteredMain = generationModels.filter(filterFn);
  const filteredV2V = v2vModels.filter(filterFn);

  const getIconColor = (m, isV2V) => {
    if (isV2V) return "bg-orange-500/10 text-orange-600 border-orange-500/10";
    if (m.id.includes("kling")) return "bg-blue-500/10 text-blue-600 border-blue-500/10";
    if (m.id.includes("veo")) return "bg-purple-500/10 text-purple-600 border-purple-500/10";
    if (m.id.includes("sora")) return "bg-rose-500/10 text-rose-600 border-rose-500/10";
    return "bg-primary/10 text-primary border-primary/10";
  };

  const renderItem = (m, isV2V = false) => (
    <div
      key={m.id}
      className={`flex items-center justify-between p-3.5 hover:bg-ink/5 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-ink/10 ${selectedModel === m.id ? "bg-ink/5 border-ink/10" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(m, isV2V);
        onClose();
      }}
    >
      <div className="flex items-center gap-3.5">
        {PROVIDER_LOGOS[m.provider] ? (
          <div className="w-8 h-8 rounded-xl border border-ink/10 overflow-hidden shrink-0 flex items-center justify-center bg-ink/5">
            <img
              src={PROVIDER_LOGOS[m.provider]}
              alt={m.provider_name}
              className={`w-full h-full object-contain p-1 ${invertLogos.includes(m.provider) ? "invert" : ""}`}
            />
          </div>
        ) : (
          <div
            className={`w-9 h-9 ${getIconColor(m, isV2V)} border rounded-xl flex items-center justify-center font-black text-xs shadow-inner uppercase`}
          >
            {m.name.charAt(0)}
          </div>
        )}
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-xs font-bold text-ink tracking-tight truncate flex items-center gap-1.5">
            {m.name}
            {m.apiProvider && m.apiProvider !== "muapi" && (
              <span className={`text-[8px] font-bold px-1.5 py-px rounded-full border ${
                m.apiProvider === "kie"
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/25"
                  : "bg-orange-500/10 text-orange-600 border-orange-500/25"
              }`}>
                {m.apiProvider === "kie" ? "Kie.ai" : "Agnes AI"}
              </span>
            )}
          </span>
          {isV2V ? (
            <span className="text-[9px] text-orange-600/70">
              {m.imageField ? "Upload a video and image" : "Upload a video to use"}
            </span>
          ) : (
            selectedProvider === "all" && m.provider_name && (
              <span className="text-[9px] text-ink/65">
                {m.provider_name}
              </span>
            )
          )}
        </div>
      </div>
      {selectedModel === m.id && <CheckSvg />}
    </div>
  );

  const invertLogos = []; // dark-logo inversion was for the dark theme; logos render as-is on light

  return (
    <div className="flex gap-4 h-full max-h-[70vh] min-h-[350px]">
      {/* Left Sidebar: Provider tabs */}
      <div className="flex flex-col gap-2.5 items-center pr-3 border-r border-ink/10 shrink-0 select-none overflow-y-auto custom-scrollbar w-12 pt-0.5">
        <button
          type="button"
          onClick={() => setSelectedProvider("all")}
          className={`w-8.5 h-8.5 rounded-full flex items-center justify-center border transition-all flex-shrink-0 cursor-pointer ${
            selectedProvider === "all"
              ? "bg-ink/10 text-yellow-600 border-yellow-500/30 shadow-md scale-105"
              : "bg-ink/5 text-ink/70 border-ink/10 hover:bg-ink/5 hover:text-ink"
          }`}
          title="All Providers"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill={selectedProvider === "all" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
        
        {availableProviders.map(p => {
          const style = getProviderStyle(p.id);
          const isSelected = selectedProvider === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedProvider(p.id)}
              className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center font-black text-[10px] border transition-all flex-shrink-0 cursor-pointer overflow-hidden ${
                isSelected
                  ? `${style.bg} border-ink/25 scale-105 shadow-md`
                  : "bg-ink/5 text-ink/65 border-ink/10 hover:bg-ink/5 hover:text-ink/90"
              }`}
              title={p.name}
            >
              {PROVIDER_LOGOS[p.id] ? (
                <img
                  src={PROVIDER_LOGOS[p.id]}
                  alt={p.name}
                  className={`w-full h-full rounded-full object-contain ${invertLogos.includes(p.id) ? "invert" : ""}`}
                />
              ) : (
                style.text
              )}
            </button>
          );
        })}
      </div>

      {/* Right Pane: Search + Lists */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <div className="px-1 pb-2 border-b border-ink/10 shrink-0">
          <div className="flex items-center gap-3 bg-ink/5 rounded-xl px-4 py-2 border border-ink/10 focus-within:border-primary/50 transition-colors">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-muted"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="bg-transparent border-none text-xs text-ink focus:ring-0 w-full p-0 outline-none"
            />
          </div>
        </div>
        
        <div className="text-xs font-bold text-secondary px-2 py-1 shrink-0 flex items-center justify-between">
          <span>Video models</span>
          {selectedProvider !== "all" && (
            <span className="text-[10px] bg-ink/5 px-2 py-0.5 rounded text-ink/75">
              {availableProviders.find(p => p.id === selectedProvider)?.name || selectedProvider}
            </span>
          )}
        </div>
        
        <div className="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar pr-1 pb-2 flex-1">
          {filteredMain.length === 0 && filteredV2V.length === 0 ? (
            <div className="text-xs text-ink/55 text-center py-6">
              No models found
            </div>
          ) : (
            <>
              {filteredMain.map((m) => renderItem(m, false))}
              {filteredV2V.length > 0 && (
                <>
                  <div className="text-xs font-bold text-orange-600/70 px-3 py-2 mt-1 border-t border-ink/10">
                    Video Tools
                  </div>
                  {filteredV2V.map((m) => renderItem(m, true))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Control button ────────────────────────────────────────────────────────────

function ControlBtn({ icon, label, onClick, style }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className="flex items-center gap-1.5 md:gap-2.5 px-3 md:px-4 py-2 md:py-2.5 bg-ink/5 hover:bg-ink/10 rounded-xl md:rounded-2xl transition-all border border-ink/10 group whitespace-nowrap"
    >
      {icon}
      <span className="text-xs font-bold text-ink group-hover:text-primary transition-colors">
        {label}
      </span>
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        className="opacity-20 group-hover:opacity-100 transition-opacity"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
}

// ── Dropdown panel ─────────────────────────────────────────────────────────────
// Rendered inside a `relative` wrapper div; floats above the anchor button.

// ── Main component ────────────────────────────────────────────────────────────

export default function VideoStudio({
  apiKey,
  onGenerationComplete,
  onGenerationError,
  historyItems,
  droppedFiles,
  onFilesHandled,
}) {
  const PERSIST_KEY = "hg_video_studio_persistent";

  // ── mode state ──
  const [imageMode, setImageMode] = useState(false); // i2v
  const [v2vMode, setV2vMode] = useState(false);

  // ── model / params ──
  const defaultModel = t2vModels[0];
  const [selectedModel, setSelectedModel] = useState(defaultModel.id);
  const [selectedModelName, setSelectedModelName] = useState(defaultModel.name);
  const [selectedAr, setSelectedAr] = useState(
    defaultModel.inputs?.aspect_ratio?.default || "16:9",
  );
  const [selectedDuration, setSelectedDuration] = useState(
    defaultModel.inputs?.duration?.default || 5,
  );
  const [selectedResolution, setSelectedResolution] = useState(
    defaultModel.inputs?.resolution?.default || "",
  );
  const [selectedQuality, setSelectedQuality] = useState(
    defaultModel.inputs?.quality?.default || "",
  );
  const [selectedMode, setSelectedMode] = useState("");
  const [selectedEffect, setSelectedEffect] = useState("");

  // ── upload progress ──
  const [imageProgress, setImageProgress] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);

  // ── control visibility ──
  const [showAr, setShowAr] = useState(true);
  const [showDuration, setShowDuration] = useState(true);
  const [showResolution, setShowResolution] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [showMode, setShowMode] = useState(false);
  const [showEffect, setShowEffect] = useState(false);

  // ── uploads ──
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [uploadedImageUrls, setUploadedImageUrls] = useState([]);
  const [imageUploading, setImageUploading] = useState(false);
  const [uploadedEndImageUrl, setUploadedEndImageUrl] = useState(null);
  const [endImageUploading, setEndImageUploading] = useState(false);
  const [endImageProgress, setEndImageProgress] = useState(0);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [uploadedVideoName, setUploadedVideoName] = useState(null);

  // ── generation / canvas ──
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [fullscreenUrl, setFullscreenUrl] = useState(null);
  const [canvasUrl, setCanvasUrl] = useState(null);
  const [canvasModel, setCanvasModel] = useState(null);
  const [showCanvas, setShowCanvas] = useState(false);
  const [lastGenerationId, setLastGenerationId] = useState(null);
  const [lastGenerationModel, setLastGenerationModel] = useState(null);

  // ── history ──
  const [localHistory, setLocalHistory] = useState([]);
  const [activeHistoryIdx, setActiveHistoryIdx] = useState(0);

  // ── dropdown ──
  const [openDropdown, setOpenDropdown] = useState(null); // 'model'|'ar'|'duration'|'resolution'|'quality'|'mode'|null

  // ── prompt ──
  const [prompt, setPrompt] = useState("");
  const [promptDisabled, setPromptDisabled] = useState(false);

  // ── refs ──
  const containerRef = useRef(null);
  const textareaRef = useRef(null);
  const dropdownRef = useRef(null);
  const imageFileInputRef = useRef(null);
  const endImageFileInputRef = useRef(null);
  const videoFileInputRef = useRef(null);
  const resultVideoRef = useRef(null);
  const hasRestored = useRef(false);

  // ── derived data ──
  const history = historyItems ?? localHistory;

  const getCurrentModels = useCallback(() => {
    if (v2vMode) return v2vModels;
    return imageMode ? i2vModels : t2vModels;
  }, [imageMode, v2vMode]);

  const getCurrentAspectRatios = useCallback(
    (id) =>
      imageMode
        ? getAspectRatiosForI2VModel(id)
        : getAspectRatiosForVideoModel(id),
    [imageMode],
  );

  const getCurrentDurations = useCallback(
    (id) =>
      imageMode ? getDurationsForI2VModel(id) : getDurationsForModel(id),
    [imageMode],
  );

  const getCurrentResolutions = useCallback(
    (id) =>
      imageMode
        ? getResolutionsForI2VModel(id)
        : getResolutionsForVideoModel(id),
    [imageMode],
  );

  const getCurrentModel = useCallback(
    () => getCurrentModels().find((m) => m.id === selectedModel),
    [getCurrentModels, selectedModel],
  );

  const isMotionControlSelection = useCallback(
    (modelId, isV2v) => {
      if (!isV2v) return false;
      const m = v2vModels.find((x) => x.id === modelId);
      return !!m?.imageField;
    },
    [],
  );

  // ── update controls when model/mode changes ──────────────────────────────
  const applyControlsForModel = useCallback(
    (modelId, isImageMode, isV2vMode) => {
      if (isV2vMode) {
        setShowAr(false);
        setShowDuration(false);
        setShowResolution(false);
        setShowQuality(false);
        setShowMode(false);
        setShowEffect(false);
        return;
      }

      const modelList = isImageMode ? i2vModels : t2vModels;
      const model = modelList.find((m) => m.id === modelId);

      const ars = isImageMode
        ? getAspectRatiosForI2VModel(modelId)
        : getAspectRatiosForVideoModel(modelId);
      if (ars.length > 0) {
        setSelectedAr(ars[0]);
        setShowAr(true);
      } else {
        setShowAr(false);
      }

      const durations = isImageMode
        ? getDurationsForI2VModel(modelId)
        : getDurationsForModel(modelId);
      if (durations.length > 0) {
        setSelectedDuration(durations[0]);
        setShowDuration(true);
      } else {
        setShowDuration(false);
      }

      const resolutions = isImageMode
        ? getResolutionsForI2VModel(modelId)
        : getResolutionsForVideoModel(modelId);
      if (resolutions.length > 0) {
        setSelectedResolution(resolutions[0]);
        setShowResolution(true);
      } else {
        setShowResolution(false);
      }

      const qualities = getQualitiesForModel(modelList, modelId);
      if (qualities.length > 0) {
        setSelectedQuality(model?.inputs?.quality?.default || qualities[0]);
        setShowQuality(true);
      } else {
        setSelectedQuality("");
        setShowQuality(false);
      }

      const modes = getModesForModel(modelId);
      if (modes.length > 0) {
        setSelectedMode(model?.inputs?.mode?.default || modes[0]);
        setShowMode(true);
      } else {
        setSelectedMode("");
        setShowMode(false);
      }

      const effects = isImageMode ? getEffectsForI2VModel(modelId) : [];
      if (effects.length > 0) {
        setSelectedEffect(getDefaultEffectForI2VModel(modelId) || effects[0]);
        setShowEffect(true);
      } else {
        setSelectedEffect("");
        setShowEffect(false);
      }
    },
    [],
  );

  // ── Persistence: Load ────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PERSIST_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.imageMode !== undefined) setImageMode(data.imageMode);
        if (data.v2vMode !== undefined) setV2vMode(data.v2vMode);
        if (data.selectedModel) setSelectedModel(data.selectedModel);
        if (data.selectedModelName) setSelectedModelName(data.selectedModelName);
        if (data.selectedAr) setSelectedAr(data.selectedAr);
        if (data.selectedDuration) setSelectedDuration(data.selectedDuration);
        if (data.selectedResolution) setSelectedResolution(data.selectedResolution);
        if (data.selectedQuality) setSelectedQuality(data.selectedQuality);
        if (data.selectedMode) setSelectedMode(data.selectedMode);
        if (data.selectedEffect) setSelectedEffect(data.selectedEffect);
        if (data.uploadedImageUrl) setUploadedImageUrl(data.uploadedImageUrl);
        if (data.uploadedImageUrls) {
          setUploadedImageUrls(data.uploadedImageUrls);
        } else if (data.uploadedImageUrl) {
          setUploadedImageUrls([data.uploadedImageUrl]);
        }
        if (data.uploadedVideoUrl) setUploadedVideoUrl(data.uploadedVideoUrl);
        if (data.uploadedVideoName) setUploadedVideoName(data.uploadedVideoName);
        if (data.prompt) setPrompt(data.prompt);
        if (data.localHistory) setLocalHistory(data.localHistory);

        // Update control visibility based on restored model/mode
        applyControlsForModel(
          data.selectedModel || defaultModel.id,
          !!data.imageMode,
          !!data.v2vMode
        );
      }
    } catch (err) {
      console.warn("Failed to load VideoStudio persistence:", err);
    } finally {
      hasRestored.current = true;
    }
  }, [applyControlsForModel, defaultModel.id]);

  // ── Adjust height on load ────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      if (textareaRef.current) {
        const el = textareaRef.current;
        el.style.height = "auto";
        const maxH = window.innerWidth < 768 ? 150 : 250;
        el.style.height = Math.min(el.scrollHeight, maxH) + "px";
      }
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // ── Persistence: Save ────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const state = {
          imageMode,
          v2vMode,
          selectedModel,
          selectedModelName,
          selectedAr,
          selectedDuration,
          selectedResolution,
          selectedQuality,
          selectedMode,
          selectedEffect,
          uploadedImageUrl,
          uploadedImageUrls,
          uploadedVideoUrl,
          uploadedVideoName,
          prompt,
          localHistory,
        };
        localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
      } catch (err) {
        console.warn("Failed to save VideoStudio persistence:", err);
      }
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [
    imageMode,
    v2vMode,
    selectedModel,
    selectedModelName,
    selectedAr,
    selectedDuration,
    selectedResolution,
    selectedQuality,
    selectedMode,
    selectedEffect,
    uploadedImageUrl,
    uploadedImageUrls,
    uploadedVideoUrl,
    uploadedVideoName,
    prompt,
    localHistory,
  ]);

  // ── Derived UI values ────────────────────────────────────────────────────

  const processDroppedImage = async (file) => {
    if (file.size > 10 * 1024 * 1024) {
      alert("Image exceeds 10MB limit.");
      return;
    }
    setImageUploading(true);
    setImageProgress(0);
    // Anticipate the model this image will be used with, so the upload is
    // routed through that model's provider (an Agnes/Kie model must not
    // depend on MuAPI upload credits).
    const anticipatedT2V = t2vModels.find((m) => m.id === selectedModel);
    const uploadTargetModelId = imageMode
      ? selectedModel
      : (anticipatedT2V?.family
          ? i2vModels.find((m) => m.family === anticipatedT2V.family)?.id
          : null) || i2vModels[0].id;
    try {
      const url = await uploadFile(apiKey, file, (pct) => {
        setImageProgress(pct);
      }, { modelId: uploadTargetModelId });
      setUploadedImageUrl(url);
      setUploadedVideoUrl(null);
      setUploadedVideoName(null);
      setV2vMode(false);

      let targetModelId = selectedModel;
      if (!imageMode) {
        const currentT2V = t2vModels.find((m) => m.id === selectedModel);
        const sibling = currentT2V?.family
          ? i2vModels.find((m) => m.family === currentT2V.family)
          : null;
        const target = sibling || i2vModels[0];
        targetModelId = target.id;
        setImageMode(true);
        setSelectedModel(target.id);
        setSelectedModelName(target.name);
        applyControlsForModel(target.id, true, false);
      }

      const maxImgs = getMaxImagesForI2VModel(targetModelId);
      if (maxImgs > 2) {
        setUploadedImageUrls((prev) => {
          if (prev.includes(url)) return prev;
          return [...prev, url].slice(0, maxImgs);
        });
      } else {
        setUploadedImageUrls([url]);
      }
      setPromptDisabled(false);
    } catch (err) {
      alert(`Image upload failed: ${err.message}`);
    } finally {
      setImageUploading(false);
      setImageProgress(0);
    }
  };

  const processDroppedVideo = async (file) => {
    if (file.size > 50 * 1024 * 1024) {
      alert("Video exceeds 50MB limit.");
      return;
    }
    setVideoUploading(true);
    setVideoProgress(0);
    try {
      const url = await uploadFile(apiKey, file, (pct) => {
        setVideoProgress(pct);
      });
      setUploadedVideoUrl(url);
      setUploadedVideoName(file.name);
      if (imageMode) {
        setUploadedImageUrl(null);
        setImageMode(false);
      }
      setV2vMode(true);
      const firstV2V = v2vModels[0];
      setSelectedModel(firstV2V.id);
      setSelectedModelName(firstV2V.name);
      applyControlsForModel(firstV2V.id, false, true);
      setPrompt("");
      setPromptDisabled(true);
    } catch (err) {
      alert(`Video upload failed: ${err.message}`);
    } finally {
      setVideoUploading(false);
      setVideoProgress(0);
    }
  };

  // ── Handle Dropped Files ────────────────────────────────────────────────
  useEffect(() => {
    if (droppedFiles && droppedFiles.length > 0) {
      const imageFiles = droppedFiles.filter(f => f.type.startsWith('image/'));
      const videoFiles = droppedFiles.filter(f => f.type.startsWith('video/'));
      
      if (videoFiles.length > 0) {
        processDroppedVideo(videoFiles[0]);
      } else if (imageFiles.length > 0) {
        processDroppedImage(imageFiles[0]);
      }
      onFilesHandled?.();
    }
  }, [droppedFiles, onFilesHandled, processDroppedImage, processDroppedVideo]);

  // Initialise controls for default model on mount
  useEffect(() => {
    if (hasRestored.current) return;
    applyControlsForModel(defaultModel.id, false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── close dropdown on outside click ─────────────────────────────────────
  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [openDropdown]);

  // ── textarea auto-resize ──────────────────────────────────────────────────
  const handlePromptInput = (e) => {
    setPrompt(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    const maxH = window.innerWidth < 768 ? 150 : 250;
    el.style.height = Math.min(el.scrollHeight, maxH) + "px";
  };

  // ── image upload ─────────────────────────────────────────────────────────
  const handleImageFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Image exceeds 10MB limit.");
      return;
    }
    setImageUploading(true);
    setImageProgress(0);

    // Anticipate the model this image will be used with, so the upload is
    // routed through that model's provider (an Agnes/Kie model must not
    // depend on MuAPI upload credits).
    const anticipatedT2V = t2vModels.find((m) => m.id === selectedModel);
    const keepsCurrentModel =
      imageMode ||
      isMotionControlSelection(selectedModel, v2vMode) ||
      !!anticipatedT2V?.inputs?.images_list;
    const uploadTargetModelId = keepsCurrentModel
      ? selectedModel
      : (anticipatedT2V?.family
          ? i2vModels.find((m) => m.family === anticipatedT2V.family)?.id
          : null) || i2vModels[0].id;

    try {
      const url = await uploadFile(apiKey, file, (pct) => {
        setImageProgress(pct);
      }, { modelId: uploadTargetModelId });
      setUploadedImageUrl(url);

      // Motion-control v2v: image is a second input, not a mode switch
      if (isMotionControlSelection(selectedModel, v2vMode)) {
        setPromptDisabled(false);
        setUploadedImageUrls([url]);
      } else {
        // Model-native image reference (e.g. Seedance 2.0 Extend with inputs.images_list):
        // keep the current model & mode; just accumulate the image URL
        const currentT2VOrExtend = t2vModels.find((m) => m.id === selectedModel);
        if (currentT2VOrExtend?.inputs?.images_list) {
          const maxImgs = currentT2VOrExtend.inputs?.images_list?.maxItems || 8;
          setUploadedImageUrls((prev) => {
            if (prev.includes(url)) return prev;
            return [...prev, url].slice(0, maxImgs);
          });
          setPromptDisabled(false);
        } else {
          // Standard flow: clear v2v and switch to an I2V sibling model
          setUploadedVideoUrl(null);
          setUploadedVideoName(null);
          setV2vMode(false);

          let targetModelId = selectedModel;
          if (!imageMode) {
            const sibling = currentT2VOrExtend?.family
              ? i2vModels.find((m) => m.family === currentT2VOrExtend.family)
              : null;
            const target = sibling || i2vModels[0];
            targetModelId = target.id;
            setImageMode(true);
            setSelectedModel(target.id);
            setSelectedModelName(target.name);
            applyControlsForModel(target.id, true, false);
          }

          const maxImgs = getMaxImagesForI2VModel(targetModelId);
          if (maxImgs > 2) {
            setUploadedImageUrls((prev) => {
              if (prev.includes(url)) return prev;
              return [...prev, url].slice(0, maxImgs);
            });
          } else {
            setUploadedImageUrls([url]);
          }
          setPromptDisabled(false);
        }
      }
    } catch (err) {
      console.error("[VideoStudio] Image upload failed:", err);
      alert(`Image upload failed: ${err.message}`);
    } finally {
      setImageUploading(false);
      setImageProgress(0);
      if (imageFileInputRef.current) imageFileInputRef.current.value = "";
    }
  };

  const clearImageUpload = () => {
    setUploadedImageUrl(null);
    setUploadedImageUrls([]);
    setUploadedEndImageUrl(null);
    // Motion-control v2v or model with inputs.images_list: keep model, just drop the image
    if (isMotionControlSelection(selectedModel, v2vMode)) return;
    const currentT2V = t2vModels.find((m) => m.id === selectedModel);
    if (currentT2V?.inputs?.images_list) return;
    setImageMode(false);
    const first = t2vModels[0];
    setSelectedModel(first.id);
    setSelectedModelName(first.name);
    applyControlsForModel(first.id, false, false);
    setPromptDisabled(false);
  };

  const removeImageAtIndex = (idx) => {
    const nextUrls = uploadedImageUrls.filter((_, i) => i !== idx);
    setUploadedImageUrls(nextUrls);
    if (nextUrls.length === 0) {
      setUploadedImageUrl(null);
      // Reset to text-to-video if empty list
      if (isMotionControlSelection(selectedModel, v2vMode)) return;
      setImageMode(false);
      const first = t2vModels[0];
      setSelectedModel(first.id);
      setSelectedModelName(first.name);
      applyControlsForModel(first.id, false, false);
      setPromptDisabled(false);
    } else {
      setUploadedImageUrl(nextUrls[0]);
    }
  };

  // ── end-frame upload (FLF i2v models) ──────────────────────────────────────
  const handleEndImageFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Image exceeds 10MB limit.");
      return;
    }
    setEndImageUploading(true);
    setEndImageProgress(0);
    try {
      const url = await uploadFile(apiKey, file, (pct) => {
        setEndImageProgress(pct);
      }, { modelId: selectedModel });
      setUploadedEndImageUrl(url);
    } catch (err) {
      alert(`End frame upload failed: ${err.message}`);
    } finally {
      setEndImageUploading(false);
      setEndImageProgress(0);
      if (endImageFileInputRef.current) endImageFileInputRef.current.value = "";
    }
  };

  const clearEndImage = () => setUploadedEndImageUrl(null);

  // ── video upload ─────────────────────────────────────────────────────────
  const handleVideoFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      alert("Video exceeds 50MB limit.");
      return;
    }
    setVideoUploading(true);
    setVideoProgress(0);
    try {
      const url = await uploadFile(apiKey, file, (pct) => {
        setVideoProgress(pct);
      });
      setUploadedVideoUrl(url);
      setUploadedVideoName(file.name);

      if (isMotionControlSelection(selectedModel, v2vMode)) {
        // Already in motion-control mode — keep model and image, allow prompt
        setPromptDisabled(false);
      } else {
        // Model-native video reference (e.g. Seedance 2.0 Extend with inputs.video_files):
        // keep the current model & mode; just store the video URL as a reference
        const currentT2VOrExtend = t2vModels.find((m) => m.id === selectedModel);
        if (currentT2VOrExtend?.inputs?.video_files) {
          setPromptDisabled(false);
        } else {
          // Default v2v flow (e.g. watermark remover) — auto-pick the first v2v model
          if (imageMode) {
            setUploadedImageUrl(null);
            setImageMode(false);
          }
          setV2vMode(true);
          const firstV2V = v2vModels[0];
          setSelectedModel(firstV2V.id);
          setSelectedModelName(firstV2V.name);
          applyControlsForModel(firstV2V.id, false, true);
          setPrompt("");
          setPromptDisabled(true);
        }
      }
    } catch (err) {
      console.error("[VideoStudio] Video upload failed:", err);
      alert(`Video upload failed: ${err.message}`);
    } finally {
      setVideoUploading(false);
      setVideoProgress(0);
      if (videoFileInputRef.current) videoFileInputRef.current.value = "";
    }
  };

  const clearVideoUpload = () => {
    setUploadedVideoUrl(null);
    setUploadedVideoName(null);
    setV2vMode(false);
    const first = t2vModels[0];
    setSelectedModel(first.id);
    setSelectedModelName(first.name);
    applyControlsForModel(first.id, false, false);
    setPromptDisabled(false);
  };

  // ── model selection from dropdown ─────────────────────────────────────────
  const handleModelSelect = useCallback(
    (m, isV2V) => {
      if (isV2V) {
        setV2vMode(true);
        setImageMode(false);
        const isMC = !!m.imageField;
        if (!isMC) {
          // Single-input v2v (watermark remover etc.) — drop any image
          setUploadedImageUrl(null);
        }
        setSelectedModel(m.id);
        setSelectedModelName(m.name);
        applyControlsForModel(m.id, false, true);
        if (isMC) {
          // Motion-control: prompt is editable, video+image are needed
          setPromptDisabled(false);
        } else {
          setPrompt("");
          setPromptDisabled(true);
        }
      } else {
        if (v2vMode) {
          setV2vMode(false);
          setUploadedVideoUrl(null);
          setUploadedVideoName(null);
          setPromptDisabled(false);
        }
        setSelectedModel(m.id);
        setSelectedModelName(m.name);
        applyControlsForModel(m.id, imageMode, false);
      }
    },
    [v2vMode, imageMode, applyControlsForModel],
  );

  // ── add to local history ──────────────────────────────────────────────────
  const addToLocalHistory = useCallback((entry) => {
    setLocalHistory((prev) => [entry, ...prev].slice(0, 30));
    setActiveHistoryIdx(0);
  }, []);

  // ── show result in canvas ─────────────────────────────────────────────────
  const showVideoInCanvas = useCallback((url, model) => {
    setCanvasUrl(url);
    setCanvasModel(model);
    setShowCanvas(true);
  }, []);

  // ── generate ──────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    const currentModel = getCurrentModel();
    const isExtendMode = currentModel?.requiresRequestId;
    const trimmedPrompt = prompt.trim();

    if (v2vMode) {
      if (!uploadedVideoUrl) {
        alert("Please upload a video first.");
        return;
      }
      if (currentModel?.imageField && !uploadedImageUrl) {
        alert("Please upload a reference image for motion control.");
        return;
      }
      if (currentModel?.promptRequired && !trimmedPrompt) {
        alert("Please describe the motion you want.");
        return;
      }
    } else if (isExtendMode) {
      if (!lastGenerationId) {
        alert(
          "No Seedance 2.0 generation found to extend. Generate a video first.",
        );
        return;
      }
    } else if (imageMode) {
      const maxImgs = getMaxImagesForI2VModel(selectedModel);
      if (maxImgs > 2) {
        if (uploadedImageUrls.length === 0) {
          alert("Please upload at least one reference image first.");
          return;
        }
      } else {
        if (!uploadedImageUrl) {
          alert("Please upload a start frame image first.");
          return;
        }
      }
    } else {
      if (!trimmedPrompt) {
        alert("Please enter a prompt to generate a video.");
        return;
      }
    }

    setGenerating(true);
    setGenerateError(null);

    let hadError = false;

    try {
      let res;

      if (v2vMode) {
        // V2V: dedicated processV2V handles single-input tools (e.g. watermark
        // remover) and motion-control models (which take video + image + prompt)
        const v2vParams = {
          model: selectedModel,
          video_url: uploadedVideoUrl,
        };
        if (currentModel?.imageField && uploadedImageUrl) {
          v2vParams.image_url = uploadedImageUrl;
        }
        if (currentModel?.hasPrompt && trimmedPrompt) {
          v2vParams.prompt = trimmedPrompt;
        }
        res = await processV2V(apiKey, v2vParams);
        if (!res?.url) throw new Error("No video URL returned by API");

        const genId = res.id || Date.now().toString();
        setLastGenerationId(null);
        setLastGenerationModel(null);
        const entry = {
          id: genId,
          url: res.url,
          prompt: currentModel?.hasPrompt ? trimmedPrompt : "",
          model: selectedModel,
          timestamp: new Date().toISOString(),
        };
        addToLocalHistory(entry);
        showVideoInCanvas(res.url, selectedModel);
        if (onGenerationComplete)
          onGenerationComplete({
            url: res.url,
            model: selectedModel,
            prompt: currentModel?.hasPrompt ? trimmedPrompt : "",
            type: "video",
          });
      } else if (imageMode) {
        const maxImgs = getMaxImagesForI2VModel(selectedModel);
        const i2vParams = { model: selectedModel };
        if (maxImgs > 2) {
          i2vParams.images_list = uploadedImageUrls;
        } else {
          i2vParams.image_url = uploadedImageUrl;
        }
        if (trimmedPrompt) i2vParams.prompt = trimmedPrompt;
        i2vParams.aspect_ratio = selectedAr;
        const i2vModel = i2vModels.find((m) => m.id === selectedModel);
        if (uploadedEndImageUrl && i2vModel?.lastImageField) {
          i2vParams.last_image = uploadedEndImageUrl;
        }
        const durations = getDurationsForI2VModel(selectedModel);
        if (durations.length > 0) i2vParams.duration = selectedDuration;
        const resolutions = getResolutionsForI2VModel(selectedModel);
        if (resolutions.length > 0) i2vParams.resolution = selectedResolution;
        if (selectedQuality) i2vParams.quality = selectedQuality;
        if (selectedMode) i2vParams.mode = selectedMode;
        if (showEffect && selectedEffect) i2vParams.name = selectedEffect;

        res = await generateI2V(apiKey, i2vParams);
        if (!res?.url) throw new Error("No video URL returned by API");

        const genId = res.id || Date.now().toString();
        if (selectedModel === "seedance-v2.0-i2v") {
          setLastGenerationId(genId);
          setLastGenerationModel(selectedModel);
        } else {
          setLastGenerationId(null);
          setLastGenerationModel(null);
        }
        const entry = {
          id: genId,
          url: res.url,
          prompt: trimmedPrompt,
          model: selectedModel,
          aspect_ratio: selectedAr,
          duration: selectedDuration,
          timestamp: new Date().toISOString(),
        };
        addToLocalHistory(entry);
        showVideoInCanvas(res.url, selectedModel);
        if (onGenerationComplete)
          onGenerationComplete({
            url: res.url,
            model: selectedModel,
            prompt: trimmedPrompt,
            type: "video",
          });
      } else {
        // T2V (including extend mode)
        const params = { model: selectedModel };
        if (trimmedPrompt) params.prompt = trimmedPrompt;

        if (isExtendMode) {
          params.request_id = lastGenerationId;
          // Optional reference media for Seedance 2.0 Extend:
          // images map to @image2…@image9 and videos map to @video1…@video3 in the prompt
          if (uploadedImageUrls.length > 0) {
            params.images_list = uploadedImageUrls;
          }
          if (uploadedVideoUrl) {
            params.videos_list = [uploadedVideoUrl];
          }
        } else {
          params.aspect_ratio = selectedAr;
        }

        const durations = getDurationsForModel(selectedModel);
        if (durations.length > 0) params.duration = selectedDuration;
        const resolutions = getResolutionsForVideoModel(selectedModel);
        if (resolutions.length > 0) params.resolution = selectedResolution;
        if (selectedQuality) params.quality = selectedQuality;
        if (selectedMode) params.mode = selectedMode;

        res = await generateVideo(apiKey, params);
        if (!res?.url) throw new Error("No video URL returned by API");

        const genId = res.id || Date.now().toString();
        if (
          selectedModel === "seedance-v2.0-t2v" ||
          selectedModel === "seedance-v2.0-i2v"
        ) {
          setLastGenerationId(genId);
          setLastGenerationModel(selectedModel);
        } else {
          setLastGenerationId(null);
          setLastGenerationModel(null);
        }
        const entry = {
          id: genId,
          url: res.url,
          prompt: trimmedPrompt,
          model: selectedModel,
          aspect_ratio: selectedAr,
          duration: selectedDuration,
          timestamp: new Date().toISOString(),
        };
        addToLocalHistory(entry);
        showVideoInCanvas(res.url, selectedModel);
        if (onGenerationComplete)
          onGenerationComplete({
            url: res.url,
            model: selectedModel,
            prompt: trimmedPrompt,
            type: "video",
          });
      }
    } catch (e) {
      hadError = true;
      console.error("[VideoStudio]", e);
      setGenerateError(e.message?.slice(0, 80) || "Generation failed");
      setTimeout(() => setGenerateError(null), 4000);
      onGenerationError?.(e.message?.slice(0, 120) || "Video generation failed");
    } finally {
      setGenerating(false);
    }
  }, [
    apiKey,
    prompt,
    v2vMode,
    imageMode,
    selectedModel,
    selectedAr,
    selectedDuration,
    selectedResolution,
    selectedQuality,
    selectedMode,
    selectedEffect,
    showEffect,
    uploadedImageUrl,
    uploadedImageUrls,
    uploadedVideoUrl,
    lastGenerationId,
    getCurrentModel,
    addToLocalHistory,
    showVideoInCanvas,
    onGenerationComplete,
  ]);

  // ── reset to prompt bar ───────────────────────────────────────────────────
  const resetToPromptBar = useCallback(() => {
    setShowCanvas(false);
  }, []);

  const handleNewPrompt = useCallback(() => {
    resetToPromptBar();
    setPrompt("");
    setUploadedImageUrl(null);
    setUploadedImageUrls([]);
    setImageMode(false);
    setUploadedVideoUrl(null);
    setUploadedVideoName(null);
    setV2vMode(false);
    const first = t2vModels[0];
    setSelectedModel(first.id);
    setSelectedModelName(first.name);
    applyControlsForModel(first.id, false, false);
    setPromptDisabled(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [resetToPromptBar, applyControlsForModel]);

  const handleExtend = useCallback(() => {
    if (!lastGenerationId) return;
    resetToPromptBar();
    setPrompt("");
    setUploadedImageUrl(null);
    setUploadedImageUrls([]);
    setImageMode(false);
    setSelectedModel("seedance-v2.0-extend");
    setSelectedModelName("Seedance 2.0 Extend");
    applyControlsForModel("seedance-v2.0-extend", false, false);
    setPromptDisabled(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [lastGenerationId, resetToPromptBar, applyControlsForModel]);

  // ── derived UI values ────────────────────────────────────────────────────
  const isSeedance2Canvas =
    canvasModel === "seedance-v2.0-t2v" || canvasModel === "seedance-v2.0-i2v";
  const currentModelObj = getCurrentModel();
  const isExtendMode = currentModelObj?.requiresRequestId;

  const promptPlaceholder = v2vMode
    ? currentModelObj?.imageField
      ? currentModelObj?.promptRequired
        ? "Describe the motion"
        : "Describe the motion (optional)"
      : "Video ready — click Generate to remove watermark"
    : imageMode
      ? "Describe the motion or effect (optional)"
      : isExtendMode
        ? "Optional: describe how to continue the video..."
        : "Describe the video you want to create";

  const toggleDropdown = (type) => (e) => {
    e.stopPropagation();
    setOpenDropdown((prev) => (prev === type ? null : type));
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col items-center justify-center bg-app-bg relative overflow-hidden"
    >
      {/* ── CENTRAL GALLERY AREA ── */}
      <div className="flex-1 w-full max-w-7xl mx-auto overflow-y-auto custom-scrollbar pb-40 lg:pb-32 px-2">
        {history.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full pt-4 animate-fade-in-up">
            {history.map((entry, idx) => {
              const isSeedance2 = entry.model === "seedance-v2.0-t2v" || entry.model === "seedance-v2.0-i2v";
              return (
                <div
                  key={entry.id || idx}
                  className="relative group rounded-lg overflow-hidden border border-ink/15 bg-surface shadow-xl hover:border-primary/50 transition-all duration-300 flex flex-col"
                >
                  <video
                    src={entry.url}
                    className="w-full aspect-video object-cover bg-ink/10 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setFullscreenUrl(entry.url)}
                    controls={false}
                    loop
                    muted
                    playsInline
                    onMouseOver={(e) => e.target.play()}
                    onMouseOut={(e) => {
                      e.target.pause();
                      e.target.currentTime = 0;
                    }}
                  />
                  
                  {/* Overlay actions */}
                  <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      title="Fullscreen"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFullscreenUrl(entry.url);
                      }}
                      className="p-2 bg-black/60 backdrop-blur-md rounded-full text-ink hover:bg-primary hover:text-ink transition-all border border-ink/15"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="15 3 21 3 21 9" />
                        <polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      title="Download"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadFile(entry.url, `video-${entry.id || idx}.mp4`);
                      }}
                      className="p-2 bg-black/60 backdrop-blur-md rounded-full text-ink hover:bg-primary hover:text-ink transition-all border border-ink/15"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                      </svg>
                    </button>
                    {isSeedance2 && (
                      <button
                        type="button"
                        title="Extend this video using Seedance 2.0 Extend"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLastGenerationId(entry.id);
                          handleExtend();
                        }}
                        className="p-2 bg-black/60 backdrop-blur-md rounded-full text-ink hover:bg-primary hover:text-ink transition-all border border-ink/15"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Are you sure you want to delete this generated item?")) {
                          setLocalHistory(prev => prev.filter((_, i) => i !== idx));
                        }
                      }}
                      className="p-2 bg-black/60 backdrop-blur-md rounded-full text-red-600 hover:bg-red-500 hover:text-white transition-all border border-ink/15"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </div>

                  {/* Prompt & Details */}
                  <div className="p-3 bg-black/80 backdrop-blur-sm border-t border-ink/10 flex-1 flex flex-col justify-between gap-2">
                    <p className="text-ink/85 text-xs line-clamp-3 leading-relaxed" title={entry.prompt}>
                      {entry.prompt || "No prompt provided"}
                    </p>
                    <div className="flex items-center justify-between mt-1 flex-wrap gap-1">
                      <span className="text-[10px] font-bold text-primary px-2 py-0.5 bg-primary/10 rounded border border-primary/20 whitespace-nowrap">
                        {entry.model?.replace("-", " ")}
                      </span>
                      <div className="flex gap-2">
                        {entry.resolution && (
                          <span className="text-[10px] text-ink/65">{entry.resolution}</span>
                        )}
                        {entry.duration && (
                          <span className="text-[10px] text-ink/65">{entry.duration}s</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full animate-fade-in-up transition-all duration-700 min-h-[50vh]">
            {/* Overlapping floating cards */}
            <div className="flex items-center justify-center gap-1.5 md:gap-3 mb-10 select-none scale-90 sm:scale-100">
              <div className="w-18 h-22 sm:w-24 sm:h-28 rounded-2xl border border-ink/15 shadow-2xl -rotate-[12deg] transform hover:rotate-0 hover:scale-110 hover:z-20 transition-all duration-300 overflow-hidden bg-ink/5 flex-shrink-0">
                <img
                  src="https://d3adwkbyhxyrtq.cloudfront.net/webassets/videomodels/sdxl-image.avif"
                  alt="Creative asset 1"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="w-18 h-22 sm:w-24 sm:h-28 rounded-2xl border border-ink/15 shadow-2xl -rotate-[4deg] transform hover:rotate-0 hover:scale-110 hover:z-20 transition-all duration-300 overflow-hidden bg-ink/5 -ml-3 sm:-ml-4 flex-shrink-0">
                <img
                  src="https://d3adwkbyhxyrtq.cloudfront.net/webassets/videomodels/chroma-image.avif"
                  alt="Creative asset 2"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="w-18 h-18 sm:w-24 sm:h-24 rounded-full border border-ink/15 shadow-2xl rotate-[6deg] transform hover:rotate-0 hover:scale-110 hover:z-20 transition-all duration-300 overflow-hidden bg-ink/5 -ml-3 sm:-ml-4 flex-shrink-0">
                <img
                  src="https://d3adwkbyhxyrtq.cloudfront.net/webassets/videomodels/neta-lumina.avif"
                  alt="Creative asset 3"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="w-18 h-22 sm:w-24 sm:h-28 rounded-2xl border border-ink/15 shadow-2xl rotate-[12deg] transform hover:rotate-0 hover:scale-110 hover:z-20 transition-all duration-300 overflow-hidden bg-ink/5 -ml-3 sm:-ml-4 flex-shrink-0">
                <img
                  src="https://d3adwkbyhxyrtq.cloudfront.net/webassets/videomodels/perfect-pony-xl.avif"
                  alt="Creative asset 4"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-center px-4 flex flex-col items-center">
              <span className="text-ink font-black uppercase text-xl sm:text-3xl tracking-wide mb-1 opacity-90">START CREATING WITH</span>
              <span className="text-accent font-black uppercase text-2xl sm:text-4xl sm:mt-1 tracking-tight">
                {selectedModelName}
              </span>
            </h1>
            <p className="text-ink/65 text-xs sm:text-sm font-medium tracking-wide text-center max-w-lg leading-relaxed px-4">
              Animate images into stunning AI videos with motion effects
            </p>
          </div>
        )}
      </div>

      {/* ── BOTTOM PROMPT BAR ── */}
      <div className="absolute bottom-4 w-full max-w-[95%] lg:max-w-4xl z-40 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
        <div className="w-full bg-gradient-to-b from-surface/90 via-surface/90 to-surface/95 backdrop-blur-2xl rounded-[2rem] border border-ink/10 p-4 flex flex-col gap-3 shadow-[0_15px_50px_rgba(0,0,0,0.8)]">
          <div className="flex flex-col gap-3">
            {/* Inline list of uploaded media files */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Main image preview */}
              {uploadedImageUrl && (
                <div className="relative w-12 h-12 rounded-xl border border-ink/15 overflow-hidden shadow-md group">
                  <img src={uploadedImageUrl} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={clearImageUpload}
                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 hover:bg-surface-2 rounded-full flex items-center justify-center text-ink/90 hover:text-ink text-[8px] border border-ink/10"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* End frame image preview */}
              {uploadedEndImageUrl && (
                <div className="relative w-12 h-12 rounded-xl border border-ink/15 overflow-hidden shadow-md group">
                  <img src={uploadedEndImageUrl} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={clearEndImage}
                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 hover:bg-surface-2 rounded-full flex items-center justify-center text-ink/90 hover:text-ink text-[8px] border border-ink/10"
                  >
                    ×
                  </button>
                  <span className="absolute bottom-0.5 left-0.5 px-1 h-3.5 bg-black/60 rounded-md text-[7px] font-black text-accent leading-none flex items-center justify-center pointer-events-none">
                    END
                  </span>
                </div>
              )}

              {/* Video preview */}
              {uploadedVideoUrl && (
                <div className="relative w-12 h-12 rounded-xl border border-ink/15 overflow-hidden shadow-md group">
                  <video src={uploadedVideoUrl} className="w-full h-full object-cover" muted />
                  <button
                    type="button"
                    onClick={clearVideoUpload}
                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 hover:bg-surface-2 rounded-full flex items-center justify-center text-ink/90 hover:text-ink text-[8px] border border-ink/10"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Multiple images layout if supported */}
              {imageMode && getMaxImagesForI2VModel(selectedModel) > 2 && (
                <>
                  {uploadedImageUrls.map((url, idx) => (
                    <div key={idx} className="relative w-12 h-12 rounded-xl border border-ink/15 overflow-hidden shadow-md group">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImageAtIndex(idx)}
                        className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 hover:bg-surface-2 rounded-full flex items-center justify-center text-ink/90 hover:text-ink text-[8px] border border-ink/10"
                      >
                        ×
                      </button>
                      <span className="absolute bottom-0.5 right-0.5 px-1 h-3.5 bg-black/60 rounded-full text-[8px] font-black text-accent leading-none flex items-center justify-center pointer-events-none">
                        {idx + 1}
                      </span>
                    </div>
                  ))}
                </>
              )}

              {/* Upload trigger buttons */}
              {/* Image upload button — shown when the model accepts image input:
                  • T2V mode: uploading an image auto-switches to the sibling I2V model
                  • I2V mode: uploading the start-frame (multi-image logic applies)
                  • V2V motion-control: reference image is required alongside the video
                  • T2V with inputs.images_list: optional reference images (e.g. Seedance 2.0 Extend)
                  • Hidden in regular V2V mode (watermark remover etc. needs no image)
                  • Hidden for extend-type models without inputs.images_list */}
              {((!v2vMode || isMotionControlSelection(selectedModel, v2vMode)) && (!isExtendMode || currentModelObj?.inputs?.images_list)) && (
                getMaxImagesForI2VModel(selectedModel) > 2 ? (
                  uploadedImageUrls.length < getMaxImagesForI2VModel(selectedModel) && (
                    <div className="relative">
                      <input
                        ref={imageFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageFileChange}
                      />
                      <button
                        type="button"
                        title="Upload reference image"
                        onClick={() => imageFileInputRef.current?.click()}
                        className="w-12 h-12 shrink-0 rounded-xl border border-dashed border-ink/15 hover:border-accent/40 bg-ink/5 hover:bg-ink/5 transition-all flex items-center justify-center relative overflow-hidden group"
                      >
                        {imageUploading ? (
                          <div className="flex flex-col items-center justify-center w-full h-full absolute inset-0 bg-black/80 z-20 backdrop-blur-[2px]">
                            <svg className="w-8 h-8 -rotate-90">
                              <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" fill="transparent" className="text-ink/45" />
                              <circle
                                cx="16"
                                cy="16"
                                r="14"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="transparent"
                                strokeDasharray={88}
                                strokeDashoffset={88 - (88 * imageProgress) / 100}
                                className="text-accent transition-all duration-300"
                              />
                            </svg>
                            <span className="absolute text-[9px] font-black text-accent leading-none">{imageProgress}%</span>
                          </div>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-ink/65 group-hover:text-accent transition-colors">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )
                ) : (
                  !uploadedImageUrl && (
                    <div className="relative">
                      <input
                        ref={imageFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageFileChange}
                      />
                      <button
                        type="button"
                        title="Upload reference image"
                        onClick={() => imageFileInputRef.current?.click()}
                        className="w-12 h-12 shrink-0 rounded-xl border border-dashed border-ink/15 hover:border-accent/40 bg-ink/5 hover:bg-ink/5 transition-all flex items-center justify-center relative overflow-hidden group"
                      >
                        {imageUploading ? (
                          <div className="flex flex-col items-center justify-center w-full h-full absolute inset-0 bg-black/80 z-20 backdrop-blur-[2px]">
                            <svg className="w-8 h-8 -rotate-90">
                              <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" fill="transparent" className="text-ink/45" />
                              <circle
                                cx="16"
                                cy="16"
                                r="14"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="transparent"
                                strokeDasharray={88}
                                strokeDashoffset={88 - (88 * imageProgress) / 100}
                                className="text-accent transition-all duration-300"
                              />
                            </svg>
                            <span className="absolute text-[9px] font-black text-accent leading-none">{imageProgress}%</span>
                          </div>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-ink/65 group-hover:text-accent transition-colors">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )
                )
              )}

              {/* End frame image button */}
              {imageMode && i2vModels.find((m) => m.id === selectedModel)?.lastImageField && !uploadedEndImageUrl && (
                <div className="relative">
                  <input
                    ref={endImageFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleEndImageFileChange}
                  />
                  <button
                    type="button"
                    title="Upload end frame (optional)"
                    onClick={() => endImageFileInputRef.current?.click()}
                    className="w-12 h-12 shrink-0 rounded-xl border border-dashed border-ink/15 hover:border-accent/40 bg-ink/5 hover:bg-ink/5 transition-all flex items-center justify-center relative overflow-hidden group"
                  >
                    {endImageUploading ? (
                      <div className="flex flex-col items-center justify-center w-full h-full absolute inset-0 bg-black/80 z-20 backdrop-blur-[2px]">
                        <svg className="w-8 h-8 -rotate-90">
                          <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" fill="transparent" className="text-ink/45" />
                          <circle
                            cx="16"
                            cy="16"
                            r="14"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="transparent"
                            strokeDasharray={88}
                            strokeDashoffset={88 - (88 * endImageProgress) / 100}
                            className="text-accent transition-all duration-300"
                          />
                        </svg>
                        <span className="absolute text-[9px] font-black text-accent leading-none">{endImageProgress}%</span>
                      </div>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-ink/65 group-hover:text-accent transition-colors">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    )}
                  </button>
                </div>
              )}

              {/* Video upload button — shown when a V2V model is active, OR when
                  the current model has inputs.video_files (e.g. Seedance 2.0 Extend). */}
              {!uploadedVideoUrl && (v2vMode || currentModelObj?.inputs?.video_files) && (
                <div className="relative">
                  <input
                    ref={videoFileInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={handleVideoFileChange}
                  />
                  <button
                    type="button"
                    title="Upload video to remove watermark"
                    onClick={() => videoFileInputRef.current?.click()}
                    className="w-12 h-12 shrink-0 rounded-xl border border-dashed border-ink/15 hover:border-accent/40 bg-ink/5 hover:bg-ink/5 transition-all flex items-center justify-center relative overflow-hidden group"
                  >
                    {videoUploading ? (
                      <div className="flex flex-col items-center justify-center w-full h-full absolute inset-0 bg-black/80 z-20 backdrop-blur-[2px]">
                        <svg className="w-8 h-8 -rotate-90">
                          <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" fill="transparent" className="text-ink/45" />
                          <circle
                            cx="16"
                            cy="16"
                            r="14"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="transparent"
                            strokeDasharray={88}
                            strokeDashoffset={88 - (88 * videoProgress) / 100}
                            className="text-accent transition-all duration-300"
                          />
                        </svg>
                        <span className="absolute text-[9px] font-black text-accent leading-none">{videoProgress}%</span>
                      </div>
                    ) : (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className="text-ink/65 group-hover:text-accent transition-colors"
                      >
                        <polygon points="23 7 16 12 23 17 23 7" fill="currentColor" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" fill="currentColor" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Prompt textarea */}
            <div className="flex-1 flex flex-col gap-1">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={handlePromptInput}
                placeholder={promptPlaceholder}
                disabled={promptDisabled}
                rows={1}
                className="w-full bg-transparent border-none text-ink text-sm placeholder:text-ink/45 focus:outline-none resize-none pt-1 leading-relaxed min-h-[40px] max-h-[150px] md:max-h-[250px] overflow-y-auto custom-scrollbar disabled:opacity-40"
              />
            </div>
          </div>

          {/* Extend banner */}
          {isExtendMode && (
            <div className="flex items-center gap-2 px-3 py-1.5 mx-3 bg-primary/5 border border-primary/10 rounded-lg text-[10px] text-primary/80 font-medium tracking-tight">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              <span>Extending previous Seedance 2.0 generation</span>
            </div>
          )}

          {/* Bottom row: controls + generate */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-3 border-t border-ink/10 relative">
            <div className="flex items-center gap-2 relative flex-wrap pb-1 md:pb-0">
              {/* Model btn */}
              <div className="relative">
                <button
                  type="button"
                  onClick={toggleDropdown("model")}
                  className="h-[34px] flex items-center gap-2 px-3.5 bg-surface/60 hover:bg-surface-2/80 rounded-md transition-all border border-ink/10 group whitespace-nowrap shadow-inner"
                >
                  <div className="w-4 h-4 rounded overflow-hidden shrink-0 flex items-center justify-center bg-ink/5">
                    {(() => {
                      const allCurrentModels = [...t2vModels, ...i2vModels, ...v2vModels];
                      const selectedModelObj = allCurrentModels.find(m => m.id === selectedModel);
                      const selectedModelProvider = selectedModelObj?.provider || 'muapi';
                      return PROVIDER_LOGOS[selectedModelProvider] ? (
                        <img 
                          src={PROVIDER_LOGOS[selectedModelProvider]} 
                          alt="" 
                          className={`w-full h-full object-contain ${invertLogos.includes(selectedModelProvider) ? "invert" : ""}`} 
                        />
                      ) : (
                        <span className="text-[9px] font-bold text-white uppercase">V</span>
                      );
                    })()}
                  </div>
                  <span className="text-xs font-semibold text-ink/85 group-hover:text-accent transition-colors">
                    {selectedModelName}
                  </span>
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="opacity-20 group-hover:opacity-100 transition-opacity"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {openDropdown === "model" && (
                  <div
                    ref={dropdownRef}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-[calc(100%+12px)] left-0 z-50 bg-surface rounded-[1.5rem] p-3.5 shadow-2xl border border-ink/10 w-[calc(100vw-2rem)] md:w-[480px] max-w-md md:max-w-none"
                  >
                    <ModelDropdown
                      imageMode={imageMode}
                      selectedModel={selectedModel}
                      onSelect={handleModelSelect}
                      onClose={() => setOpenDropdown(null)}
                    />
                  </div>
                )}
              </div>

              {/* Aspect ratio btn */}
              {showAr && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={toggleDropdown("ar")}
                    className="h-[34px] flex items-center gap-2 px-3.5 bg-surface/60 hover:bg-surface-2/80 rounded-md transition-all border border-ink/10 group whitespace-nowrap shadow-inner"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="opacity-40 text-ink"
                    >
                      <rect
                        x="3"
                        y="3"
                        width="18"
                        height="18"
                        rx="2"
                        ry="2"
                      />
                    </svg>
                    <span className="text-[11px] font-semibold text-ink/85 group-hover:text-accent transition-colors">
                      {selectedAr}
                    </span>
                  </button>
                  {openDropdown === "ar" && (
                    <div
                      ref={dropdownRef}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute bottom-[calc(100%+12px)] left-0 z-50 bg-surface/95 rounded-xl p-3.5 max-h-80 overflow-y-auto custom-scrollbar shadow-[0_10px_40px_rgba(0,0,0,0.8)] border border-ink/10 backdrop-blur-2xl min-w-[160px]"
                    >
                      <div className="text-xs font-semibold text-ink/55 uppercase tracking-wider pb-2 border-b border-ink/10 mb-2 px-1">
                        Aspect Ratio
                      </div>
                      <div className="flex flex-col gap-1">
                        {getCurrentAspectRatios(selectedModel).map((r) => (
                          <div
                            key={r}
                            className="flex items-center justify-between p-2.5 px-3 hover:bg-accent/10 hover:text-ink rounded-xl cursor-pointer transition-all group/opt"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAr(r);
                              setOpenDropdown(null);
                            }}
                          >
                            <span className="text-xs font-semibold text-ink/85 group-hover/opt:text-accent transition-colors">
                              {r}
                            </span>
                            {selectedAr === r && <CheckSvg />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Effect btn */}
              {showEffect && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={toggleDropdown("effect")}
                    className="h-[34px] flex items-center gap-2 px-3.5 bg-surface/60 hover:bg-surface-2/80 rounded-md transition-all border border-ink/10 group whitespace-nowrap shadow-inner"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="opacity-40 text-ink"
                    >
                      <path d="M5 3l14 9-14 9V3z" />
                    </svg>
                    <span className="text-[11px] font-semibold text-ink/85 group-hover:text-accent transition-colors max-w-[140px] truncate">
                      {selectedEffect || "Effect"}
                    </span>
                  </button>
                  {openDropdown === "effect" && (
                    <div
                      ref={dropdownRef}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute bottom-[calc(100%+12px)] left-0 z-50 bg-surface/95 rounded-xl p-3.5 max-h-80 overflow-y-auto custom-scrollbar shadow-[0_10px_40px_rgba(0,0,0,0.8)] border border-ink/10 backdrop-blur-2xl min-w-[200px]"
                    >
                      <div className="text-xs font-semibold text-ink/55 uppercase tracking-wider pb-2 border-b border-ink/10 mb-2 px-1">
                        Effect Type
                      </div>
                      <div className="flex flex-col gap-1">
                        {getEffectsForI2VModel(selectedModel).map((eff) => (
                          <div
                            key={eff}
                            className="flex items-center justify-between p-2.5 px-3 hover:bg-accent/10 hover:text-ink rounded-xl cursor-pointer transition-all group/opt"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEffect(eff);
                              setOpenDropdown(null);
                            }}
                          >
                            <span className="text-xs font-semibold text-ink/85 group-hover/opt:text-accent transition-colors">
                              {eff}
                            </span>
                            {selectedEffect === eff && <CheckSvg />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Duration btn */}
              {showDuration && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={toggleDropdown("duration")}
                    className="h-[34px] flex items-center gap-2 px-3.5 bg-surface/60 hover:bg-surface-2/80 rounded-md transition-all border border-ink/10 group whitespace-nowrap shadow-inner"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="opacity-40 text-ink"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span className="text-xs font-semibold text-ink/85 group-hover:text-accent transition-colors">
                      {selectedDuration}s
                    </span>
                  </button>
                  {openDropdown === "duration" && (
                    <div
                      ref={dropdownRef}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute bottom-[calc(100%+12px)] left-0 z-50 bg-surface/95 rounded-xl p-3.5 shadow-[0_10px_40px_rgba(0,0,0,0.8)] border border-ink/10 backdrop-blur-2xl min-w-[140px]"
                    >
                      <div className="text-xs font-semibold text-ink/55 uppercase tracking-wider pb-2 border-b border-ink/10 mb-2 px-1">
                        Duration
                      </div>
                      <div className="flex flex-col gap-1">
                        {getCurrentDurations(selectedModel).map((d) => (
                          <div
                            key={d}
                            className="flex items-center justify-between p-2.5 px-3 hover:bg-accent/10 hover:text-ink rounded-xl cursor-pointer transition-all group/opt"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDuration(d);
                              setOpenDropdown(null);
                            }}
                          >
                            <span className="text-xs font-semibold text-ink/85 group-hover/opt:text-accent transition-colors">
                              {d}s
                            </span>
                            {selectedDuration === d && <CheckSvg />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Resolution btn */}
              {showResolution && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={toggleDropdown("resolution")}
                    className="h-[34px] flex items-center gap-2 px-3.5 bg-surface/60 hover:bg-surface-2/80 rounded-md transition-all border border-ink/10 group whitespace-nowrap shadow-inner"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="opacity-40 text-ink"
                    >
                      <polygon points="12 2 22 12 12 22 2 12" />
                    </svg>
                    <span className="text-[11px] font-semibold text-ink/85 group-hover:text-accent transition-colors">
                      {selectedResolution || "720p"}
                    </span>
                  </button>
                  {openDropdown === "resolution" && (
                    <div
                      ref={dropdownRef}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute bottom-[calc(100%+12px)] left-0 z-50 bg-surface/95 rounded-xl p-3.5 shadow-[0_10px_40px_rgba(0,0,0,0.8)] border border-ink/10 backdrop-blur-2xl min-w-[140px]"
                    >
                      <div className="text-xs font-semibold text-ink/55 uppercase tracking-wider pb-2 border-b border-ink/10 mb-2 px-1">
                        Resolution
                      </div>
                      <div className="flex flex-col gap-1">
                        {getCurrentResolutions(selectedModel).map((r) => (
                          <div
                            key={r}
                            className="flex items-center justify-between p-2.5 px-3 hover:bg-accent/10 hover:text-ink rounded-xl cursor-pointer transition-all group/opt"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedResolution(r);
                              setOpenDropdown(null);
                            }}
                          >
                            <span className="text-xs font-semibold text-ink/85 group-hover/opt:text-accent transition-colors">
                              {r}
                            </span>
                            {selectedResolution === r && <CheckSvg />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Generate button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="bg-accent text-white px-7 py-3 rounded-full font-bold text-sm hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 w-full sm:w-auto shadow-lg shadow-accent/20 hover:shadow-accent/35 border border-accent/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <span className="animate-spin inline-block text-white">
                    ◌
                  </span>{" "}
                  Generating...
                </>
              ) : generateError ? (
                `Error: ${generateError}`
              ) : (
                <>
                  <span>Generate</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── FULLSCREEN VIDEO MODAL ── */}
      {fullscreenUrl && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm animate-fade-in"
          onClick={() => setFullscreenUrl(null)}
        >
          <button
            type="button"
            className="absolute top-6 right-6 p-3 bg-ink/10 hover:bg-ink/15 rounded-full text-ink transition-colors border border-ink/15"
            onClick={(e) => {
              e.stopPropagation();
              setFullscreenUrl(null);
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <video 
            src={fullscreenUrl} 
            controls 
            autoPlay 
            loop 
            className="max-w-[95vw] max-h-[95vh] rounded-2xl shadow-2xl object-contain animate-scale-up" 
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
