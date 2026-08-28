import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeWeeklyReport } from "@/lib/reports/helpers";
import { parseDateKey } from "@/lib/reports/dates";

export async function POST(
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

  const existing = await db.weeklyReport.findUnique({
    where: {
      authorId_weekStart: {
        authorId: session.user.id,
        weekStart: parseDateKey(weekStartKey),
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "未找到周报" }, { status: 404 });
  }

  const report = await db.weeklyReport.update({
    where: { id: existing.id },
    data: {
      shareEnabled: true,
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
    include: { dailyReports: { orderBy: { reportDate: "asc" } } },
  });

  const serialized = serializeWeeklyReport(report);
  return NextResponse.json({
    ...serialized,
    shareUrl: `/share/reports/${report.shareToken}`,
  });
}
