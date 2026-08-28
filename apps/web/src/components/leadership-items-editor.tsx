"use client";

import { useState } from "react";

import {
  createLeadershipItem,
  type LeadershipItem,
} from "@/lib/reports/types";

export function LeadershipItemsEditor({
  items,
  onChange,
}: {
  items: LeadershipItem[];
  onChange: (items: LeadershipItem[]) => void;
}) {
  function updateItem(id: string, patch: Partial<LeadershipItem>) {
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function removeItem(id: string) {
    onChange(items.filter((item) => item.id !== id));
  }

  function addItem() {
    onChange([...items, createLeadershipItem()]);
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div
          key={item.id}
          className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-500">
              事项 {index + 1}
            </span>
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              className="text-sm text-red-600 hover:underline"
            >
              删除
            </button>
          </div>

          <input
            type="text"
            value={item.title}
            onChange={(e) => updateItem(item.id, { title: e.target.value })}
            placeholder="事项标题"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />

          <textarea
            value={item.result}
            onChange={(e) => updateItem(item.id, { result: e.target.value })}
            placeholder="结论 / 结果"
            rows={2}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />

          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={item.hasProcess}
              onChange={(e) =>
                updateItem(item.id, { hasProcess: e.target.checked })
              }
              className="rounded"
            />
            允许领导展开查看过程
          </label>

          {item.hasProcess ? (
            <textarea
              value={item.process ?? ""}
              onChange={(e) => updateItem(item.id, { process: e.target.value })}
              placeholder="过程详情（折叠内容）"
              rows={3}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          ) : null}
        </div>
      ))}

      <button
        type="button"
        onClick={addItem}
        className="rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        + 添加事项
      </button>
    </div>
  );
}
