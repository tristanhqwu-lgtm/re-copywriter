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
    <div className="bg-white rounded-lg ring-1 ring-[#EBE7DE] p-4 relative">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-light text-[#2A2621] truncate tracking-[0.08em]">{scene.name}</h3>
            {scene.is_builtin && (
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-[#F7F5F0] text-[#8C8475] font-light ring-1 ring-[#EBE7DE]">
                内置
              </span>
            )}
          </div>
          {scene.description && (
            <p className="text-sm text-[#8C8475] mt-1 line-clamp-2 font-light">{scene.description}</p>
          )}
          {scene.keywords && scene.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {scene.keywords.map((kw, i) => (
                <span
                  key={i}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-[#F5F0E8] text-[#B8956A] font-light"
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
            className="shrink-0 p-1.5 text-[#D4CFC3] hover:text-red-400 transition-colors disabled:opacity-50"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-light tracking-[0.15em] text-[#2A2621]">场 景 库</h1>
          <div className="w-8 h-px bg-[#D4CFC3] mt-2" />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-[#3D3832] text-white text-sm rounded-lg hover:bg-[#2A2621] transition-colors font-light tracking-[0.05em]"
        >
          <Plus size={14} />
          添加场景
        </button>
      </div>

      {loading ? (
        <div className="text-center text-[#B5AE9E] py-12 font-light tracking-[0.1em]">加载中...</div>
      ) : (
        <>
          {/* Festival Section */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <PartyPopper size={16} className="text-[#B8956A]" />
              <h2 className="font-light text-[#2A2621] tracking-[0.1em]">节日模板</h2>
              <span className="text-[11px] text-[#B5AE9E] font-light">{festivalScenes.length}</span>
            </div>
            {festivalScenes.length === 0 ? (
              <p className="text-sm text-[#B5AE9E] pl-6 font-light">暂无节日模板</p>
            ) : (
              <div className="space-y-3">
                {festivalScenes.map((s) => (
                  <SceneCard key={s.id} scene={s} />
                ))}
              </div>
            )}
          </section>

          <div className="w-full h-px bg-[#EBE7DE]" />

          {/* Scene / Custom Section */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-[#B8956A]" />
              <h2 className="font-light text-[#2A2621] tracking-[0.1em]">场景模板</h2>
              <span className="text-[11px] text-[#B5AE9E] font-light">{otherScenes.length}</span>
            </div>
            {otherScenes.length === 0 ? (
              <p className="text-sm text-[#B5AE9E] pl-6 font-light">暂无场景模板</p>
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
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30">
          <div className="w-full max-w-[430px] bg-white rounded-t-xl ring-1 ring-[#EBE7DE] p-5 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-light tracking-[0.15em] text-[#2A2621]">添加自定义场景</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-[#B5AE9E] hover:text-[#3D3832]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="w-8 h-px bg-[#D4CFC3]" />

            {error && (
              <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg font-light">
                {error}
              </div>
            )}

            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-[0.2em] text-[#8C8475] mb-1.5 block">场景名称</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="例如：约会推荐"
                  className="w-full px-4 py-2.5 rounded-lg bg-[#F7F5F0] border border-[#EBE7DE] focus:outline-none focus:border-[#B5AE9E] text-sm text-[#2A2621] placeholder:text-[#B5AE9E] font-light"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.2em] text-[#8C8475] mb-1.5 block">描述</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="简要描述该场景的用途"
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#F7F5F0] border border-[#EBE7DE] focus:outline-none focus:border-[#B5AE9E] text-sm text-[#2A2621] placeholder:text-[#B5AE9E] resize-none font-light"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.2em] text-[#8C8475] mb-1.5 block">
                  <Tag size={12} className="inline mr-1" />
                  关键词（逗号分隔）
                </label>
                <input
                  type="text"
                  value={formKeywords}
                  onChange={(e) => setFormKeywords(e.target.value)}
                  placeholder="例如：浪漫，约会，甜蜜"
                  className="w-full px-4 py-2.5 rounded-lg bg-[#F7F5F0] border border-[#EBE7DE] focus:outline-none focus:border-[#B5AE9E] text-sm text-[#2A2621] placeholder:text-[#B5AE9E] font-light"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.2em] text-[#8C8475] mb-1.5 block">提示词</label>
                <textarea
                  value={formPromptHint}
                  onChange={(e) => setFormPromptHint(e.target.value)}
                  placeholder="给AI的额外提示，帮助生成更贴合场景的文案"
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#F7F5F0] border border-[#EBE7DE] focus:outline-none focus:border-[#B5AE9E] text-sm text-[#2A2621] placeholder:text-[#B5AE9E] resize-none font-light"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-[#3D3832] text-white rounded-lg hover:bg-[#2A2621] transition-colors disabled:opacity-50 text-sm font-light tracking-[0.1em]"
              >
                {submitting ? "添加中..." : "确 认 添 加"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
