import { useState, useEffect } from "react";
import api from "../api/client";
import { Plus, X, Trash2, Sparkles, PartyPopper, Tag } from "lucide-react";
import type { Scene } from "../types";

export default function SceneLibrary() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  // form state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formKeywords, setFormKeywords] = useState("");
  const [formPromptHint, setFormPromptHint] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchScenes = async () => {
    setLoading(true);
    try {
      const [festivalRes, sceneRes, customRes] = await Promise.all([
        api.get<Scene[]>("/scenes/", { params: { type: "festival" } }),
        api.get<Scene[]>("/scenes/", { params: { type: "scene" } }),
        api.get<Scene[]>("/scenes/", { params: { type: "custom" } }),
      ]);
      setScenes([...festivalRes.data, ...sceneRes.data, ...customRes.data]);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScenes();
  }, []);

  const festivalScenes = scenes.filter((s) => s.type === "festival");
  const otherScenes = scenes.filter((s) => s.type === "scene" || s.type === "custom");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const keywords = formKeywords
        .split(/[,，]/)
        .map((k) => k.trim())
        .filter(Boolean);
      await api.post("/scenes/", {
        name: formName,
        type: "custom",
        description: formDesc,
        keywords,
        prompt_hint: formPromptHint,
      });
      setShowModal(false);
      setFormName("");
      setFormDesc("");
      setFormKeywords("");
      setFormPromptHint("");
      fetchScenes();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || "添加失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("确定删除该场景？")) return;
    setDeleting(id);
    try {
      await api.delete(`/scenes/${id}`);
      setScenes((prev) => prev.filter((s) => s.id !== id));
    } catch {
      /* ignore */
    } finally {
      setDeleting(null);
    }
  };

  const SceneCard = ({ scene }: { scene: Scene }) => (
    <div className="bg-white rounded-2xl shadow-sm p-4 relative">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-800 truncate">{scene.name}</h3>
            {scene.is_builtin && (
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-brand-50 text-brand font-medium">
                内置
              </span>
            )}
          </div>
          {scene.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{scene.description}</p>
          )}
          {scene.keywords && scene.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {scene.keywords.map((kw, i) => (
                <span
                  key={i}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
        {!scene.is_builtin && (
          <button
            onClick={() => handleDelete(scene.id)}
            disabled={deleting === scene.id}
            className="shrink-0 p-1.5 text-gray-300 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-brand">场景库</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-brand text-white text-sm rounded-full hover:bg-brand-dark transition-colors"
        >
          <Plus size={16} />
          添加场景
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">加载中...</div>
      ) : (
        <>
          {/* Festival Section */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <PartyPopper size={18} className="text-brand" />
              <h2 className="font-semibold text-gray-700">节日模板</h2>
              <span className="text-xs text-gray-400">{festivalScenes.length}</span>
            </div>
            {festivalScenes.length === 0 ? (
              <p className="text-sm text-gray-400 pl-6">暂无节日模板</p>
            ) : (
              <div className="space-y-3">
                {festivalScenes.map((s) => (
                  <SceneCard key={s.id} scene={s} />
                ))}
              </div>
            )}
          </section>

          {/* Scene / Custom Section */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={18} className="text-brand" />
              <h2 className="font-semibold text-gray-700">场景模板</h2>
              <span className="text-xs text-gray-400">{otherScenes.length}</span>
            </div>
            {otherScenes.length === 0 ? (
              <p className="text-sm text-gray-400 pl-6">暂无场景模板</p>
            ) : (
              <div className="space-y-3">
                {otherScenes.map((s) => (
                  <SceneCard key={s.id} scene={s} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="w-full max-w-[430px] bg-white rounded-t-2xl p-5 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">添加自定义场景</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">场景名称</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="例如：约会推荐"
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-brand text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">描述</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="简要描述该场景的用途"
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-brand text-sm resize-none"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">
                  <Tag size={14} className="inline mr-1" />
                  关键词（逗号分隔）
                </label>
                <input
                  type="text"
                  value={formKeywords}
                  onChange={(e) => setFormKeywords(e.target.value)}
                  placeholder="例如：浪漫，约会，甜蜜"
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-brand text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">提示词</label>
                <textarea
                  value={formPromptHint}
                  onChange={(e) => setFormPromptHint(e.target.value)}
                  placeholder="给AI的额外提示，帮助生成更贴合场景的文案"
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-brand text-sm resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-brand text-white rounded-xl font-medium hover:bg-brand-dark transition-colors disabled:opacity-50 text-sm"
              >
                {submitting ? "添加中..." : "确认添加"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
