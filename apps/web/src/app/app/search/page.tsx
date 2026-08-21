"use client";

import { useEffect, useState } from "react";

import { ContentList } from "@/components/content-list";
import type { ContentItem, ContentLocale } from "@prisma/client";

type ItemWithLocales = ContentItem & { locales: ContentLocale[] };

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ItemWithLocales[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (query.trim()) {
        params.set("q", query.trim());
      }

      const response = await fetch(`/api/content?${params.toString()}`, {
        signal: controller.signal,
      });

      if (response.ok) {
        const data = (await response.json()) as ItemWithLocales[];
        setItems(data);
      }

      setLoading(false);
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">搜索</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          搜索标题、摘要、标签和正文内容。
        </p>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="输入关键词，例如：尼日利亚、关税、周报"
        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />

      {loading ? (
        <p className="text-sm text-zinc-500">搜索中...</p>
      ) : (
        <ContentList items={items} />
      )}
    </div>
  );
}
