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
    <div className="min-h-screen bg-brand-50 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand">RE调香室</h1>
          <p className="text-gray-500 mt-2">AI文案助手</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-center">{isRegister ? "注册" : "登录"}</h2>
          {error && <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">{error}</div>}
          <input type="text" placeholder="用户名" value={username} onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-brand" required />
          {isRegister && (
            <input type="text" placeholder="显示名称" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-brand" required />
          )}
          <input type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-brand" required />
          <button type="submit" disabled={loading}
            className="w-full py-3 bg-brand text-white rounded-xl font-medium hover:bg-brand-dark transition-colors disabled:opacity-50">
            {loading ? "处理中..." : isRegister ? "注册" : "登录"}
          </button>
          <p className="text-center text-sm text-gray-500">
            {isRegister ? "已有账号？" : "没有账号？"}
            <button type="button" onClick={() => setIsRegister(!isRegister)} className="text-brand ml-1">
              {isRegister ? "登录" : "注册"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
