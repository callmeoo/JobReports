import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentEditor } from "@/components/content-editor";
import { auth } from "@/lib/auth";
import { KNOWLEDGE_TYPES } from "@/lib/content-types";
import { db } from "@/lib/db";

export default async function KnowledgeEditPage({
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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">编辑业务知识</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {item.countryCode ? `国家：${item.countryCode} · ` : ""}
            最后更新：{new Date(item.updatedAt).toLocaleString("zh-CN")}
          </p>
        </div>
        <Link
          href={`/app/knowledge/${item.id}`}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          返回阅读
        </Link>
      </div>
      <ContentEditor item={item} allowedTypes={KNOWLEDGE_TYPES} showCountry />
    </div>
  );
}
