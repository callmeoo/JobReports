import Link from "next/link";

import { ContentList } from "@/components/content-list";
import { auth } from "@/lib/auth";
import { KNOWLEDGE_TYPES, MARKET_RESEARCH_TYPES, PERSONAL_TYPES } from "@/lib/content-types";
import { db } from "@/lib/db";
import { workspaceAuthorFilter } from "@/lib/workspace";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const authorFilter = await workspaceAuthorFilter();

  const [
    recent,
    personalCount,
    knowledgeCount,
    marketResearchCount,
    materialCount,
    todoBuyers,
  ] = await Promise.all([
    db.contentItem.findMany({
      where: authorFilter,
      include: { locales: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    db.contentItem.count({
      where: { ...authorFilter, type: { in: PERSONAL_TYPES } },
    }),
    db.contentItem.count({
      where: { ...authorFilter, type: { in: KNOWLEDGE_TYPES } },
    }),
    db.contentItem.count({
      where: { ...authorFilter, type: { in: MARKET_RESEARCH_TYPES } },
    }),
    db.contentItem.count({
      where: { ...authorFilter, type: "SCRIPT" },
    }),
    db.buyer.count({
      where: {
        ...authorFilter,
        stage: { notIn: ["WON", "PAUSED"] },
        OR: [
          { nextFollowUpAt: { lte: endOfToday } },
          { nextFollowUpAt: null, stage: "NEW" },
        ],
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">总览</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          今天先处理待跟进买家，话术和业务知识随用随查。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard label="今日待跟进" value={todoBuyers} href="/app/buyers?tab=todo" />
        <StatCard label="运营话术" value={materialCount} href="/app/materials" />
        <StatCard label="业务知识" value={knowledgeCount} href="/app/knowledge" />
        <StatCard label="市场调研" value={marketResearchCount} href="/app/market-research" />
        <StatCard label="个人库" value={personalCount} href="/app/personal" />
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">最近内容</h2>
          <Link href="/app/search" className="text-sm text-zinc-600 underline dark:text-zinc-400">
            搜索全部
          </Link>
        </div>
        <ContentList items={recent} />
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
    >
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </Link>
  );
}
