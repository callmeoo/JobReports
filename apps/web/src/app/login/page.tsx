"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(
        "登录失败。请确认：1) 邮箱在白名单内；2) 密码与 Vercel 环境变量 AUTH_PASSWORD 一致（当前本地默认 JiJiOps2026）；3) Vercel 已配置 AUTH_SECRET、AUTH_PASSWORD、DATABASE_URL、AUTH_TRUST_HOST=true。",
      );
      return;
    }

    window.location.href = "/app";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-black">
        <p className="text-xs uppercase tracking-wide text-zinc-500">JiJi Ops</p>
        <h1 className="mt-2 text-2xl font-semibold">登录个人工作中枢</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          仅白名单邮箱可登录。首次登录会使用你在环境变量里设置的统一密码创建账号。
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600 dark:text-zinc-400">邮箱</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600 dark:text-zinc-400">密码</span>
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>
      </div>
    </main>
  );
}
