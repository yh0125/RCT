"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LogIn, Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!username.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "登录失败");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
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

        <div className="space-y-3">
          <input
            className="input-field"
            placeholder="账号"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <input
            className="input-field"
            placeholder="密码"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLogin();
            }}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={handleLogin}
            disabled={loading || !username.trim() || !password}
            className="btn-primary w-full gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            登录后台
          </button>
        </div>
      </div>
    </div>
  );
}

