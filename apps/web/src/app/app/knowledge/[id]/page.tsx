import { notFound } from "next/navigation";

import { ContentReader } from "@/components/content-reader";
import { auth } from "@/lib/auth";
import { KNOWLEDGE_TYPES } from "@/lib/content-types";
import { db } from "@/lib/db";

export default async function KnowledgeReadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const { id } = await params;
  const item = await db.contentItem.findFirst({
    where: {
      id,
      authorId: session.user.id,
      type: { in: KNOWLEDGE_TYPES },
    },
    include: { locales: { orderBy: { locale: "asc" } } },
  });

  if (!item) {
    notFound();
  }

  return <ContentReader item={item} editHref={`/app/knowledge/${item.id}/edit`} />;
}
