"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { LeadershipItemsEditor } from "@/components/leadership-items-editor";
import {
  createLeadershipItem,
  parseLeadershipItems,
  REPORT_STATUS_LABELS,
  type LeadershipItem,
} from "@/lib/reports/types";
import { formatDateRange } from "@/lib/reports/dates";
import type { ReportStatus } from "@prisma/client";

type WeeklyReportData = {
  weekStart: string;
  weekEnd: string;
  personalReview: string;
  experienceNotes: string | null;
  leadershipSummary: string;
  leadershipItems: LeadershipItem[];
  status: ReportStatus;
  shareToken: string;
  shareEnabled: boolean;
};

type Tab = "personal" | "leadership";

export function WeeklyReportEditor({
  weekStart,
  initial,
}: {
  weekStart: string;
  initial: WeeklyReportData;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("personal");
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    personalReview: initial.personalReview,
    experienceNotes: initial.experienceNotes ?? "",
    leadershipSummary: initial.leadershipSummary,
    leadershipItems: initial.leadershipItems,
    status: initial.status,
    shareEnabled: initial.shareEnabled,
    shareToken: initial.shareToken,
  });

  async function save(status?: ReportStatus) {
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/reports/weekly/${weekStart}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personalReview: form.personalReview,
        experienceNotes: form.experienceNotes || null,
        leadershipSummary: form.leadershipSummary,
        leadershipItems: form.leadershipItems,
        status: status ?? form.status,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "保存失败");
      return;
    }

    router.refresh();
  }

  async function generateAi() {
    setAiLoading(true);
    setError(null);

    const res = await fetch("/api/reports/ai/weekly", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart }),
    });

    setAiLoading(false);

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "AI 生成失败");
      return;
    }

    const data = (await res.json()) as {
      leadershipSummary: string;
      leadershipItems: LeadershipItem[];
    };

    setForm((prev) => ({
      ...prev,
      leadershipSummary: data.leadershipSummary,
      leadershipItems: data.leadershipItems.map((item) =>
        createLeadershipItem(item),
      ),
    }));
    setTab("leadership");
  }

  async function publish() {
    setPublishing(true);
    setError(null);

    await save("READY");

    const res = await fetch(`/api/reports/weekly/${weekStart}/publish`, {
      method: "POST",
    });

    setPublishing(false);

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "发布失败");
      return;
    }

    const data = (await res.json()) as {
      shareToken: string;
      shareUrl: string;
    };

    setForm((prev) => ({
      ...prev,
      shareEnabled: true,
      shareToken: data.shareToken,
      status: "PUBLISHED",
    }));

    router.refresh();
  }

  async function copyShareLink() {
    const url = `${window.location.origin}/share/reports/${form.shareToken}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-500">
            {formatDateRange(initial.weekStart, initial.weekEnd)}
          </p>
          <p className="text-xs text-zinc-400">
            {REPORT_STATUS_LABELS[form.status]}
            {form.shareEnabled ? " · 已发布" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={generateAi}
            disabled={aiLoading}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
          >
            {aiLoading ? "生成中…" : "从日报重新生成"}
          </button>
          <Link
            href={`/share/reports/${form.shareToken}`}
            target="_blank"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
          >
            预览分享页
          </Link>
          {form.shareEnabled ? (
            <button
              type="button"
              onClick={copyShareLink}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {copied ? "已复制链接" : "复制分享链接"}
            </button>
          ) : (
            <button
              type="button"
              onClick={publish}
              disabled={publishing}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {publishing ? "发布中…" : "发布分享链接"}
            </button>
          )}
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
        {(
          [
            ["personal", "个人复盘"],
            ["leadership", "领导版"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === key
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "personal" ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              仅自己可见
            </span>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium">本周复盘</span>
            <textarea
              value={form.personalReview}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  personalReview: e.target.value,
                }))
              }
              rows={10}
              placeholder="本周整体感受、得失、下周计划…"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">经验总结</span>
            <span className="ml-2 text-xs text-zinc-400">
              半年会素材，个人专属
            </span>
            <textarea
              value={form.experienceNotes}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  experienceNotes: e.target.value,
                }))
              }
              rows={6}
              placeholder="可复用的经验、方法论、踩坑记录…"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
        </section>
      ) : (
        <section className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium">本周结论</span>
            <textarea
              value={form.leadershipSummary}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  leadershipSummary: e.target.value,
                }))
              }
              rows={4}
              placeholder="2-4 句话概括本周核心成果"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>

          <LeadershipItemsEditor
            items={form.leadershipItems}
            onChange={(items) =>
              setForm((prev) => ({ ...prev, leadershipItems: items }))
            }
          />
        </section>
      )}

      <div className="flex flex-wrap gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => save("DRAFT")}
          disabled={saving}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
        >
          {saving ? "保存中…" : "保存草稿"}
        </button>
        <button
          type="button"
          onClick={() => save("READY")}
          disabled={saving}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          标记完成
        </button>
      </div>
    </div>
  );
}

export function toWeeklyReportData(report: {
  weekStart: string;
  weekEnd: string;
  personalReview: string;
  experienceNotes: string | null;
  leadershipSummary: string;
  leadershipItems: unknown;
  status: ReportStatus;
  shareToken: string;
  shareEnabled: boolean;
}): WeeklyReportData {
  return {
    ...report,
    leadershipItems: parseLeadershipItems(report.leadershipItems),
  };
}
