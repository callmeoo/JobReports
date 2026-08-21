import Link from "next/link";

import { ContentList } from "@/components/content-list";
import { auth } from "@/lib/auth";
import { KNOWLEDGE_TYPES } from "@/lib/content-types";
import { db } from "@/lib/db";
import { workspaceAuthorFilter } from "@/lib/workspace";

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const { country } = await searchParams;
  const authorFilter = await workspaceAuthorFilter();

  const [items, countries] = await Promise.all([
    db.contentItem.findMany({
      where: {
        ...authorFilter,
        type: { in: KNOWLEDGE_TYPES },
        ...(country ? { countryCode: country.toUpperCase() } : {}),
      },
      include: { locales: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.contentItem.findMany({
      where: {
        ...authorFilter,
        type: { in: KNOWLEDGE_TYPES },
        countryCode: { not: null },
      },
      select: { countryCode: true },
      distinct: ["countryCode"],
    }),
  ]);

  const countryCodes = countries
    .map((entry) => entry.countryCode)
    .filter((code): code is string => Boolean(code))
    .sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">业务知识</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            按国家整理进口法规与流程，支持多语言版本。
          </p>
        </div>
        <Link
          href="/app/knowledge/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          新建
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterLink href="/app/knowledge" active={!country} label="全部" />
        {countryCodes.map((code) => (
          <FilterLink
            key={code}
            href={`/app/knowledge?country=${code}`}
            active={country?.toUpperCase() === code}
            label={code}
          />
        ))}
      </div>

      <ContentList items={items} basePath="/app/knowledge" />
    </div>
  );
}

function FilterLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-sm ${
        active
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "border border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
      }`}
    >
      {label}
    </Link>
  );
}
