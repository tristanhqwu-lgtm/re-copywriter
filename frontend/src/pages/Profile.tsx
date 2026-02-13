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
      // If viewing favorites only and un-favorited, remove from list
      if (favoritesOnly && !newVal) {
        setHistory((prev) => prev.filter((h) => h.id !== item.id));
      }
    } catch {
      // revert on failure
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
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center">
            <UserIcon size={28} className="text-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-800 truncate">
              {user?.display_name || user?.username || "加载中..."}
            </h2>
            <p className="text-sm text-gray-400 truncate">@{user?.username || "..."}</p>
          </div>
          {user?.role && (
            <span className="shrink-0 flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-brand-50 text-brand font-medium">
              <ShieldCheck size={12} />
              {roleLabelMap[user.role] || user.role}
            </span>
          )}
        </div>
      </div>

      {/* Toggle Tabs */}
      <div className="flex bg-white rounded-xl p-1 shadow-sm">
        <button
          onClick={() => setFavoritesOnly(false)}
          className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${
            !favoritesOnly
              ? "bg-brand text-white"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          全部
        </button>
        <button
          onClick={() => setFavoritesOnly(true)}
          className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${
            favoritesOnly
              ? "bg-brand text-white"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          收藏
        </button>
      </div>

      {/* History List */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">加载中...</div>
      ) : history.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          {favoritesOnly ? "暂无收藏记录" : "暂无历史记录"}
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <div key={item.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {/* Card Header - clickable */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-800 truncate text-sm">
                        {item.title}
                      </h3>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {item.product_name && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-50 text-brand">
                            {item.product_name}
                          </span>
                        )}
                        {item.style_name && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600">
                            {item.style_name}
                          </span>
                        )}
                        {item.scene_name && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
                            {item.scene_name}
                          </span>
                        )}
                      </div>
                      {!isExpanded && (
                        <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">
                          {item.content.slice(0, 100)}
                          {item.content.length > 100 ? "..." : ""}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className="text-[10px] text-gray-300">
                        {relativeTime(item.created_at)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp size={14} className="text-gray-300" />
                      ) : (
                        <ChevronDown size={14} className="text-gray-300" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {item.content}
                      </p>
                      {item.hashtags && item.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-200">
                          {item.hashtags.map((tag, i) => (
                            <span
                              key={i}
                              className="text-xs text-brand font-medium"
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
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition-colors border border-gray-200 hover:border-red-200"
                      >
                        <Heart
                          size={14}
                          className={
                            item.is_favorite
                              ? "fill-red-400 text-red-400"
                              : "text-gray-400"
                          }
                        />
                        <span className={item.is_favorite ? "text-red-400" : "text-gray-400"}>
                          {item.is_favorite ? "已收藏" : "收藏"}
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(item);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs bg-brand text-white hover:bg-brand-dark transition-colors"
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
                            : "text-gray-300 hover:text-red-300"
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
        className="w-full flex items-center justify-center gap-2 py-3 bg-white rounded-2xl shadow-sm text-gray-500 hover:text-red-500 transition-colors text-sm"
      >
        <LogOut size={16} />
        退出登录
      </button>
    </div>
  );
}
