import { NextResponse } from "next/server";
import type { BuyerSource, BuyerStage } from "@prisma/client";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workspaceAuthorFilter } from "@/lib/workspace";

type CreateBody = {
  companyName: string;
  contactName?: string;
  whatsapp?: string;
  phone?: string;
  email?: string;
  countryCode?: string;
  city?: string;
  source?: BuyerSource;
  sourceRef?: string;
  stage?: BuyerStage;
  tier?: string;
  nextFollowUpAt?: string | null;
  notes?: string;
  tags?: string[];
};

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const stage = searchParams.get("stage") as BuyerStage | null;
  const country = searchParams.get("country");
  const due = searchParams.get("due"); // today | overdue | all
  const q = searchParams.get("q")?.trim();

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const authorFilter = await workspaceAuthorFilter();

  const buyers = await db.buyer.findMany({
    where: {
      ...authorFilter,
      ...(stage ? { stage } : {}),
      ...(country ? { countryCode: country.toUpperCase() } : {}),
      ...(due === "today"
        ? {
            nextFollowUpAt: { gte: startOfToday, lte: endOfToday },
            stage: { notIn: ["WON", "PAUSED"] },
          }
        : {}),
      ...(due === "overdue"
        ? {
            nextFollowUpAt: { lt: startOfToday },
            stage: { notIn: ["WON", "PAUSED"] },
          }
        : {}),
      ...(due === "todo"
        ? {
            OR: [
              { nextFollowUpAt: { lte: endOfToday } },
              { nextFollowUpAt: null, stage: "NEW" },
            ],
            stage: { notIn: ["WON", "PAUSED"] },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { companyName: { contains: q, mode: "insensitive" } },
              { contactName: { contains: q, mode: "insensitive" } },
              { whatsapp: { contains: q } },
              { email: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      activities: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ nextFollowUpAt: "asc" }, { updatedAt: "desc" }],
    take: 500,
  });

  return NextResponse.json(buyers);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as CreateBody;
  if (!body.companyName?.trim()) {
    return NextResponse.json({ error: "公司名必填" }, { status: 400 });
  }

  const buyer = await db.buyer.create({
    data: {
      companyName: body.companyName.trim(),
      contactName: body.contactName?.trim() || null,
      whatsapp: body.whatsapp?.trim() || null,
      phone: body.phone?.trim() || null,
      email: body.email?.trim() || null,
      countryCode: body.countryCode?.trim().toUpperCase() || null,
      city: body.city?.trim() || null,
      source: body.source ?? "OTHER",
      sourceRef: body.sourceRef?.trim() || null,
      stage: body.stage ?? "NEW",
      tier: body.tier?.trim() || null,
      nextFollowUpAt: body.nextFollowUpAt ? new Date(body.nextFollowUpAt) : null,
      notes: body.notes?.trim() || null,
      tags: body.tags ?? [],
      authorId: session.user.id,
    },
  });

  return NextResponse.json(buyer, { status: 201 });
}
