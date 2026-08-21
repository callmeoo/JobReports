import { notFound } from "next/navigation";

import { ContentReader } from "@/components/content-reader";
import { auth } from "@/lib/auth";
import { MATERIAL_TYPES } from "@/lib/content-types";
import { db } from "@/lib/db";

export default async function MaterialReadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const { id } = await params;
  const item = await db.contentItem.findFirst({
    where: {
      id,
      authorId: session.user.id,
      type: { in: MATERIAL_TYPES },
    },
    include: { locales: { orderBy: { locale: "asc" } } },
  });

  if (!item) notFound();

  return (
    <ContentReader
      item={item}
      editHref={`/app/materials/${item.id}/edit`}
      preferLocale="en"
      enableCopy
    />
  );
}
