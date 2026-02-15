import { useState, useEffect, useRef, useCallback } from "react";
import { Copy, Heart, RefreshCw, Check } from "lucide-react";
import api, { pollTask } from "../api/client";
import type { Style, Product, Scene, GeneratedCopy, AsyncTask, GeneratePlatform } from "../types";

const PLATFORM_OPTIONS: { key: GeneratePlatform; label: string; icon: string; desc: string }[] = [
  { key: "xiaohongshu", label: "小红书", icon: "\ud83d\udcd5", desc: "300-500字种草笔记" },
  { key: "wechat_moments", label: "朋友圈", icon: "\ud83d\udcf1", desc: "50-150字短分享" },
  { key: "douyin", label: "抖音", icon: "\ud83c\udfb5", desc: "100-200字短文案" },
  { key: "video_script", label: "视频脚本", icon: "\ud83c\udfac", desc: "500-800字完整脚本" },
];

export default function Workbench() {
  // Data lists
  const [styles, setStyles] = useState<Style[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);

  // Selections
  const [selectedStyle, setSelectedStyle] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [selectedScene, setSelectedScene] = useState<number | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<GeneratePlatform>("xiaohongshu");
  const [count, setCount] = useState(1);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [taskError, setTaskError] = useState("");
  const [results, setResults] = useState<GeneratedCopy[]>([]);

  // UI state
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState("");

  // Ref to stop polling on unmount
  const stopPollRef = useRef<(() => void) | null>(null);

  // Fetch initial data
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

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopPollRef.current?.();
    };
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
      };
      if (selectedScene) {
        payload.scene_id = selectedScene;
      }

      const { data } = await api.post<AsyncTask>("/generate/", payload);

      // Start polling
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
  }, [selectedStyle, selectedProduct, selectedScene, selectedPlatform, count]);

  const handleCopy = useCallback(async (copy: GeneratedCopy) => {
    const text = `${copy.title}\n\n${copy.content}\n\n${copy.hashtags.map((t) => `#${t}`).join(" ")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(copy.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
    }
  }, []);

  const handleFavorite = useCallback(async (copy: GeneratedCopy) => {
    try {
      await api.put(`/generate/history/${copy.id}`, {
        is_favorite: !copy.is_favorite,
      });
      setResults((prev) =>
        prev.map((c) =>
          c.id === copy.id ? { ...c, is_favorite: !c.is_favorite } : c
        )
      );
    } catch {
      // Ignore
    }
  }, []);

  const canGenerate = selectedStyle !== null && selectedProduct !== null && !generating;

  // Loading state for initial data
  if (loadingData) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[60vh]">
        <RefreshCw size={32} className="text-brand animate-spin" />
        <p className="text-gray-500 mt-4">加载中...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-red-500">{fetchError}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-6 py-2 bg-brand text-white rounded-xl"
        >
          重新加载
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <h1 className="text-xl font-bold text-brand">文案工作台</h1>

      {/* Step 1: Select Style */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand text-white text-xs mr-2">
            1
          </span>
          选择风格
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {styles.map((style) => (
            <button
              key={style.id}
              onClick={() => setSelectedStyle(style.id)}
              className={`flex-shrink-0 w-36 p-4 rounded-2xl bg-white text-left transition-all ${
                selectedStyle === style.id
                  ? "border-2 border-brand shadow-md"
                  : "border-2 border-transparent shadow-sm"
              }`}
            >
              <p className="font-medium text-sm text-gray-800 truncate">
                {style.name}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {style.source_count ?? 0} 篇素材
              </p>
              {style.description && (
                <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                  {style.description}
                </p>
              )}
            </button>
          ))}
          {styles.length === 0 && (
            <p className="text-sm text-gray-400">暂无风格，请先添加</p>
          )}
        </div>
      </section>

      {/* Step 2: Select Product */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand text-white text-xs mr-2">
            2
          </span>
          选择产品
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {products.map((product) => (
            <button
              key={product.id}
              onClick={() => setSelectedProduct(product.id)}
              className={`flex-shrink-0 w-40 p-4 rounded-2xl bg-white text-left transition-all ${
                selectedProduct === product.id
                  ? "border-2 border-brand shadow-md"
                  : "border-2 border-transparent shadow-sm"
              }`}
            >
              <p className="font-medium text-sm text-gray-800 truncate">
                {product.name}
              </p>
              <p className="text-xs text-brand font-medium mt-1">
                {product.price ? `¥${product.price}` : ""}
                {product.spec ? ` / ${product.spec}` : ""}
              </p>
              {product.top_notes && (
                <p className="text-xs text-gray-500 mt-2 truncate">
                  前调: {product.top_notes}
                </p>
              )}
            </button>
          ))}
          {products.length === 0 && (
            <p className="text-sm text-gray-400">暂无产品，请先添加</p>
          )}
        </div>
      </section>

      {/* Step 3: Select Scene (optional) */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand text-white text-xs mr-2">
            3
          </span>
          选择场景
          <span className="text-xs text-gray-400 ml-2">（可选）</span>
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {selectedScene !== null && (
            <button
              onClick={() => setSelectedScene(null)}
              className="flex-shrink-0 w-24 p-4 rounded-2xl bg-gray-100 text-center text-sm text-gray-500 border-2 border-dashed border-gray-300"
            >
              不选择
            </button>
          )}
          {scenes.map((scene) => (
            <button
              key={scene.id}
              onClick={() =>
                setSelectedScene(selectedScene === scene.id ? null : scene.id)
              }
              className={`flex-shrink-0 w-40 p-4 rounded-2xl bg-white text-left transition-all ${
                selectedScene === scene.id
                  ? "border-2 border-brand shadow-md"
                  : "border-2 border-transparent shadow-sm"
              }`}
            >
              <p className="font-medium text-sm text-gray-800 truncate">
                {scene.name}
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {scene.keywords?.slice(0, 3).map((kw, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-50 text-brand"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </button>
          ))}
          {scenes.length === 0 && (
            <p className="text-sm text-gray-400">暂无场景</p>
          )}
        </div>
      </section>

      {/* Step 4: Select Platform */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand text-white text-xs mr-2">
            4
          </span>
          选择平台
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {PLATFORM_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSelectedPlatform(opt.key)}
              className={`p-4 rounded-2xl bg-white text-left transition-all ${
                selectedPlatform === opt.key
                  ? "border-2 border-brand shadow-md"
                  : "border-2 border-transparent shadow-sm"
              }`}
            >
              <p className="font-medium text-sm text-gray-800">
                {opt.icon} {opt.label}
              </p>
              <p className="text-xs text-gray-400 mt-1">{opt.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Count Selector */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">生成数量</h2>
        <div className="flex gap-3">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              onClick={() => setCount(n)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                count === n
                  ? "bg-brand text-white shadow-md"
                  : "bg-white text-gray-600 border border-gray-200"
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
        className="w-full py-4 bg-brand text-white rounded-2xl font-semibold text-base hover:bg-brand-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {generating ? (
          <span className="flex items-center justify-center gap-2">
            <RefreshCw size={18} className="animate-spin" />
            生成中...
          </span>
        ) : (
          "生成文案"
        )}
      </button>

      {/* Progress Bar */}
      {generating && (
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-brand h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(progress, 5)}%` }}
          />
        </div>
      )}

      {/* Error */}
      {taskError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
          <p className="text-red-500 text-sm">{taskError}</p>
          <button
            onClick={handleGenerate}
            className="mt-2 text-sm text-brand font-medium"
          >
            重新生成
          </button>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">生成结果</h2>
          {results.map((copy) => (
            <div
              key={copy.id}
              className="bg-white rounded-2xl p-5 shadow-sm space-y-3"
            >
              <h3 className="font-semibold text-gray-800 text-sm leading-relaxed">
                {copy.title}
              </h3>
              <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {copy.content}
              </div>
              {copy.hashtags && copy.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {copy.hashtags.map((tag, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-1 rounded-full bg-brand-50 text-brand"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => handleCopy(copy)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    copiedId === copy.id
                      ? "bg-green-50 text-green-600"
                      : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  {copiedId === copy.id ? (
                    <>
                      <Check size={14} />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      复制
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleFavorite(copy)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    copy.is_favorite
                      ? "bg-red-50 text-red-500"
                      : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  <Heart
                    size={14}
                    fill={copy.is_favorite ? "currentColor" : "none"}
                  />
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
