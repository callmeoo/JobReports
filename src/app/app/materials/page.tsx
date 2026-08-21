import Link from "next/link";

import { ContentList } from "@/components/content-list";
import { auth } from "@/lib/auth";
import { SCRIPT_SCENARIO_LABELS } from "@/lib/content-types";
import { db } from "@/lib/db";
import { workspaceAuthorFilter } from "@/lib/workspace";
import type { ScriptScenario } from "@prisma/client";

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string; country?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const { scenario, country } = await searchParams;
  const scenarioFilter = scenario?.toUpperCase() as ScriptScenario | undefined;
  const authorFilter = await workspaceAuthorFilter();

  const items = await db.contentItem.findMany({
    where: {
      ...authorFilter,
      type: "SCRIPT",
      ...(scenarioFilter ? { scenario: scenarioFilter } : {}),
      ...(country ? { countryCode: country.toUpperCase() } : {}),
    },
    include: { locales: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">运营素材</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            话术库。阅读页可一键复制；买家详情里也能直接选用。
          </p>
        </div>
        <Link
          href="/app/materials/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          新建话术
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterLink href="/app/materials" active={!scenario} label="全部" />
        {(Object.keys(SCRIPT_SCENARIO_LABELS) as ScriptScenario[]).map((entry) => (
          <FilterLink
            key={entry}
            href={`/app/materials?scenario=${entry}`}
            active={scenarioFilter === entry}
            label={SCRIPT_SCENARIO_LABELS[entry]}
          />
        ))}
      </div>

      <ContentList items={items} basePath="/app/materials" />
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
