import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeWeeklyReport } from "@/lib/reports/helpers";
import { getWeekEndKey, parseDateKey } from "@/lib/reports/dates";
import type { LeadershipItem } from "@/lib/reports/types";
import type { ReportStatus } from "@prisma/client";

type UpdateWeeklyBody = {
  personalReview?: string;
  experienceNotes?: string | null;
  leadershipSummary?: string;
  leadershipItems?: LeadershipItem[];
  status?: ReportStatus;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ weekStart: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { weekStart: weekStartKey } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartKey)) {
    return NextResponse.json({ error: "无效周起始日期" }, { status: 400 });
  }

  const report = await db.weeklyReport.findUnique({
    where: {
      authorId_weekStart: {
        authorId: session.user.id,
        weekStart: parseDateKey(weekStartKey),
      },
    },
    include: { dailyReports: { orderBy: { reportDate: "asc" } } },
  });

  if (!report) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }

  return NextResponse.json(serializeWeeklyReport(report));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ weekStart: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { weekStart: weekStartKey } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartKey)) {
    return NextResponse.json({ error: "无效周起始日期" }, { status: 400 });
  }

  const weekStart = parseDateKey(weekStartKey);
  const weekEnd = parseDateKey(getWeekEndKey(weekStartKey));
  const body = (await request.json()) as UpdateWeeklyBody;

  const report = await db.weeklyReport.upsert({
    where: {
      authorId_weekStart: {
        authorId: session.user.id,
        weekStart,
      },
    },
    create: {
      authorId: session.user.id,
      weekStart,
      weekEnd,
      personalReview: body.personalReview ?? "",
      experienceNotes: body.experienceNotes ?? null,
      leadershipSummary: body.leadershipSummary ?? "",
      leadershipItems: body.leadershipItems ?? [],
      status: body.status ?? "DRAFT",
    },
    update: {
      ...(body.personalReview !== undefined
        ? { personalReview: body.personalReview }
        : {}),
      ...(body.experienceNotes !== undefined
        ? { experienceNotes: body.experienceNotes }
        : {}),
      ...(body.leadershipSummary !== undefined
        ? { leadershipSummary: body.leadershipSummary }
        : {}),
      ...(body.leadershipItems !== undefined
        ? { leadershipItems: body.leadershipItems }
        : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
    },
    include: { dailyReports: { orderBy: { reportDate: "asc" } } },
  });

  return NextResponse.json(serializeWeeklyReport(report));
}
