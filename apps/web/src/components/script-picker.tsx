"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { SCRIPT_SCENARIO_LABELS } from "@/lib/content-types";
import type { ContentItem, ContentLocale, ScriptScenario } from "@prisma/client";

type ScriptItem = ContentItem & { locales: ContentLocale[] };

export function ScriptPicker({
  buyerId,
  countryCode,
}: {
  buyerId: string;
  countryCode?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ScriptItem[]>([]);
  const [scenario, setScenario] = useState<ScriptScenario | "">("ICEBREAKER");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ type: "SCRIPT" });
    if (scenario) params.set("scenario", scenario);
    if (countryCode) params.set("country", countryCode);

    fetch(`/api/content?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return [];
        return (await response.json()) as ScriptItem[];
      })
      .then((data) => setItems(data))
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [open, scenario, countryCode]);

  const scenarios = useMemo(
    () => Object.keys(SCRIPT_SCENARIO_LABELS) as ScriptScenario[],
    [],
  );

  async function useScript(item: ScriptItem) {
    const en = item.locales.find((locale) => locale.locale === "en" && locale.body.trim());
    const zh = item.locales.find((locale) => locale.locale === "zh" && locale.body.trim());
    const body = (en ?? zh)?.body?.trim();
    if (!body) return;

    await navigator.clipboard.writeText(body);
    setCopiedId(item.id);

    await fetch(`/api/buyers/${buyerId}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "WHATSAPP",
        content: `已复制话术并准备发送：${item.title}`,
        scriptId: item.id,
        scriptTitle: item.title,
        stageAfter: "CONTACTED",
      }),
    });

    router.refresh();
    window.setTimeout(() => setCopiedId(null), 1600);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm dark:border-zinc-700"
      >
        用话术
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">选话术 · 复制后去 WhatsApp</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-zinc-500">
          收起
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setScenario("")}
          className={`rounded-full px-3 py-1 text-sm ${
            scenario === ""
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "border border-zinc-300 dark:border-zinc-700"
          }`}
        >
          全部
        </button>
        {scenarios.map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => setScenario(entry)}
            className={`rounded-full px-3 py-1 text-sm ${
              scenario === entry
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {SCRIPT_SCENARIO_LABELS[entry]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">加载中...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">
          还没有匹配话术。去「运营素材」新建一条破冰英文稿。
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const en = item.locales.find((locale) => locale.locale === "en");
            const preview = (en?.body || item.summary || "").slice(0, 120);
            return (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{preview}</p>
                </div>
                <button
                  type="button"
                  onClick={() => useScript(item)}
                  className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {copiedId === item.id ? "已复制" : "复制英文"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
