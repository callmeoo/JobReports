import { notFound } from "next/navigation";

import { MarketResearchReader } from "@/components/market-research-reader";
import { auth } from "@/lib/auth";
import { MARKET_RESEARCH_TYPES } from "@/lib/content-types";
import { db } from "@/lib/db";
import { workspaceAuthorFilter } from "@/lib/workspace";

export default async function MarketResearchReadPage({
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
    <MarketResearchReader
      item={item}
      editHref={`/app/market-research/${item.id}/edit`}
    />
  );
}
