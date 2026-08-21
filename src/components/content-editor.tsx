"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CONTENT_TYPE_LABELS,
  LOCALE_LABELS,
  SCRIPT_SCENARIO_LABELS,
} from "@/lib/content-types";
import type {
  ContentItem,
  ContentLocale,
  ContentType,
  LocaleCode,
  ScriptScenario,
} from "@prisma/client";

type ItemWithLocales = ContentItem & { locales: ContentLocale[] };

const LOCALES: LocaleCode[] = ["zh", "en", "local"];
const SCENARIOS = Object.keys(SCRIPT_SCENARIO_LABELS) as ScriptScenario[];

export function ContentEditor({
  item,
  allowedTypes,
  showCountry = false,
  showScenario = false,
  defaultLocale = "zh",
}: {
  item?: ItemWithLocales;
  allowedTypes: ContentType[];
  showCountry?: boolean;
  showScenario?: boolean;
  defaultLocale?: LocaleCode;
}) {
  const router = useRouter();
  const [activeLocale, setActiveLocale] = useState<LocaleCode>(defaultLocale);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localeMap = useMemo(() => {
    const map = new Map<LocaleCode, ContentLocale>();
    item?.locales.forEach((locale) => map.set(locale.locale, locale));
    return map;
  }, [item]);

  const [form, setForm] = useState({
    type: item?.type ?? allowedTypes[0],
    title: item?.title ?? "",
    summary: item?.summary ?? "",
    countryCode: item?.countryCode ?? "",
    scenario: (item?.scenario ?? "ICEBREAKER") as ScriptScenario,
    tags: item?.tags.join(", ") ?? "",
    locales: LOCALES.reduce(
      (acc, locale) => {
        const existing = localeMap.get(locale);
        acc[locale] = {
          title: existing?.title ?? "",
          body: existing?.body ?? "",
          status: existing?.status ?? "DRAFT",
        };
        return acc;
      },
      {} as Record<LocaleCode, { title: string; body: string; status: "DRAFT" | "READY" }>,
    ),
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const tags = form.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const payload = {
      title: form.title,
      summary: form.summary,
      countryCode: showCountry ? form.countryCode : null,
      scenario: showScenario ? form.scenario : null,
      tags,
    };

    try {
      if (item) {
        const response = await fetch(`/api/content/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            locales: LOCALES.map((locale) => ({
              locale,
              title: form.locales[locale].title || form.title,
              body: form.locales[locale].body,
              status: form.locales[locale].status,
            })),
          }),
        });

        if (!response.ok) {
          throw new Error("保存失败");
        }

        if (window.location.pathname.endsWith("/edit")) {
          router.push(window.location.pathname.replace(/\/edit$/, ""));
        } else {
          router.refresh();
        }
      } else {
        const response = await fetch("/api/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: form.type,
            ...payload,
            primaryLocale: defaultLocale,
            body: form.locales[defaultLocale].body || form.locales.zh.body,
          }),
        });

        if (!response.ok) {
          throw new Error("创建失败");
        }

        const created = (await response.json()) as ItemWithLocales;
        router.push(`${window.location.pathname.replace("/new", "")}/${created.id}`);
        router.refresh();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {!item ? (
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600 dark:text-zinc-400">类型</span>
            <select
              value={form.type}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  type: event.target.value as ContentType,
                }))
              }
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            >
              {allowedTypes.map((type) => (
                <option key={type} value={type}>
                  {CONTENT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {showScenario ? (
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600 dark:text-zinc-400">场景</span>
            <select
              value={form.scenario}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  scenario: event.target.value as ScriptScenario,
                }))
              }
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            >
              {SCENARIOS.map((scenario) => (
                <option key={scenario} value={scenario}>
                  {SCRIPT_SCENARIO_LABELS[scenario]}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="block text-sm md:col-span-2">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">标题</span>
          <input
            required
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value }))
            }
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        <label className="block text-sm md:col-span-2">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">摘要</span>
          <input
            value={form.summary}
            onChange={(event) =>
              setForm((current) => ({ ...current, summary: event.target.value }))
            }
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        {showCountry ? (
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600 dark:text-zinc-400">国家代码</span>
            <input
              value={form.countryCode}
              onChange={(event) =>
                setForm((current) => ({ ...current, countryCode: event.target.value }))
              }
              placeholder="NG / GH / CI"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 uppercase dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
        ) : null}

        <label className="block text-sm md:col-span-2">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">标签（逗号分隔）</span>
          <input
            value={form.tags}
            onChange={(event) =>
              setForm((current) => ({ ...current, tags: event.target.value }))
            }
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>

      <div>
        <div className="mb-3 flex gap-2">
          {LOCALES.map((locale) => (
            <button
              key={locale}
              type="button"
              onClick={() => setActiveLocale(locale)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                activeLocale === locale
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "border border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
              }`}
            >
              {LOCALE_LABELS[locale]}
            </button>
          ))}
        </div>

        <div className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600 dark:text-zinc-400">
              {LOCALE_LABELS[activeLocale]}标题
            </span>
            <input
              value={form.locales[activeLocale].title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  locales: {
                    ...current.locales,
                    [activeLocale]: {
                      ...current.locales[activeLocale],
                      title: event.target.value,
                    },
                  },
                }))
              }
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600 dark:text-zinc-400">正文</span>
            <textarea
              rows={14}
              value={form.locales[activeLocale].body}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  locales: {
                    ...current.locales,
                    [activeLocale]: {
                      ...current.locales[activeLocale],
                      body: event.target.value,
                    },
                  },
                }))
              }
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm leading-6 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={form.locales[activeLocale].status === "READY"}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  locales: {
                    ...current.locales,
                    [activeLocale]: {
                      ...current.locales[activeLocale],
                      status: event.target.checked ? "READY" : "DRAFT",
                    },
                  },
                }))
              }
            />
            该语言版本已完成
          </label>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {saving ? "保存中..." : item ? "保存" : "创建"}
        </button>
      </div>
    </form>
  );
}
