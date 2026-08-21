import Link from "next/link";

import { auth } from "@/lib/auth";
import {
  BUYER_SOURCE_LABELS,
  BUYER_STAGE_LABELS,
  BUYER_STAGE_ORDER,
  whatsappLink,
} from "@/lib/content-types";
import { db } from "@/lib/db";
import { workspaceAuthorFilter } from "@/lib/workspace";
import type { BuyerStage } from "@prisma/client";

export default async function BuyersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; stage?: string; country?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const { tab = "todo", stage, country } = await searchParams;
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const authorFilter = await workspaceAuthorFilter();

  const where = {
    ...authorFilter,
    ...(country ? { countryCode: country.toUpperCase() } : {}),
    ...(tab === "todo"
      ? {
          stage: { notIn: ["WON", "PAUSED"] as BuyerStage[] },
          OR: [
            { nextFollowUpAt: { lte: endOfToday } },
            { nextFollowUpAt: null, stage: "NEW" as const },
          ],
        }
      : {}),
    ...(tab === "all" && stage
      ? { stage: stage.toUpperCase() as BuyerStage }
      : {}),
  };

  const [buyers, todoCount, allCount] = await Promise.all([
    db.buyer.findMany({
      where,
      include: { activities: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: [{ nextFollowUpAt: "asc" }, { updatedAt: "desc" }],
      take: 500,
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
    db.buyer.count({ where: authorFilter }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">买家运营</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            默认看今天该跟的人。WhatsApp 为主，记跟进只要一句话。
          </p>
        </div>
        <Link
          href="/app/buyers/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          新建买家
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <TabLink href="/app/buyers?tab=todo" active={tab === "todo"} label={`今日待办 (${todoCount})`} />
        <TabLink href="/app/buyers?tab=all" active={tab === "all"} label={`全部买家 (${allCount})`} />
      </div>

      {tab === "all" ? (
        <div className="flex flex-wrap gap-2">
          <StageLink href="/app/buyers?tab=all" active={!stage} label="全部阶段" />
          {BUYER_STAGE_ORDER.map((entry) => (
            <StageLink
              key={entry}
              href={`/app/buyers?tab=all&stage=${entry}`}
              active={stage?.toUpperCase() === entry}
              label={BUYER_STAGE_LABELS[entry]}
            />
          ))}
        </div>
      ) : null}

      {buyers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {tab === "todo"
            ? "今天没有待跟进。去「全部买家」看看，或新建一个买家。"
            : "还没有买家，点右上角新建。"}
        </div>
      ) : (
        <div className="space-y-3">
          {buyers.map((buyer) => {
            const wa = whatsappLink(buyer.whatsapp);
            const dueLabel = buyer.nextFollowUpAt
              ? new Date(buyer.nextFollowUpAt).toLocaleDateString("zh-CN")
              : "未设跟进日";
            const overdue =
              buyer.nextFollowUpAt &&
              new Date(buyer.nextFollowUpAt) < startOfToday &&
              !["WON", "PAUSED"].includes(buyer.stage);

            return (
              <div
                key={buyer.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/app/buyers/${buyer.id}`}
                      className="text-base font-medium hover:underline"
                    >
                      {buyer.companyName}
                    </Link>
                    <p className="mt-1 text-xs text-zinc-500">
                      {BUYER_STAGE_LABELS[buyer.stage]}
                      {buyer.tier ? ` · ${buyer.tier}` : ""}
                      {buyer.countryCode ? ` · ${buyer.countryCode}` : ""}
                      {buyer.city ? ` · ${buyer.city}` : ""}
                      {` · ${BUYER_SOURCE_LABELS[buyer.source]}`}
                    </p>
                    <p className={`mt-2 text-sm ${overdue ? "text-amber-700" : "text-zinc-600 dark:text-zinc-400"}`}>
                      下次跟进：{dueLabel}
                      {overdue ? "（已逾期）" : ""}
                    </p>
                    {buyer.activities[0] ? (
                      <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
                        最近：{buyer.activities[0].content}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white"
                      >
                        WhatsApp
                      </a>
                    ) : null}
                    <Link
                      href={`/app/buyers/${buyer.id}`}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
                    >
                      打开
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabLink({
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
      className={`rounded-lg px-3 py-1.5 text-sm ${
        active
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "border border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
      }`}
    >
      {label}
    </Link>
  );
}

function StageLink({
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
