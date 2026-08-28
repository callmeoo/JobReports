"use client";

import { useState } from "react";

import type { LeadershipItem } from "@/lib/reports/types";

export function LeadershipItemsReader({
  items,
}: {
  items: LeadershipItem[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-500">暂无事项记录</p>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
            {item.title || "未命名事项"}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {item.result || "—"}
          </p>

          {item.hasProcess && item.process ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => toggle(item.id)}
                className="text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                {expanded.has(item.id) ? "收起过程 ▲" : "查看过程 ▼"}
              </button>
              {expanded.has(item.id) ? (
                <p className="mt-2 rounded-lg bg-zinc-50 p-3 text-sm leading-relaxed text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  {item.process}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
