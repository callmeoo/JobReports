import { NextResponse } from "next/server";
import type { BuyerSource, BuyerStage } from "@prisma/client";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workspaceAuthorFilter } from "@/lib/workspace";

type UpdateBody = {
  companyName?: string;
  contactName?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  email?: string | null;
  countryCode?: string | null;
  city?: string | null;
  source?: BuyerSource;
  sourceRef?: string | null;
  stage?: BuyerStage;
  tier?: string | null;
  nextFollowUpAt?: string | null;
  notes?: string | null;
  tags?: string[];
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const authorFilter = await workspaceAuthorFilter();
  const buyer = await db.buyer.findFirst({
    where: { id, ...authorFilter },
    include: {
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  if (!buyer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(buyer);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const authorFilter = await workspaceAuthorFilter();
  const existing = await db.buyer.findFirst({
    where: { id, ...authorFilter },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as UpdateBody;

  const buyer = await db.buyer.update({
    where: { id },
    data: {
      companyName: body.companyName?.trim() ?? undefined,
      contactName:
        body.contactName === undefined ? undefined : body.contactName?.trim() || null,
      whatsapp: body.whatsapp === undefined ? undefined : body.whatsapp?.trim() || null,
      phone: body.phone === undefined ? undefined : body.phone?.trim() || null,
      email: body.email === undefined ? undefined : body.email?.trim() || null,
      countryCode:
        body.countryCode === undefined
          ? undefined
          : body.countryCode?.trim().toUpperCase() || null,
      city: body.city === undefined ? undefined : body.city?.trim() || null,
      source: body.source ?? undefined,
      sourceRef:
        body.sourceRef === undefined ? undefined : body.sourceRef?.trim() || null,
      stage: body.stage ?? undefined,
      tier: body.tier === undefined ? undefined : body.tier?.trim() || null,
      nextFollowUpAt:
        body.nextFollowUpAt === undefined
          ? undefined
          : body.nextFollowUpAt
            ? new Date(body.nextFollowUpAt)
            : null,
      notes: body.notes === undefined ? undefined : body.notes?.trim() || null,
      tags: body.tags ?? undefined,
    },
    include: {
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  return NextResponse.json(buyer);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const authorFilter = await workspaceAuthorFilter();
  const existing = await db.buyer.findFirst({
    where: { id, ...authorFilter },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.buyer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
