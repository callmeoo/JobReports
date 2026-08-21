"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  CONTENT_TYPE_LABELS,
  LOCALE_LABELS,
  SCRIPT_SCENARIO_LABELS,
} from "@/lib/content-types";
import type { ContentItem, ContentLocale, LocaleCode } from "@prisma/client";

type ItemWithLocales = ContentItem & { locales: ContentLocale[] };

const LOCALES: LocaleCode[] = ["zh", "en", "local"];

function pickLocale(
  locales: ContentLocale[],
  preferred: LocaleCode,
): ContentLocale | undefined {
  return (
    locales.find((item) => item.locale === preferred && item.body.trim()) ??
    locales.find((item) => item.locale === "en" && item.body.trim()) ??
    locales.find((item) => item.locale === "zh" && item.body.trim()) ??
    locales.find((item) => item.body.trim())
  );
}

export function ContentReader({
  item,
  editHref,
  preferLocale = "zh",
  enableCopy = false,
}: {
  item: ItemWithLocales;
  editHref: string;
  preferLocale?: LocaleCode;
  enableCopy?: boolean;
}) {
  const [locale, setLocale] = useState<LocaleCode>(preferLocale);
  const [copied, setCopied] = useState(false);
  const current = useMemo(
    () => pickLocale(item.locales, locale),
    [item.locales, locale],
  );
  const paragraphs = (current?.body ?? "").split(/\n{2,}/).filter(Boolean);
  const fallbacking = current?.locale && current.locale !== locale;

  async function copyBody() {
    if (!current?.body?.trim()) return;
    await navigator.clipboard.writeText(current.body.trim());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-zinc-500">
            {CONTENT_TYPE_LABELS[item.type]}
            {item.scenario ? ` · ${SCRIPT_SCENARIO_LABELS[item.scenario]}` : ""}
            {item.countryCode ? ` · ${item.countryCode}` : ""}
          </p>
          <h1 className="mt-2 text-2xl font-semibold leading-snug">
            {current?.title || item.title}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            更新于 {new Date(item.updatedAt).toLocaleString("zh-CN")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {enableCopy ? (
            <button
              type="button"
              onClick={copyBody}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {copied ? "已复制" : "复制正文"}
            </button>
          ) : null}
          <Link
            href={editHref}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
          >
            编辑
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {LOCALES.map((code) => {
          const available = item.locales.some(
            (entry) => entry.locale === code && entry.body.trim(),
          );
          return (
            <button
              key={code}
              type="button"
              onClick={() => setLocale(code)}
              className={`rounded-full px-3 py-1 text-sm ${
                locale === code
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "border border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
              }`}
            >
              {LOCALE_LABELS[code]}
              {!available ? " · 暂无" : ""}
            </button>
          );
        })}
      </div>

      {item.summary ? (
        <p className="rounded-xl bg-zinc-50 p-4 text-sm leading-7 text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
          {item.summary}
        </p>
      ) : null}

      {item.tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {fallbacking && current ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          当前语言暂无正文，已显示{LOCALE_LABELS[current.locale]}版本。
        </p>
      ) : null}

      <div className="space-y-4 text-[15px] leading-8 text-zinc-800 dark:text-zinc-200">
        {paragraphs.length === 0 ? (
          <p className="text-zinc-500">这篇还没有正文。</p>
        ) : (
          paragraphs.map((paragraph, index) => (
            <p key={index} className="whitespace-pre-wrap">
              {paragraph.trim()}
            </p>
          ))
        )}
      </div>
    </article>
  );
}
