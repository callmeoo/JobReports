import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeWeeklyReport } from "@/lib/reports/helpers";
import { getWeekEndKey, parseDateKey } from "@/lib/reports/dates";
import type { LeadershipItem } from "@/lib/reports/types";
import type { ReportStatus } from "@prisma/client";

type CreateWeeklyBody = {
  weekStart: string;
  personalReview?: string;
  experienceNotes?: string;
  leadershipSummary?: string;
  leadershipItems?: LeadershipItem[];
  status?: ReportStatus;
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reports = await db.weeklyReport.findMany({
    where: { authorId: session.user.id },
    include: { dailyReports: { orderBy: { reportDate: "asc" } } },
    orderBy: { weekStart: "desc" },
    take: 52,
  });

  return NextResponse.json(reports.map(serializeWeeklyReport));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as CreateWeeklyBody;
  if (!body.weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(body.weekStart)) {
    return NextResponse.json({ error: "缺少有效 weekStart" }, { status: 400 });
  }

  const weekStart = parseDateKey(body.weekStart);
  const weekEnd = parseDateKey(getWeekEndKey(body.weekStart));

  const existing = await db.weeklyReport.findUnique({
    where: {
      authorId_weekStart: {
        authorId: session.user.id,
        weekStart,
      },
    },
  });

  if (existing) {
    return NextResponse.json({ error: "该周周报已存在" }, { status: 409 });
  }

  const report = await db.weeklyReport.create({
    data: {
      authorId: session.user.id,
      weekStart,
      weekEnd,
      personalReview: body.personalReview ?? "",
      experienceNotes: body.experienceNotes ?? null,
      leadershipSummary: body.leadershipSummary ?? "",
      leadershipItems: body.leadershipItems ?? [],
      status: body.status ?? "DRAFT",
    },
    include: { dailyReports: true },
  });

  return NextResponse.json(serializeWeeklyReport(report), { status: 201 });
}
