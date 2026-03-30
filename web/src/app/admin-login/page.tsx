"use client";

import { useState, useLayoutEffect } from "react";
import { Lock, LogIn, Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 首屏前从 URL 取 username；密码绝不从 URL 读取。随后去掉查询串，避免密码留在地址栏/历史记录
  useLayoutEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const u = q.get("username")?.trim();
    if (u) setUsername(u);
    if (window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
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

  // 必须同步 preventDefault；若用 async onSubmit，个别环境下会与浏览器默认 GET 提交竞态，密码会出现在 URL 查询串里
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const fd = new FormData(e.currentTarget);
    const u = String(fd.get("username") ?? "").trim();
    const p = String(fd.get("password") ?? "");
    setUsername(u);
    setPassword(p);
    void handleLogin(u, p);
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
            <p className="mt-1 text-xs text-amber-700">
              请勿把密码写在网址里；请在下方输入密码后点「登录后台」。
            </p>
          </div>
        </div>

        <form
          className="space-y-3"
          method="post"
          action="/admin-login"
          onSubmit={onSubmit}
        >
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

