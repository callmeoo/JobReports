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

type UpdateDailyBody = {
  doneToday?: string;
  processNotes?: string | null;
  reflection?: string | null;
  leadershipSummary?: string;
  leadershipItems?: LeadershipItem[];
  status?: ReportStatus;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "无效日期" }, { status: 400 });
  }

  const report = await db.dailyReport.findUnique({
    where: {
      authorId_reportDate: {
        authorId: session.user.id,
        reportDate: parseDateKey(date),
      },
    },
  });

  if (!report) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }

  return NextResponse.json(serializeDailyReport(report));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "无效日期" }, { status: 400 });
  }

  const reportDate = parseDateKey(date);
  const body = (await request.json()) as UpdateDailyBody;
  const weekly = await ensureWeeklyReport(session.user.id, reportDate);

  const report = await db.dailyReport.upsert({
    where: {
      authorId_reportDate: {
        authorId: session.user.id,
        reportDate,
      },
    },
    create: {
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
    update: {
      ...(body.doneToday !== undefined ? { doneToday: body.doneToday } : {}),
      ...(body.processNotes !== undefined
        ? { processNotes: body.processNotes }
        : {}),
      ...(body.reflection !== undefined ? { reflection: body.reflection } : {}),
      ...(body.leadershipSummary !== undefined
        ? { leadershipSummary: body.leadershipSummary }
        : {}),
      ...(body.leadershipItems !== undefined
        ? { leadershipItems: body.leadershipItems }
        : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      weeklyReportId: weekly.id,
    },
  });

  return NextResponse.json(serializeDailyReport(report));
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { date } = await params;
  const reportDate = parseDateKey(date);

  const existing = await db.dailyReport.findUnique({
    where: {
      authorId_reportDate: {
        authorId: session.user.id,
        reportDate,
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }

  await db.dailyReport.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
