import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentEditor } from "@/components/content-editor";
import { auth } from "@/lib/auth";
import { MARKET_RESEARCH_TYPES } from "@/lib/content-types";
import { db } from "@/lib/db";
import { workspaceAuthorFilter } from "@/lib/workspace";

export default async function MarketResearchEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const { id } = await params;
  const authorFilter = await workspaceAuthorFilter();
  const item = await db.contentItem.findFirst({
    where: {
      id,
      ...authorFilter,
      type: { in: MARKET_RESEARCH_TYPES },
    },
    include: { locales: { orderBy: { locale: "asc" } } },
  });

  if (!item) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">编辑市场调研</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {item.countryCode ? `国家：${item.countryCode} · ` : ""}
            最后更新：{new Date(item.updatedAt).toLocaleString("zh-CN")}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            支持 HTML 报告正文（卡片/表格/统计块）；纯文本会以简单排版显示。
          </p>
        </div>
        <Link
          href={`/app/market-research/${item.id}`}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          返回阅读
        </Link>
      </div>
      <ContentEditor
        item={item}
        allowedTypes={MARKET_RESEARCH_TYPES}
        showCountry
      />
    </div>
  );
}
