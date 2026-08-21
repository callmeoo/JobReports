import Link from "next/link";
import { notFound } from "next/navigation";

import { BuyerForm, QuickFollowUp } from "@/components/buyer-forms";
import { ScriptPicker } from "@/components/script-picker";
import { auth } from "@/lib/auth";
import {
  ACTIVITY_CHANNEL_LABELS,
  BUYER_SOURCE_LABELS,
  BUYER_STAGE_LABELS,
  whatsappLink,
} from "@/lib/content-types";
import { db } from "@/lib/db";
import { workspaceAuthorFilter } from "@/lib/workspace";

export default async function BuyerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const { id } = await params;
  const { edit } = await searchParams;
  const authorFilter = await workspaceAuthorFilter();

  const buyer = await db.buyer.findFirst({
    where: { id, ...authorFilter },
    include: { activities: { orderBy: { createdAt: "desc" }, take: 50 } },
  });

  if (!buyer) notFound();

  if (edit === "1") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">编辑买家</h1>
          <Link
            href={`/app/buyers/${buyer.id}`}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
          >
            返回
          </Link>
        </div>
        <BuyerForm initial={buyer} />
      </div>
    );
  }

  const wa = whatsappLink(buyer.whatsapp);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-zinc-500">
            {BUYER_STAGE_LABELS[buyer.stage]}
            {buyer.tier ? ` · ${buyer.tier}` : ""}
            {` · ${BUYER_SOURCE_LABELS[buyer.source]}`}
          </p>
          <h1 className="mt-2 text-2xl font-semibold">{buyer.companyName}</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {[buyer.contactName, buyer.city, buyer.countryCode].filter(Boolean).join(" · ") ||
              "暂无联系人/城市"}
          </p>
        </div>
        <Link
          href={`/app/buyers/${buyer.id}?edit=1`}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          编辑资料
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white"
          >
            打开 WhatsApp
          </a>
        ) : null}
        {buyer.email ? (
          <a
            href={`mailto:${buyer.email}`}
            className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm dark:border-zinc-700"
          >
            发邮件
          </a>
        ) : null}
        <QuickFollowUp buyerId={buyer.id} currentStage={buyer.stage} />
        <ScriptPicker buyerId={buyer.id} countryCode={buyer.countryCode} />
      </div>

      <div className="grid gap-3 rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800 md:grid-cols-2">
        <Info label="WhatsApp" value={buyer.whatsapp} />
        <Info label="电话" value={buyer.phone} />
        <Info label="邮箱" value={buyer.email} />
        <Info
          label="下次跟进"
          value={
            buyer.nextFollowUpAt
              ? new Date(buyer.nextFollowUpAt).toLocaleDateString("zh-CN")
              : null
          }
        />
      </div>

      {buyer.notes ? (
        <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-7 dark:bg-zinc-950">
          {buyer.notes}
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">跟进时间线</h2>
        {buyer.activities.length === 0 ? (
          <p className="text-sm text-zinc-500">还没有跟进记录。先记一笔或用话术触达。</p>
        ) : (
          <div className="space-y-3">
            {buyer.activities.map((activity) => (
              <div
                key={activity.id}
                className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <p className="text-xs text-zinc-500">
                  {new Date(activity.createdAt).toLocaleString("zh-CN")}
                  {` · ${ACTIVITY_CHANNEL_LABELS[activity.channel]}`}
                  {activity.stageAfter
                    ? ` · → ${BUYER_STAGE_LABELS[activity.stageAfter]}`
                    : ""}
                  {activity.scriptTitle ? ` · 话术：${activity.scriptTitle}` : ""}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{activity.content}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-zinc-800 dark:text-zinc-200">{value || "—"}</p>
    </div>
  );
}
