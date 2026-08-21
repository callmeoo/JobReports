"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  ACTIVITY_CHANNEL_LABELS,
  BUYER_SOURCE_LABELS,
  BUYER_STAGE_LABELS,
  BUYER_STAGE_ORDER,
} from "@/lib/content-types";
import type { ActivityChannel, BuyerSource, BuyerStage } from "@prisma/client";

const SOURCES = Object.keys(BUYER_SOURCE_LABELS) as BuyerSource[];
const CHANNELS = Object.keys(ACTIVITY_CHANNEL_LABELS) as ActivityChannel[];

function todayInputValue() {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return date.toISOString().slice(0, 10);
}

export function BuyerForm({
  initial,
}: {
  initial?: {
    id?: string;
    companyName?: string;
    contactName?: string | null;
    whatsapp?: string | null;
    phone?: string | null;
    email?: string | null;
    countryCode?: string | null;
    city?: string | null;
    source?: BuyerSource;
    stage?: BuyerStage;
    tier?: string | null;
    nextFollowUpAt?: string | Date | null;
    notes?: string | null;
  };
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    companyName: initial?.companyName ?? "",
    contactName: initial?.contactName ?? "",
    whatsapp: initial?.whatsapp ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    countryCode: initial?.countryCode ?? "NG",
    city: initial?.city ?? "",
    source: initial?.source ?? ("OTHER" as BuyerSource),
    stage: initial?.stage ?? ("NEW" as BuyerStage),
    tier: initial?.tier ?? "",
    nextFollowUpAt: initial?.nextFollowUpAt
      ? new Date(initial.nextFollowUpAt).toISOString().slice(0, 10)
      : todayInputValue(),
    notes: initial?.notes ?? "",
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      companyName: form.companyName,
      contactName: form.contactName || null,
      whatsapp: form.whatsapp || null,
      phone: form.phone || null,
      email: form.email || null,
      countryCode: form.countryCode || null,
      city: form.city || null,
      source: form.source,
      stage: form.stage,
      tier: form.tier || null,
      nextFollowUpAt: form.nextFollowUpAt || null,
      notes: form.notes || null,
    };

    try {
      const response = await fetch(
        initial?.id ? `/api/buyers/${initial.id}` : "/api/buyers",
        {
          method: initial?.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        throw new Error("保存失败");
      }
      const buyer = (await response.json()) as { id: string };
      router.push(`/app/buyers/${buyer.id}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600 dark:text-zinc-400">公司名 *</span>
        <input
          required
          value={form.companyName}
          onChange={(event) =>
            setForm((current) => ({ ...current, companyName: event.target.value }))
          }
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">联系人</span>
          <input
            value={form.contactName}
            onChange={(event) =>
              setForm((current) => ({ ...current, contactName: event.target.value }))
            }
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">WhatsApp *</span>
          <input
            value={form.whatsapp}
            onChange={(event) =>
              setForm((current) => ({ ...current, whatsapp: event.target.value }))
            }
            placeholder="2348012345678"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">电话</span>
          <input
            value={form.phone}
            onChange={(event) =>
              setForm((current) => ({ ...current, phone: event.target.value }))
            }
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">邮箱</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">国家</span>
          <input
            value={form.countryCode}
            onChange={(event) =>
              setForm((current) => ({ ...current, countryCode: event.target.value }))
            }
            placeholder="NG"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 uppercase dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">城市</span>
          <input
            value={form.city}
            onChange={(event) =>
              setForm((current) => ({ ...current, city: event.target.value }))
            }
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">来源</span>
          <select
            value={form.source}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                source: event.target.value as BuyerSource,
              }))
            }
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          >
            {SOURCES.map((source) => (
              <option key={source} value={source}>
                {BUYER_SOURCE_LABELS[source]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">阶段</span>
          <select
            value={form.stage}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                stage: event.target.value as BuyerStage,
              }))
            }
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          >
            {BUYER_STAGE_ORDER.map((stage) => (
              <option key={stage} value={stage}>
                {BUYER_STAGE_LABELS[stage]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">分级（KEY/FOLLOW）</span>
          <input
            value={form.tier}
            onChange={(event) =>
              setForm((current) => ({ ...current, tier: event.target.value }))
            }
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">下次跟进</span>
          <input
            type="date"
            value={form.nextFollowUpAt}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                nextFollowUpAt: event.target.value,
              }))
            }
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600 dark:text-zinc-400">备注</span>
        <textarea
          rows={4}
          value={form.notes}
          onChange={(event) =>
            setForm((current) => ({ ...current, notes: event.target.value }))
          }
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {saving ? "保存中..." : initial?.id ? "保存" : "创建买家"}
        </button>
        <Link
          href={initial?.id ? `/app/buyers/${initial.id}` : "/app/buyers"}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          取消
        </Link>
      </div>
    </form>
  );
}

export function QuickFollowUp({
  buyerId,
  currentStage,
}: {
  buyerId: string;
  currentStage: BuyerStage;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    channel: "WHATSAPP" as ActivityChannel,
    content: "",
    stageAfter: currentStage,
    nextFollowUpAt: todayInputValue(),
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/buyers/${buyerId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: form.channel,
          content: form.content,
          stageAfter: form.stageAfter,
          nextFollowUpAt: form.nextFollowUpAt || null,
        }),
      });
      if (!response.ok) {
        throw new Error("跟进保存失败");
      }
      setForm((current) => ({ ...current, content: "" }));
      setOpen(false);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        记一笔跟进
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">快速跟进</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-zinc-500"
        >
          收起
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">渠道</span>
          <select
            value={form.channel}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                channel: event.target.value as ActivityChannel,
              }))
            }
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          >
            {CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {ACTIVITY_CHANNEL_LABELS[channel]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">推进到</span>
          <select
            value={form.stageAfter}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                stageAfter: event.target.value as BuyerStage,
              }))
            }
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          >
            {BUYER_STAGE_ORDER.map((stage) => (
              <option key={stage} value={stage}>
                {BUYER_STAGE_LABELS[stage]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">下次跟进</span>
          <input
            type="date"
            value={form.nextFollowUpAt}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                nextFollowUpAt: event.target.value,
              }))
            }
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600 dark:text-zinc-400">结果一句话</span>
        <textarea
          required
          rows={3}
          value={form.content}
          onChange={(event) =>
            setForm((current) => ({ ...current, content: event.target.value }))
          }
          placeholder="例如：已发破冰话术，对方已读未回"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {saving ? "保存中..." : "保存跟进"}
      </button>
    </form>
  );
}
