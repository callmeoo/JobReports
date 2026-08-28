import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  ensureWeeklyReport,
  serializeDailyReport,
} from "@/lib/reports/helpers";
import { parseDateKey } from "@/lib/reports/dates";
import type { LeadershipItem } from "@/lib/reports/types";
import type { ReportStatus } from "@prisma/client";

type CreateDailyBody = {
  reportDate: string;
  doneToday?: string;
  processNotes?: string;
  reflection?: string;
  leadershipSummary?: string;
  leadershipItems?: LeadershipItem[];
  status?: ReportStatus;
};

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");

  let dateFilter: { gte?: Date; lte?: Date } | undefined;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, mon] = month.split("-").map(Number);
    dateFilter = {
      gte: new Date(Date.UTC(year, mon - 1, 1)),
      lte: new Date(Date.UTC(year, mon, 0)),
    };
  }

  const reports = await db.dailyReport.findMany({
    where: {
      authorId: session.user.id,
      ...(dateFilter ? { reportDate: dateFilter } : {}),
    },
    orderBy: { reportDate: "desc" },
    take: 100,
  });

  return NextResponse.json(reports.map(serializeDailyReport));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as CreateDailyBody;
  if (!body.reportDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.reportDate)) {
    return NextResponse.json({ error: "缺少有效 reportDate" }, { status: 400 });
  }

  const reportDate = parseDateKey(body.reportDate);
  const weekly = await ensureWeeklyReport(session.user.id, reportDate);

  const existing = await db.dailyReport.findUnique({
    where: {
      authorId_reportDate: {
        authorId: session.user.id,
        reportDate,
      },
    },
  });

  if (existing) {
    return NextResponse.json({ error: "该日期日报已存在" }, { status: 409 });
  }

  const report = await db.dailyReport.create({
    data: {
      authorId: session.user.id,
      reportDate,
      weeklyReportId: weekly.id,
      doneToday: body.doneToday ?? "",
      processNotes: body.processNotes ?? null,
      reflection: body.reflection ?? null,
      leadershipSummary: body.leadershipSummary ?? "",
      leadershipItems: body.leadershipItems ?? [],
      status: body.status ?? "DRAFT",
    },
  });

  return NextResponse.json(serializeDailyReport(report), { status: 201 });
}
