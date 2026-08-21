import { notFound } from "next/navigation";

import { ContentEditor } from "@/components/content-editor";
import { auth } from "@/lib/auth";
import { PERSONAL_TYPES } from "@/lib/content-types";
import { db } from "@/lib/db";

export default async function PersonalDetailPage({
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
      type: { in: PERSONAL_TYPES },
    },
    include: { locales: { orderBy: { locale: "asc" } } },
  });

  if (!item) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">编辑个人内容</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          最后更新：{new Date(item.updatedAt).toLocaleString("zh-CN")}
        </p>
      </div>
      <ContentEditor item={item} allowedTypes={PERSONAL_TYPES} />
    </div>
  );
}
