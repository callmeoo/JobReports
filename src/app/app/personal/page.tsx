import Link from "next/link";

import { ContentList } from "@/components/content-list";
import { auth } from "@/lib/auth";
import { PERSONAL_TYPES } from "@/lib/content-types";
import { db } from "@/lib/db";

export default async function PersonalPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const items = await db.contentItem.findMany({
    where: {
      authorId: session.user.id,
      type: { in: PERSONAL_TYPES },
    },
    include: { locales: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">个人库</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            日记、周报、月报与日常复盘。
          </p>
        </div>
        <Link
          href="/app/personal/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          新建
        </Link>
      </div>

      <ContentList items={items} basePath="/app/personal" />
    </div>
  );
}
