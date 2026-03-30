"use client";

import { useState, useEffect } from "react";
import { Lock, LogIn, Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 仅支持 ?username= 预填账号；密码必须手输或浏览器保存，勿用 URL 传密码（会进日志与历史记录）
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const u = q.get("username")?.trim();
    if (u) setUsername(u);
  }, []);

  const handleLogin = async (u: string, p: string) => {
    if (!u.trim() || !p) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: u.trim(), password: p }),
      });
      let data: { error?: string } = {};
      try {
        data = await res.json();
      } catch {
        setError("服务器响应异常，请重试");
        return;
      }
      if (!res.ok) {
        setError(data.error || "登录失败");
        return;
      }
      window.location.replace(`${window.location.origin}/admin`);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const u = String(fd.get("username") ?? "").trim();
    const p = String(fd.get("password") ?? "");
    setUsername(u);
    setPassword(p);
    await handleLogin(u, p);
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Lock size={18} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">后台登录</h1>
            <p className="text-xs text-gray-500">仅研究人员可访问</p>
          </div>
        </div>

        <form className="space-y-3" onSubmit={onSubmit}>
          <input
            className="input-field"
            placeholder="账号"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <input
            className="input-field"
            placeholder="密码"
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            登录后台
          </button>
        </form>
      </div>
    </div>
  );
}

