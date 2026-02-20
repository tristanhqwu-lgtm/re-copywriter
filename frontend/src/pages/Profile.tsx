import { useState, useEffect, useCallback } from "react";
import api from "../api/client";
import {
  Heart,
  Copy,
  Check,
  LogOut,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import type { User, GeneratedCopy } from "../types";

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "刚刚";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}个月前`;
  return `${Math.floor(months / 12)}年前`;
}

const roleLabelMap: Record<string, string> = {
  admin: "管理员",
  user: "普通用户",
  editor: "编辑",
};

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [history, setHistory] = useState<GeneratedCopy[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    api
      .get<User>("/auth/me")
      .then(({ data }) => setUser(data))
      .catch(() => {
        /* ignore */
      });
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<GeneratedCopy[]>("/generate/history", {
        params: { skip: 0, limit: 20, favorites_only: favoritesOnly },
      });
      setHistory(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [favoritesOnly]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const toggleFavorite = async (item: GeneratedCopy) => {
    const newVal = !item.is_favorite;
    setHistory((prev) =>
      prev.map((h) => (h.id === item.id ? { ...h, is_favorite: newVal } : h))
    );
    try {
      await api.put(`/generate/history/${item.id}`, { is_favorite: newVal });
      if (favoritesOnly && !newVal) {
        setHistory((prev) => prev.filter((h) => h.id !== item.id));
      }
    } catch {
      setHistory((prev) =>
        prev.map((h) => (h.id === item.id ? { ...h, is_favorite: !newVal } : h))
      );
    }
  };

  const handleCopy = async (item: GeneratedCopy) => {
    const text = [
      item.title,
      item.content,
      item.hashtags?.length ? item.hashtags.map((t) => `#${t}`).join(" ") : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  return (
    <div className="p-4 space-y-5">
      {/* User Info Card */}
      <div className="bg-white rounded-lg ring-1 ring-[#EBE7DE] p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#F7F5F0] flex items-center justify-center ring-1 ring-[#EBE7DE]">
            <UserIcon size={26} className="text-[#8C8475]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-light text-[#2A2621] truncate tracking-[0.15em]">
              {user?.display_name || user?.username || "加载中..."}
            </h2>
            <p className="text-sm text-[#B5AE9E] truncate font-light tracking-[0.05em]">@{user?.username || "..."}</p>
          </div>
          {user?.role && (
            <span className="shrink-0 flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-[#F7F5F0] text-[#8C8475] font-light tracking-[0.05em] ring-1 ring-[#EBE7DE]">
              <ShieldCheck size={12} />
              {roleLabelMap[user.role] || user.role}
            </span>
          )}
        </div>
      </div>

      {/* Toggle Tabs */}
      <div className="flex bg-white rounded-lg p-1 ring-1 ring-[#EBE7DE]">
        <button
          onClick={() => setFavoritesOnly(false)}
          className={`flex-1 py-2 text-sm rounded-md font-light transition-colors tracking-[0.1em] ${
            !favoritesOnly
              ? "bg-[#3D3832] text-white"
              : "text-[#8C8475] hover:text-[#5C564C]"
          }`}
        >
          全 部
        </button>
        <button
          onClick={() => setFavoritesOnly(true)}
          className={`flex-1 py-2 text-sm rounded-md font-light transition-colors tracking-[0.1em] ${
            favoritesOnly
              ? "bg-[#3D3832] text-white"
              : "text-[#8C8475] hover:text-[#5C564C]"
          }`}
        >
          收 藏
        </button>
      </div>

      {/* History List */}
      {loading ? (
        <div className="text-center text-[#B5AE9E] py-12 font-light tracking-[0.1em]">加载中...</div>
      ) : history.length === 0 ? (
        <div className="text-center text-[#B5AE9E] py-12 font-light tracking-[0.05em]">
          {favoritesOnly ? "暂无收藏记录" : "暂无历史记录"}
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <div key={item.id} className="bg-white rounded-lg ring-1 ring-[#EBE7DE] overflow-hidden">
                {/* Card Header - clickable */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-light text-[#2A2621] truncate text-sm tracking-[0.08em]">
                        {item.title}
                      </h3>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {item.product_name && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F7F5F0] text-[#5C564C] font-light">
                            {item.product_name}
                          </span>
                        )}
                        {item.style_name && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F5F0E8] text-[#B8956A] font-light">
                            {item.style_name}
                          </span>
                        )}
                        {item.scene_name && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F7F5F0] text-[#8C8475] font-light">
                            {item.scene_name}
                          </span>
                        )}
                      </div>
                      {!isExpanded && (
                        <p className="text-xs text-[#B5AE9E] mt-2 line-clamp-2 font-light">
                          {item.content.slice(0, 100)}
                          {item.content.length > 100 ? "..." : ""}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className="text-[10px] text-[#D4CFC3] font-light">
                        {relativeTime(item.created_at)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp size={14} className="text-[#D4CFC3]" />
                      ) : (
                        <ChevronDown size={14} className="text-[#D4CFC3]" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="bg-[#F7F5F0] rounded-lg p-3 ring-1 ring-[#EBE7DE]">
                      <p className="text-sm text-[#3D3832] whitespace-pre-wrap leading-relaxed font-light">
                        {item.content}
                      </p>
                      {item.hashtags && item.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[#EBE7DE]">
                          {item.hashtags.map((tag, i) => (
                            <span
                              key={i}
                              className="text-xs text-[#B8956A] font-light"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(item);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition-colors ring-1 ring-[#EBE7DE] hover:ring-red-200 font-light"
                      >
                        <Heart
                          size={14}
                          className={
                            item.is_favorite
                              ? "fill-red-400 text-red-400"
                              : "text-[#B5AE9E]"
                          }
                        />
                        <span className={item.is_favorite ? "text-red-400" : "text-[#B5AE9E]"}>
                          {item.is_favorite ? "已收藏" : "收藏"}
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(item);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs bg-[#3D3832] text-white hover:bg-[#2A2621] transition-colors font-light"
                      >
                        {copiedId === item.id ? (
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
                    </div>
                  </div>
                )}

                {/* Favorite button on collapsed card */}
                {!isExpanded && (
                  <div className="px-4 pb-3 flex justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(item);
                      }}
                      className="p-1"
                    >
                      <Heart
                        size={16}
                        className={
                          item.is_favorite
                            ? "fill-red-400 text-red-400"
                            : "text-[#D4CFC3] hover:text-red-300"
                        }
                      />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3 bg-white rounded-lg ring-1 ring-[#EBE7DE] text-[#8C8475] hover:text-red-500 transition-colors text-sm font-light tracking-[0.1em]"
      >
        <LogOut size={16} />
        退 出 登 录
      </button>
    </div>
  );
}
