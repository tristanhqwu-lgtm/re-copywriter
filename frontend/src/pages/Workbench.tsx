import { useState, useEffect, useRef, useCallback } from "react";
import { Copy, Heart, RefreshCw, Check } from "lucide-react";
import api, { pollTask } from "../api/client";
import type { Style, Product, Scene, GeneratedCopy, AsyncTask, GeneratePlatform, ModelChoice } from "../types";

const PLATFORM_OPTIONS: { key: GeneratePlatform; label: string; icon: string; desc: string }[] = [
  { key: "xiaohongshu", label: "小红书", icon: "\ud83d\udcd5", desc: "300-500字种草笔记" },
  { key: "wechat_moments", label: "朋友圈", icon: "\ud83d\udcf1", desc: "50-150字短分享" },
  { key: "douyin", label: "抖音", icon: "\ud83c\udfb5", desc: "100-200字短文案" },
  { key: "video_script", label: "视频脚本", icon: "\ud83c\udfac", desc: "500-800字完整脚本" },
];

const MODEL_OPTIONS: { key: ModelChoice; label: string; desc: string }[] = [
  { key: "gemini", label: "Gemini", desc: "Google AI" },
  { key: "deepseek", label: "DeepSeek", desc: "DeepSeek AI" },
  { key: "kimi", label: "Kimi 2.5", desc: "Moonshot AI" },
];

