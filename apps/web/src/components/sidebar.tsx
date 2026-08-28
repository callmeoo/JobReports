"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/app", label: "总览" },
  { href: "/app/buyers", label: "买家运营" },
  { href: "/app/materials", label: "运营素材" },
  { href: "/app/knowledge", label: "业务知识" },
  { href: "/app/market-research", label: "市场调研" },
  { href: "/app/reports", label: "工作汇报" },
  { href: "/app/personal", label: "个人库" },
  { href: "/app/search", label: "搜索" },
];

const PLACEHOLDER_ITEMS = [
  { label: "SEO/GEO", note: "后续" },
  { label: "采销合同", note: "后续" },
  { label: "产品规划", note: "后续" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <p className="text-xs uppercase tracking-wide text-zinc-500">JiJi Ops</p>
        <h1 className="text-lg font-semibold">个人工作中枢</h1>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}

        <div className="pt-4">
          <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
            待开发
          </p>
          {PLACEHOLDER_ITEMS.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-zinc-400"
            >
              <span>{item.label}</span>
              <span className="text-xs">{item.note}</span>
            </div>
          ))}
        </div>
      </nav>
    </aside>
  );
}
