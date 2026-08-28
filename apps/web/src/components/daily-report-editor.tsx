"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { LeadershipItemsEditor } from "@/components/leadership-items-editor";
import {
  createLeadershipItem,
  parseLeadershipItems,
  type LeadershipItem,
} from "@/lib/reports/types";
import type { ReportStatus } from "@prisma/client";

type DailyReportData = {
  reportDate: string;
  doneToday: string;
  processNotes: string | null;
  reflection: string | null;
  leadershipSummary: string;
  leadershipItems: LeadershipItem[];
  status: ReportStatus;
};

export function DailyReportEditor({
  reportDate,
  initial,
}: {
  reportDate: string;
  initial?: DailyReportData | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    doneToday: initial?.doneToday ?? "",
    processNotes: initial?.processNotes ?? "",
    reflection: initial?.reflection ?? "",
    leadershipSummary: initial?.leadershipSummary ?? "",
    leadershipItems: initial?.leadershipItems ?? [],
    status: initial?.status ?? ("DRAFT" as ReportStatus),
  });

  async function save(status?: ReportStatus) {
    setSaving(true);
    setError(null);

    const payload = {
      ...form,
      processNotes: form.processNotes || null,
      reflection: form.reflection || null,
      status: status ?? form.status,
    };

    const res = await fetch(`/api/reports/daily/${reportDate}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
    if (!form.doneToday.trim()) {
      setError("请先填写「今日完成」");
      return;
    }

    setAiLoading(true);
    setError(null);

    const res = await fetch("/api/reports/ai/daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportDate,
        doneToday: form.doneToday,
        processNotes: form.processNotes || null,
        reflection: form.reflection || null,
      }),
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
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">个人版</h2>
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            仅自己可见
          </span>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">今日完成 *</span>
          <textarea
            value={form.doneToday}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, doneToday: e.target.value }))
            }
            rows={6}
            placeholder="今天完成了什么？尽量写具体成果和数据。"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">过程记录</span>
          <textarea
            value={form.processNotes}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, processNotes: e.target.value }))
            }
            rows={4}
            placeholder="可选：关键步骤、沟通记录等"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">复盘 / 感悟</span>
          <textarea
            value={form.reflection}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, reflection: e.target.value }))
            }
            rows={4}
            placeholder="可选：个人反思，不会进入领导版"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </section>

      <section className="space-y-4 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">领导版</h2>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              可进入周报
            </span>
          </div>
          <button
            type="button"
            onClick={generateAi}
            disabled={aiLoading}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
          >
            {aiLoading ? "生成中…" : "AI 生成摘要"}
          </button>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">今日结论</span>
          <textarea
            value={form.leadershipSummary}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                leadershipSummary: e.target.value,
              }))
            }
            rows={3}
            placeholder="1-3 句话概括今日核心成果"
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

export function toDailyReportData(
  report: {
    reportDate: string;
    doneToday: string;
    processNotes: string | null;
    reflection: string | null;
    leadershipSummary: string;
    leadershipItems: unknown;
    status: ReportStatus;
  } | null,
): DailyReportData | null {
  if (!report) return null;
  return {
    ...report,
    leadershipItems: parseLeadershipItems(report.leadershipItems),
  };
}