export default function Workbench() {
  const [styles, setStyles] = useState<Style[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [selectedScene, setSelectedScene] = useState<number | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<GeneratePlatform>("xiaohongshu");
  const [selectedModel, setSelectedModel] = useState<ModelChoice>("gemini");
  const [count, setCount] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [taskError, setTaskError] = useState("");
  const [results, setResults] = useState<GeneratedCopy[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const stopPollRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoadingData(true);
      setFetchError("");
      try {
        const [stylesRes, productsRes, scenesRes] = await Promise.all([
          api.get<Style[]>("/styles/"),
          api.get<Product[]>("/products/?skip=0&limit=50"),
          api.get<Scene[]>("/scenes/"),
        ]);
        setStyles(stylesRes.data);
        setProducts(productsRes.data);
        setScenes(scenesRes.data);
      } catch {
        setFetchError("加载数据失败，请刷新重试");
      } finally {
        setLoadingData(false);
      }
    };
    fetchAll();
  }, []);

  useEffect(() => {
    return () => { stopPollRef.current?.(); };
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedStyle || !selectedProduct) return;
    setGenerating(true);
    setProgress(0);
    setTaskError("");
    setResults([]);
    try {
      const payload: Record<string, unknown> = {
        product_id: selectedProduct,
        style_id: selectedStyle,
        count,
        platform: selectedPlatform,
        model: selectedModel,
      };
      if (selectedScene) payload.scene_id = selectedScene;
      const { data } = await api.post<AsyncTask>("/generate/", payload);
      stopPollRef.current = pollTask(data.id, (taskData) => {
        const task = taskData as unknown as AsyncTask;
        setProgress(task.progress ?? 0);
        if (task.status === "completed") {
          setGenerating(false);
          const copies = (task.result as unknown as { copies: GeneratedCopy[] })?.copies ?? [];
          setResults(copies);
          stopPollRef.current = null;
        } else if (task.status === "failed") {
          setGenerating(false);
          setTaskError(task.error || "生成失败，请重试");
          stopPollRef.current = null;
        }
      });
    } catch {
      setGenerating(false);
      setTaskError("请求失败，请重试");
    }
  }, [selectedStyle, selectedProduct, selectedScene, selectedPlatform, selectedModel, count]);

  const handleCopy = useCallback(async (copy: GeneratedCopy) => {
    const text = `${copy.title}\n\n${copy.content}\n\n${copy.hashtags.map((t) => t.startsWith("#") ? t : `#${t}`).join(" ")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(copy.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* */ }
  }, []);

  const handleFavorite = useCallback(async (copy: GeneratedCopy) => {
    try {
      await api.put(`/generate/history/${copy.id}`, { is_favorite: !copy.is_favorite });
      setResults((prev) => prev.map((c) => c.id === copy.id ? { ...c, is_favorite: !c.is_favorite } : c));
    } catch { /* */ }
  }, []);

  const canGenerate = selectedStyle !== null && selectedProduct !== null && !generating;

  if (loadingData) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <RefreshCw size={24} className="text-[#B8956A] animate-spin" />
        <p className="text-[#B5AE9E] mt-4 text-xs tracking-[0.15em]">加 载 中</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-red-400 text-sm">{fetchError}</p>
        <button onClick={() => window.location.reload()} className="mt-6 px-8 py-2.5 bg-[#3D3832] text-white rounded-lg text-xs tracking-[0.15em]">
          重新加载
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="pt-2">
        <h1 className="text-xl font-light tracking-[0.15em] text-[#2A2621]">文案工作台</h1>
        <div className="w-8 h-px bg-[#D4CFC3] mt-2" />
      </div>

      {/* Step 1: Select Style */}
      <section>
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-[#8C8475] mb-4 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#3D3832] text-white text-[10px] flex items-center justify-center">1</span>
          选择风格
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {styles.map((style) => (
            <button
              key={style.id}
              onClick={() => setSelectedStyle(style.id)}
              className={`flex-shrink-0 w-36 p-4 rounded-lg bg-white text-left transition-all ${
                selectedStyle === style.id ? "ring-1 ring-[#3D3832]" : "ring-1 ring-[#EBE7DE]"
              }`}
            >
              <p className="font-light text-sm text-[#2A2621] truncate">{style.name}</p>
              <p className="text-[10px] text-[#B5AE9E] mt-1 tracking-wide">{style.source_count ?? 0} 篇素材</p>
            </button>
          ))}
          {styles.length === 0 && <p className="text-xs text-[#B5AE9E] tracking-wide">暂无风格，请先添加</p>}
        </div>
      </section>

      {/* Step 2: Select Product */}
      <section>
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-[#8C8475] mb-4 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#3D3832] text-white text-[10px] flex items-center justify-center">2</span>
          选择产品
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {products.map((product) => (
            <button
              key={product.id}
              onClick={() => setSelectedProduct(product.id)}
              className={`flex-shrink-0 w-40 p-4 rounded-lg bg-white text-left transition-all ${
                selectedProduct === product.id ? "ring-1 ring-[#3D3832]" : "ring-1 ring-[#EBE7DE]"
              }`}
            >
              <p className="font-light text-sm text-[#2A2621] truncate">{product.name}</p>
              <p className="text-[10px] text-[#B8956A] mt-1">
                {product.price ? `¥${product.price}` : ""}{product.spec ? ` / ${product.spec}` : ""}
              </p>
              {product.top_notes && <p className="text-[10px] text-[#B5AE9E] mt-1.5 truncate">前调: {product.top_notes}</p>}
            </button>
          ))}
          {products.length === 0 && <p className="text-xs text-[#B5AE9E] tracking-wide">暂无产品，请先添加</p>}
        </div>
      </section>

      {/* Step 3: Select Scene */}
      <section>
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-[#8C8475] mb-4 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#3D3832] text-white text-[10px] flex items-center justify-center">3</span>
          选择场景
          <span className="text-[10px] text-[#D4CFC3] tracking-normal">（可选）</span>
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {selectedScene !== null && (
            <button onClick={() => setSelectedScene(null)} className="flex-shrink-0 w-24 p-4 rounded-lg bg-[#F7F5F0] text-center text-xs text-[#B5AE9E] border border-dashed border-[#D4CFC3]">
              不选择
            </button>
          )}
          {scenes.map((scene) => (
            <button
              key={scene.id}
              onClick={() => setSelectedScene(selectedScene === scene.id ? null : scene.id)}
              className={`flex-shrink-0 w-40 p-4 rounded-lg bg-white text-left transition-all ${
                selectedScene === scene.id ? "ring-1 ring-[#3D3832]" : "ring-1 ring-[#EBE7DE]"
              }`}
            >
              <p className="font-light text-sm text-[#2A2621] truncate">{scene.name}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {scene.keywords?.slice(0, 3).map((kw, i) => (
                  <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-[#F7F5F0] text-[#8C8475]">{kw}</span>
                ))}
              </div>
            </button>
          ))}
          {scenes.length === 0 && <p className="text-xs text-[#B5AE9E] tracking-wide">暂无场景</p>}
        </div>
      </section>

      {/* Step 4: Select Platform */}
      <section>
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-[#8C8475] mb-4 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#3D3832] text-white text-[10px] flex items-center justify-center">4</span>
          选择平台
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {PLATFORM_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSelectedPlatform(opt.key)}
              className={`p-4 rounded-lg bg-white text-left transition-all ${
                selectedPlatform === opt.key ? "ring-1 ring-[#3D3832]" : "ring-1 ring-[#EBE7DE]"
              }`}
            >
              <p className="font-light text-sm text-[#2A2621]">{opt.icon} {opt.label}</p>
              <p className="text-[10px] text-[#B5AE9E] mt-1">{opt.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Step 5: Select AI Model */}
      <section>
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-[#8C8475] mb-4 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#3D3832] text-white text-[10px] flex items-center justify-center">5</span>
          AI 模型
        </h2>
        <div className="flex gap-3">
          {MODEL_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSelectedModel(opt.key)}
              className={`flex-1 py-3 rounded-lg text-center transition-all ${
                selectedModel === opt.key
                  ? "bg-[#3D3832] text-white"
                  : "bg-white text-[#5C564C] ring-1 ring-[#EBE7DE]"
              }`}
            >
              <p className="text-sm font-light">{opt.label}</p>
              <p className={`text-[10px] mt-0.5 ${selectedModel === opt.key ? "text-[#D4CFC3]" : "text-[#B5AE9E]"}`}>{opt.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Count Selector */}
      <section>
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-[#8C8475] mb-4">生成数量</h2>
        <div className="flex gap-3">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              onClick={() => setCount(n)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-light transition-all ${
                count === n
                  ? "bg-[#3D3832] text-white"
                  : "bg-white text-[#5C564C] ring-1 ring-[#EBE7DE]"
              }`}
            >
              {n} 篇
            </button>
          ))}
        </div>
      </section>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        className="w-full py-4 bg-[#3D3832] text-white rounded-lg font-light text-sm tracking-[0.2em] hover:bg-[#2A2621] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {generating ? (
          <span className="flex items-center justify-center gap-2">
            <RefreshCw size={16} className="animate-spin" />
            生 成 中
          </span>
        ) : (
          "生 成 文 案"
        )}
      </button>

      {/* Progress Bar */}
      {generating && (
        <div className="w-full bg-[#EBE7DE] rounded-full h-[3px] overflow-hidden">
          <div className="bg-[#B8956A] h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(progress, 5)}%` }} />
        </div>
      )}

      {/* Error */}
      {taskError && (
        <div className="border border-red-200 rounded-lg p-5 text-center">
          <p className="text-red-400 text-sm">{taskError}</p>
          <button onClick={handleGenerate} className="mt-3 text-xs text-[#3D3832] tracking-[0.1em] underline underline-offset-4">重新生成</button>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <section className="space-y-6">
          <div>
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-[#8C8475]">生成结果</h2>
            <div className="w-6 h-px bg-[#D4CFC3] mt-2" />
          </div>
          {results.map((copy) => (
            <div key={copy.id} className="bg-white rounded-lg p-6 ring-1 ring-[#EBE7DE] space-y-4">
              <h3 className="font-light text-[#2A2621] text-sm leading-relaxed">{copy.title}</h3>
              <div className="text-[13px] text-[#5C564C] leading-[1.9] whitespace-pre-line">{copy.content}</div>
              {copy.hashtags && copy.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {copy.hashtags.map((tag, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-[#F7F5F0] text-[#B8956A]">{tag.startsWith("#") ? tag : `#${tag}`}</span>
                  ))}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4 border-t border-[#EBE7DE]">
                <button
                  onClick={() => handleCopy(copy)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded text-[11px] transition-colors ${
                    copiedId === copy.id ? "bg-green-50 text-green-600" : "text-[#8C8475] hover:bg-[#F7F5F0]"
                  }`}
                >
                  {copiedId === copy.id ? <><Check size={12} /> 已复制</> : <><Copy size={12} /> 复制</>}
                </button>
                <button
                  onClick={() => handleFavorite(copy)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded text-[11px] transition-colors ${
                    copy.is_favorite ? "bg-red-50 text-red-400" : "text-[#8C8475] hover:bg-[#F7F5F0]"
                  }`}
                >
                  <Heart size={12} fill={copy.is_favorite ? "currentColor" : "none"} />
                  {copy.is_favorite ? "已收藏" : "收藏"}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
