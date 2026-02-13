import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Trash2, RefreshCw, ExternalLink, X, Loader2 } from "lucide-react";
import api, { pollTask } from "../api/client";
import type { Style, AsyncTask } from "../types";

/* ──────────────────────────── helpers ──────────────────────────── */

const PLATFORMS = [
  { value: "xiaohongshu", label: "小红书" },
  { value: "douyin", label: "抖音" },
] as const;

type Platform = (typeof PLATFORMS)[number]["value"];
type InputMethod = "paste" | "url";

interface AddedSource {
  id: number;
  platform: string;
  preview: string;
}

/* ──────────────────────────── main component ──────────────────── */

export default function StyleLibrary() {
  /* ---- list state ---- */
  const [styles, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ---- detail view ---- */
  const [detailStyle, setDetailStyle] = useState<Style | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /* ---- add flow ---- */
  const [showAdd, setShowAdd] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [createdStyle, setCreatedStyle] = useState<Style | null>(null);

  /* source input */
  const [platform, setPlatform] = useState<Platform>("xiaohongshu");
  const [inputMethod, setInputMethod] = useState<InputMethod>("paste");
  const [pasteContent, setPasteContent] = useState("");
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [addedSources, setAddedSources] = useState<AddedSource[]>([]);
  const [addingSource, setAddingSource] = useState(false);

  /* task polling */
  const [taskStatus, setTaskStatus] = useState<AsyncTask | null>(null);
  const stopPollRef = useRef<(() => void) | null>(null);

  /* analyze (add flow) */
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeTask, setAnalyzeTask] = useState<AsyncTask | null>(null);
  const stopAnalyzeRef = useRef<(() => void) | null>(null);

  /* analyze (detail view) */
  const [detailAnalyzing, setDetailAnalyzing] = useState(false);
  const [detailAnalyzeTask, setDetailAnalyzeTask] = useState<AsyncTask | null>(null);
  const stopDetailAnalyzeRef = useRef<(() => void) | null>(null);

  /* confirm delete */
  const [confirmDeleteStyleId, setConfirmDeleteStyleId] = useState<number | null>(null);
  const [confirmDeleteSourceId, setConfirmDeleteSourceId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ──────────────────── data fetching ──────────────────── */

  const fetchStyles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get<Style[]>("/styles/");
      setStyles(data);
    } catch {
      setError("加载风格列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStyles();
  }, [fetchStyles]);

  /* cleanup polls on unmount */
  useEffect(() => {
    return () => {
      stopPollRef.current?.();
      stopAnalyzeRef.current?.();
      stopDetailAnalyzeRef.current?.();
    };
  }, []);

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    setDetailAnalyzeTask(null);
    setDetailAnalyzing(false);
    setConfirmDeleteSourceId(null);
    setConfirmDeleteStyleId(null);
    try {
      const { data } = await api.get<Style>(`/styles/${id}`);
      setDetailStyle(data);
    } catch {
      setError("加载风格详情失败");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailStyle(null);
    stopDetailAnalyzeRef.current?.();
    setDetailAnalyzeTask(null);
    setDetailAnalyzing(false);
    setConfirmDeleteSourceId(null);
    setConfirmDeleteStyleId(null);
    fetchStyles();
  };

  /* ──────────────────── add style flow ──────────────────── */

  const resetAddFlow = () => {
    setShowAdd(false);
    setAddStep(1);
    setNewName("");
    setNewDesc("");
    setCreatedStyle(null);
    setPlatform("xiaohongshu");
    setInputMethod("paste");
    setPasteContent("");
    setScrapeUrl("");
    setAddedSources([]);
    setTaskStatus(null);
    setAnalyzing(false);
    setAnalyzeTask(null);
    setAddingSource(false);
    stopPollRef.current?.();
    stopAnalyzeRef.current?.();
    fetchStyles();
  };

  const handleCreateStyle = async () => {
    if (!newName.trim()) return;
    setError("");
    try {
      const { data } = await api.post<Style>("/styles/", {
        name: newName.trim(),
        description: newDesc.trim(),
      });
      setCreatedStyle(data);
      setAddStep(2);
    } catch {
      setError("创建风格失败");
    }
  };

  /* ---- add source ---- */

  const addSourceToStyle = async (content: string, url: string) => {
    if (!createdStyle) return;
    setAddingSource(true);
    try {
      const { data } = await api.post(`/styles/${createdStyle.id}/sources`, {
        platform,
        source_url: url,
        source_content: content,
      });
      setAddedSources((prev) => [
        ...prev,
        {
          id: data.id,
          platform,
          preview: content.slice(0, 60),
        },
      ]);
      setPasteContent("");
      setScrapeUrl("");
    } catch {
      setError("添加文章失败");
    } finally {
      setAddingSource(false);
    }
  };

  const handleAddSource = async () => {
    if (inputMethod === "paste") {
      if (!pasteContent.trim()) return;
      await addSourceToStyle(pasteContent.trim(), "");
    } else {
      if (!scrapeUrl.trim()) return;
      try {
        setTaskStatus({ id: "", type: "scrape", status: "pending", progress: 0 });
        const { data } = await api.post<AsyncTask>("/scrape/", {
          url: scrapeUrl.trim(),
        });
        setTaskStatus(data);

        stopPollRef.current?.();
        const stop = pollTask(data.id, (update) => {
          const t = update as unknown as AsyncTask;
          setTaskStatus(t);
          if (t.status === "completed" && t.result) {
            const content =
              (t.result as Record<string, string>).content ||
              JSON.stringify(t.result);
            addSourceToStyle(content, scrapeUrl.trim());
            setTaskStatus(null);
          }
          if (t.status === "failed") {
            setError(t.error || "抓取失败");
            setTaskStatus(null);
          }
        });
        stopPollRef.current = stop;
      } catch {
        setError("发起抓取失败");
        setTaskStatus(null);
      }
    }
  };

  /* ---- analyze (add flow) ---- */

  const handleAnalyze = async () => {
    if (!createdStyle) return;
    setAnalyzing(true);
    setAnalyzeTask(null);
    setError("");
    try {
      const { data } = await api.post<AsyncTask>(
        `/styles/${createdStyle.id}/analyze`
      );
      setAnalyzeTask(data);

      stopAnalyzeRef.current?.();
      const stop = pollTask(data.id, (update) => {
        const t = update as unknown as AsyncTask;
        setAnalyzeTask(t);
        if (t.status === "completed" || t.status === "failed") {
          setAnalyzing(false);
        }
      });
      stopAnalyzeRef.current = stop;
    } catch {
      setError("发起风格分析失败");
      setAnalyzing(false);
    }
  };

  /* ---- analyze (detail view) ---- */

  const handleReAnalyze = async () => {
    if (!detailStyle) return;
    setDetailAnalyzing(true);
    setDetailAnalyzeTask(null);
    setError("");
    try {
      const { data } = await api.post<AsyncTask>(
        `/styles/${detailStyle.id}/analyze`
      );
      setDetailAnalyzeTask(data);

      stopDetailAnalyzeRef.current?.();
      const stop = pollTask(data.id, (update) => {
        const t = update as unknown as AsyncTask;
        setDetailAnalyzeTask(t);
        if (t.status === "completed") {
          setDetailAnalyzing(false);
          openDetail(detailStyle.id);
        }
        if (t.status === "failed") {
          setDetailAnalyzing(false);
        }
      });
      stopDetailAnalyzeRef.current = stop;
    } catch {
      setError("发起风格分析失败");
      setDetailAnalyzing(false);
    }
  };

  /* ---- delete ---- */

  const handleDeleteStyle = async (id: number) => {
    setDeleting(true);
    try {
      await api.delete(`/styles/${id}`);
      setConfirmDeleteStyleId(null);
      if (detailStyle?.id === id) {
        closeDetail();
      }
      fetchStyles();
    } catch {
      setError("删除风格失败");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSource = async (sourceId: number) => {
    if (!detailStyle) return;
    setDeleting(true);
    try {
      await api.delete(`/styles/${detailStyle.id}/sources/${sourceId}`);
      setConfirmDeleteSourceId(null);
      openDetail(detailStyle.id);
    } catch {
      setError("删除文章失败");
    } finally {
      setDeleting(false);
    }
  };

  /* ──────────────────── sub-renders ──────────────────── */

  const featureLabels: Record<string, string> = {
    tone: "语调",
    vocabulary: "常用词汇",
    sentence_patterns: "句式特点",
    emoji_style: "表情风格",
    structure: "文章结构",
    emotional_expression: "情感表达",
    title_style: "标题风格",
    paragraph_style: "段落风格",
    summary: "总结",
  };

  const renderFeatures = (features: Style["style_features"]) => {
    if (!features || Object.keys(features).length === 0) {
      return <p className="text-gray-400 text-sm">暂无风格特征，请先分析</p>;
    }
    return (
      <div className="space-y-3">
        {Object.entries(features).map(([key, value]) => {
          if (value === undefined || value === null) return null;
          const label = featureLabels[key] || key;
          const display = Array.isArray(value) ? value.join("、") : String(value);
          return (
            <div key={key}>
              <span className="text-xs font-medium text-brand bg-brand-50 px-2 py-0.5 rounded-full">
                {label}
              </span>
              <p className="text-sm text-gray-700 mt-1 leading-relaxed">{display}</p>
            </div>
          );
        })}
      </div>
    );
  };

  const platformLabel = (p: string) =>
    PLATFORMS.find((pl) => pl.value === p)?.label || p;

  const renderError = () => {
    if (!error) return null;
    return (
      <div className="text-red-500 text-sm bg-red-50 p-3 rounded-xl flex items-center justify-between">
        <span>{error}</span>
        <button onClick={() => setError("")} className="text-red-400 ml-2 shrink-0">
          <X size={14} />
        </button>
      </div>
    );
  };

  /* ──────────────────── DETAIL VIEW ──────────────────── */

  if (detailStyle) {
    return (
      <div className="p-4 space-y-4">
        {/* header */}
        <div className="flex items-center justify-between">
          <button onClick={closeDetail} className="text-gray-500 p-1">
            <X size={22} />
          </button>
          <h2 className="text-lg font-bold text-brand truncate flex-1 text-center mx-2">
            {detailStyle.name}
          </h2>
          <div className="w-[30px]" />
        </div>

        {detailLoading && (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-brand" />
          </div>
        )}

        {!detailLoading && (
          <>
            {/* description */}
            {detailStyle.description && (
              <p className="text-sm text-gray-500">{detailStyle.description}</p>
            )}

            {renderError()}

            {/* features card */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">风格特征</h3>
              {renderFeatures(detailStyle.style_features)}
            </div>

            {/* action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleReAnalyze}
                disabled={detailAnalyzing}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {detailAnalyzing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                {detailAnalyzing ? "分析中..." : "重新分析"}
              </button>
              <button
                onClick={() => setConfirmDeleteStyleId(detailStyle.id)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-500 rounded-xl text-sm font-medium transition-colors"
              >
                <Trash2 size={16} />
                删除
              </button>
            </div>

            {/* analyze progress */}
            {detailAnalyzeTask && detailAnalyzeTask.status !== "completed" && (
              <div className="bg-brand-50 rounded-xl p-3 text-sm text-brand flex items-center gap-2">
                {detailAnalyzeTask.status === "failed" ? (
                  <span>分析失败: {detailAnalyzeTask.error || "未知错误"}</span>
                ) : (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>分析进度: {Math.round((detailAnalyzeTask.progress || 0) * 100)}%</span>
                  </>
                )}
              </div>
            )}

            {/* confirm delete style */}
            {confirmDeleteStyleId !== null && (
              <div className="bg-red-50 rounded-xl p-4 space-y-3">
                <p className="text-sm text-red-600">确定要删除此风格吗？此操作不可撤销。</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDeleteStyle(confirmDeleteStyleId)}
                    disabled={deleting}
                    className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                  >
                    {deleting ? "删除中..." : "确定删除"}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteStyleId(null)}
                    className="flex-1 py-2 bg-white text-gray-600 rounded-xl text-sm font-medium border border-gray-200"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* source articles */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">
                参考文章 ({detailStyle.sources?.length || 0})
              </h3>
              {(!detailStyle.sources || detailStyle.sources.length === 0) && (
                <p className="text-gray-400 text-sm">暂无参考文章</p>
              )}
              <div className="space-y-3">
                {detailStyle.sources?.map((src) => (
                  <div
                    key={src.id}
                    className="border border-gray-100 rounded-xl p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-brand bg-brand-50 px-2 py-0.5 rounded-full">
                        {platformLabel(src.platform)}
                      </span>
                      <div className="flex items-center gap-2">
                        {src.source_url && (
                          <a
                            href={src.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-brand transition-colors"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                        {confirmDeleteSourceId === src.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDeleteSource(src.id)}
                              disabled={deleting}
                              className="text-xs text-red-500 font-medium disabled:opacity-50"
                            >
                              {deleting ? "..." : "确认"}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteSourceId(null)}
                              className="text-xs text-gray-400"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteSourceId(src.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">
                      {src.source_content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  /* ──────────────────── ADD STYLE VIEW ──────────────────── */

  if (showAdd) {
    return (
      <div className="p-4 space-y-4">
        {/* header */}
        <div className="flex items-center justify-between">
          <button onClick={resetAddFlow} className="text-gray-500 p-1">
            <X size={22} />
          </button>
          <h2 className="text-lg font-bold text-brand">添加风格</h2>
          <div className="w-[30px]" />
        </div>

        {renderError()}

        {/* step 1: name + description */}
        {addStep === 1 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-gray-800">基本信息</h3>
            <input
              type="text"
              placeholder="风格名称"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-brand text-sm"
            />
            <textarea
              placeholder="风格描述（可选）"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-brand text-sm resize-none"
            />
            <button
              onClick={handleCreateStyle}
              disabled={!newName.trim()}
              className="w-full py-3 bg-brand text-white rounded-xl font-medium text-sm disabled:opacity-40 transition-colors"
            >
              下一步
            </button>
          </div>
        )}

        {/* step 2: add sources + analyze */}
        {addStep === 2 && createdStyle && (
          <div className="space-y-4">
            {/* platform selection */}
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-gray-800">选择平台</h3>
              <div className="flex gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPlatform(p.value)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      platform === p.value
                        ? "bg-brand text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* input method toggle */}
              <h3 className="text-sm font-semibold text-gray-800">输入方式</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setInputMethod("paste")}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    inputMethod === "paste"
                      ? "bg-brand text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  粘贴内容
                </button>
                <button
                  onClick={() => setInputMethod("url")}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    inputMethod === "url"
                      ? "bg-brand text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  输入链接
                </button>
              </div>

              {/* paste content */}
              {inputMethod === "paste" && (
                <textarea
                  placeholder="粘贴文章内容..."
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-brand text-sm resize-none"
                />
              )}

              {/* url input */}
              {inputMethod === "url" && (
                <input
                  type="url"
                  placeholder="输入文章链接..."
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-brand text-sm"
                />
              )}

              {/* scrape task progress */}
              {taskStatus && taskStatus.status !== "completed" && (
                <div className="flex items-center gap-2 text-sm text-brand">
                  {taskStatus.status === "failed" ? (
                    <span>抓取失败: {taskStatus.error || "未知错误"}</span>
                  ) : (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>抓取中... {Math.round((taskStatus.progress || 0) * 100)}%</span>
                    </>
                  )}
                </div>
              )}

              {/* add source button */}
              <button
                onClick={handleAddSource}
                disabled={
                  addingSource ||
                  (inputMethod === "paste" && !pasteContent.trim()) ||
                  (inputMethod === "url" && !scrapeUrl.trim()) ||
                  (taskStatus !== null &&
                    taskStatus.status !== "completed" &&
                    taskStatus.status !== "failed")
                }
                className="w-full py-3 bg-brand-50 text-brand rounded-xl font-medium text-sm disabled:opacity-40 border border-brand/20 flex items-center justify-center gap-2 transition-colors"
              >
                {addingSource && <Loader2 size={14} className="animate-spin" />}
                添加文章
              </button>
            </div>

            {/* added sources list */}
            {addedSources.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
                <h3 className="text-sm font-semibold text-gray-800">
                  已添加文章 ({addedSources.length})
                </h3>
                {addedSources.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 text-sm border border-gray-100 rounded-xl px-3 py-2.5"
                  >
                    <span className="text-xs font-medium text-brand bg-brand-50 px-2 py-0.5 rounded-full shrink-0">
                      {platformLabel(s.platform)}
                    </span>
                    <span className="text-gray-600 truncate">{s.preview}</span>
                  </div>
                ))}
              </div>
            )}

            {/* analyze button */}
            <button
              onClick={handleAnalyze}
              disabled={addedSources.length === 0 || analyzing}
              className="w-full py-3 bg-brand text-white rounded-xl font-medium text-sm disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
            >
              {analyzing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              {analyzing ? "分析中..." : "分析风格"}
            </button>

            {/* analyze task progress */}
            {analyzeTask && (
              <div
                className={`rounded-xl p-3 text-sm flex items-center gap-2 ${
                  analyzeTask.status === "failed"
                    ? "bg-red-50 text-red-500"
                    : "bg-brand-50 text-brand"
                }`}
              >
                {analyzeTask.status === "completed" ? (
                  <span>分析完成！</span>
                ) : analyzeTask.status === "failed" ? (
                  <span>分析失败: {analyzeTask.error || "未知错误"}</span>
                ) : (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>分析进度: {Math.round((analyzeTask.progress || 0) * 100)}%</span>
                  </>
                )}
              </div>
            )}

            {/* done button (after analysis completes) */}
            {analyzeTask?.status === "completed" && (
              <button
                onClick={resetAddFlow}
                className="w-full py-3 bg-white text-brand rounded-xl font-medium text-sm border border-brand/20 transition-colors"
              >
                完成
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ──────────────────── LIST VIEW (default) ──────────────────── */

  return (
    <div className="p-4 space-y-4">
      {/* header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-brand">风格库</h1>
        <button
          onClick={() => {
            setError("");
            setShowAdd(true);
          }}
          className="flex items-center gap-1 px-3 py-2 bg-brand text-white rounded-xl text-sm font-medium transition-colors active:scale-95"
        >
          <Plus size={16} />
          添加风格
        </button>
      </div>

      {renderError()}

      {/* loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin text-brand" />
        </div>
      )}

      {/* empty state */}
      {!loading && styles.length === 0 && !error && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus size={24} className="text-brand" />
          </div>
          <p className="text-gray-400 text-sm">还没有风格</p>
          <p className="text-gray-300 text-xs mt-1">点击右上角添加你的第一个风格</p>
        </div>
      )}

      {/* style cards */}
      {!loading &&
        styles.map((style) => (
          <button
            key={style.id}
            onClick={() => openDetail(style.id)}
            className="w-full text-left bg-white rounded-2xl p-4 shadow-sm space-y-2 active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800 truncate">
                {style.name}
              </h3>
              <span className="text-xs text-brand bg-brand-50 px-2 py-0.5 rounded-full shrink-0 ml-2">
                {style.source_count ?? 0} 篇
              </span>
            </div>
            {style.description && (
              <p className="text-sm text-gray-500 line-clamp-2">{style.description}</p>
            )}
            {style.style_features?.tone && (
              <p className="text-xs text-gray-400">
                语调: {style.style_features.tone}
              </p>
            )}
          </button>
        ))}
    </div>
  );
}
