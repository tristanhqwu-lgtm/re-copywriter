import { useState } from "react";
import api from "../api/client";
import type { TokenResponse } from "../types";

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const body = isRegister
        ? { username, password, display_name: displayName }
        : { username, password };
      const { data } = await api.post<TokenResponse>(endpoint, body);
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "/";
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || "操作失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F5] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-light tracking-[0.15em] text-brand">RE 調香室</h1>
          <div className="w-8 h-px bg-brand-300 mx-auto mt-3" />
          <p className="text-brand-400 mt-3 text-xs tracking-widest uppercase">AI Copywriter</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 border border-brand-100 space-y-4">
          <h2 className="text-sm font-medium text-center text-brand-500 tracking-wider">
            {isRegister ? "注 册" : "登 录"}
          </h2>
          {error && <div className="text-red-500 text-xs text-center bg-red-50 p-2 rounded-lg">{error}</div>}
          <input type="text" placeholder="用户名" value={username} onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-brand-50 border border-brand-100 focus:outline-none focus:border-brand-300 text-sm" required />
          {isRegister && (
            <input type="text" placeholder="显示名称" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-brand-50 border border-brand-100 focus:outline-none focus:border-brand-300 text-sm" required />
          )}
          <input type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-brand-50 border border-brand-100 focus:outline-none focus:border-brand-300 text-sm" required />
          <button type="submit" disabled={loading}
            className="w-full py-3 bg-brand text-white rounded-lg font-medium text-sm tracking-wider hover:bg-brand-dark transition-colors disabled:opacity-50">
            {loading ? "..." : isRegister ? "注册" : "登录"}
          </button>
          <p className="text-center text-xs text-brand-400">
            {isRegister ? "已有账号？" : "没有账号？"}
            <button type="button" onClick={() => setIsRegister(!isRegister)} className="text-brand ml-1 underline underline-offset-2">
              {isRegister ? "登录" : "注册"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
