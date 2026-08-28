"use client";

import { useState } from "react";

import { LeadershipItemsReader } from "@/components/leadership-items-reader";
import { formatDateRange } from "@/lib/reports/dates";
import type { LeadershipItem } from "@/lib/reports/types";

export function ShareReportPage({
  weekStart,
  weekEnd,
  leadershipSummary,
  leadershipItems,
  publishedAt,
  updatedAt,
}: {
  weekStart: string;
  weekEnd: string;
  leadershipSummary: string;
  leadershipItems: LeadershipItem[];
  publishedAt: string | null;
  updatedAt: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyText() {
    const lines = [
      `工作周报 ${formatDateRange(weekStart, weekEnd)}`,
      "",
      leadershipSummary,
      "",
      ...leadershipItems.map(
        (item) =>
          `• ${item.title}\n  ${item.result}${item.hasProcess && item.process ? `\n  过程：${item.process}` : ""}`,
      ),
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] dark:bg-black">
      <div className="mx-auto max-w-[720px] px-6 py-10">
        <header className="mb-8 space-y-2">
          <p className="text-sm text-zinc-500">工作周报</p>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {formatDateRange(weekStart, weekEnd)}
          </h1>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={copyText}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              {copied ? "已复制" : "复制纯文本"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              打印
            </button>
          </div>
        </header>

        <div className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          {leadershipSummary ? (
            <section>
              <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
                本周总结
              </h2>
              <p className="mt-3 text-base leading-relaxed text-zinc-800 dark:text-zinc-200">
                {leadershipSummary}
              </p>
            </section>
          ) : null}

          <section>
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-400">
              核心事项
            </h2>
            <LeadershipItemsReader items={leadershipItems} />
          </section>
        </div>

        <footer className="mt-8 text-center text-xs text-zinc-400">
          汇报周期 {formatDateRange(weekStart, weekEnd)}
          {publishedAt
            ? ` · 发布于 ${new Date(publishedAt).toLocaleString("zh-CN")}`
            : ` · 更新于 ${new Date(updatedAt).toLocaleString("zh-CN")}`}
        </footer>
      </div>
    </div>
  );
}
