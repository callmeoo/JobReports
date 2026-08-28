"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { ContentItem, ContentLocale } from "@prisma/client";

type ItemWithLocales = ContentItem & { locales: ContentLocale[] };

function pickZhBody(item: ItemWithLocales): string {
  const zh = item.locales.find((l) => l.locale === "zh" && l.body.trim());
  return (zh ?? item.locales.find((l) => l.body.trim()))?.body?.trim() ?? "";
}

export function isMarketResearchHtml(body: string): boolean {
  const trimmed = body.trim();
  return (
    trimmed.startsWith("<section") ||
    trimmed.startsWith("<div") ||
    trimmed.startsWith("<!-- format:html")
  );
}

export function MarketResearchReader({
  item,
  editHref,
}: {
  item: ItemWithLocales;
  editHref: string;
}) {
  const [copied, setCopied] = useState(false);
  const body = useMemo(() => pickZhBody(item), [item]);

  async function copyText() {
    const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="mx-auto max-w-[1080px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
          <span>市场调研</span>
          {item.countryCode ? <span>· {item.countryCode}</span> : null}
          <span>· 更新于 {new Date(item.updatedAt).toLocaleString("zh-CN")}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyText}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
          >
            {copied ? "已复制" : "复制纯文本"}
          </button>
          <Link
            href={editHref}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
          >
            编辑
          </Link>
        </div>
      </div>

      {item.tags.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-1">
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

      <div className="mr-report overflow-hidden rounded-2xl border border-zinc-200 bg-[#f6f8fb] shadow-sm dark:border-zinc-800">
        <style>{MARKET_RESEARCH_STYLES}</style>
        {isMarketResearchHtml(body) ? (
          <div
            className="mr-report-body"
            dangerouslySetInnerHTML={{ __html: body.replace(/^<!-- format:html -->\s*/i, "") }}
          />
        ) : (
          <div className="mr-report-body p-8">
            <pre className="whitespace-pre-wrap font-sans text-[15px] leading-8 text-[#1f2937]">
              {body || "这篇还没有正文。"}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

/** Scoped styles aligned with UCC jiji_ng_foreign_used_market_analysis.html */
const MARKET_RESEARCH_STYLES = `
.mr-report-body {
  --mr-bg: #f6f8fb;
  --mr-card: #ffffff;
  --mr-text: #1f2937;
  --mr-muted: #6b7280;
  --mr-accent: #1a365d;
  --mr-border: #e5e7eb;
  color: var(--mr-text);
  line-height: 1.6;
  font-family: "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif;
  padding: 32px 20px 64px;
}
.mr-report-body .hero {
  background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
  color: #fff;
  border-radius: 16px;
  padding: 28px 32px;
  margin-bottom: 24px;
}
.mr-report-body .hero h1 { margin: 0 0 8px; font-size: 1.8rem; font-weight: 700; }
.mr-report-body .hero p { margin: 4px 0; opacity: 0.92; }
.mr-report-body .card {
  background: var(--mr-card);
  border: 1px solid var(--mr-border);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,.04);
}
.mr-report-body h2 { color: var(--mr-accent); margin: 0 0 16px; font-size: 1.25rem; font-weight: 600; }
.mr-report-body h3 { margin: 18px 0 10px; font-size: 1.05rem; font-weight: 600; }
.mr-report-body table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.92rem;
}
.mr-report-body th,
.mr-report-body td {
  border: 1px solid var(--mr-border);
  padding: 10px 12px;
  vertical-align: top;
  text-align: left;
}
.mr-report-body th { background: #dbeafe; color: #1e3a5f; font-weight: 600; }
.mr-report-body .stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-top: 8px;
}
.mr-report-body .stat {
  background: #f8fafc;
  border: 1px solid var(--mr-border);
  border-radius: 10px;
  padding: 14px;
}
.mr-report-body .stat strong {
  display: block;
  font-size: 1.2rem;
  color: var(--mr-accent);
  font-weight: 700;
  margin-bottom: 2px;
}
.mr-report-body .note { color: var(--mr-muted); font-size: 0.88rem; margin-top: 12px; }
.mr-report-body ul { margin: 8px 0 0 18px; padding: 0; }
.mr-report-body li { margin: 6px 0; }
.mr-report-body a { color: #2563eb; text-decoration: underline; }
.mr-report-body .footer {
  text-align: center;
  color: var(--mr-muted);
  font-size: 0.85rem;
  margin-top: 28px;
}
.mr-report-body details.collapsible {
  border: 1px solid var(--mr-border);
  border-radius: 12px;
  background: var(--mr-card);
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,.04);
}
.mr-report-body details.collapsible summary {
  cursor: pointer;
  padding: 20px 24px;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--mr-accent);
  list-style: none;
}
.mr-report-body details.collapsible summary::-webkit-details-marker { display: none; }
.mr-report-body details.collapsible summary::before {
  content: "▸";
  display: inline-block;
  margin-right: 10px;
  transition: transform 0.2s ease;
  color: var(--mr-muted);
}
.mr-report-body details.collapsible[open] summary::before { transform: rotate(90deg); }
.mr-report-body details.collapsible .collapsible-body {
  padding: 0 24px 24px;
  border-top: 1px solid var(--mr-border);
}
.mr-report-body details.collapsible .collapsible-body h3:first-child { margin-top: 16px; }
.mr-report-body code {
  background: #f1f5f9;
  padding: 0.1em 0.35em;
  border-radius: 4px;
  font-size: 0.9em;
}
.mr-report-body p { margin: 0 0 12px; }
.mr-report-body p:last-child { margin-bottom: 0; }
@media (max-width: 640px) {
  .mr-report-body { padding: 16px 12px 40px; }
  .mr-report-body .hero { padding: 20px 18px; }
  .mr-report-body .hero h1 { font-size: 1.35rem; }
  .mr-report-body .card { padding: 16px; overflow-x: auto; }
  .mr-report-body table { font-size: 0.82rem; }
}
`;
