import { NextResponse } from "next/server";

import {
  fallbackWeeklySummary,
  summarizeWeeklyReport,
} from "@/lib/ai/report-summarizer";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeWeeklyReport } from "@/lib/reports/helpers";
import { parseDateKey } from "@/lib/reports/dates";
import { parseLeadershipItems } from "@/lib/reports/types";

type AiWeeklyBody = {
  weekStart: string;
  save?: boolean;
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as AiWeeklyBody;
  if (!body.weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(body.weekStart)) {
    return NextResponse.json({ error: "需要有效 weekStart" }, { status: 400 });
  }

  const weekly = await db.weeklyReport.findUnique({
    where: {
      authorId_weekStart: {
        authorId: session.user.id,
        weekStart: parseDateKey(body.weekStart),
      },
    },
    include: { dailyReports: { orderBy: { reportDate: "asc" } } },
  });

  if (!weekly) {
    return NextResponse.json({ error: "未找到周报" }, { status: 404 });
  }

  const dailySummaries = weekly.dailyReports.map((d) => ({
    reportDate: d.reportDate.toISOString().slice(0, 10),
    leadershipSummary: d.leadershipSummary,
    leadershipItems: parseLeadershipItems(d.leadershipItems),
  }));

  let result;
  try {
    result = await summarizeWeeklyReport(dailySummaries);
  } catch {
    result = fallbackWeeklySummary(dailySummaries);
  }

  if (body.save) {
    const updated = await db.weeklyReport.update({
      where: { id: weekly.id },
      data: {
        leadershipSummary: result.leadershipSummary,
        leadershipItems: result.leadershipItems,
        aiGeneratedAt: new Date(),
      },
      include: { dailyReports: { orderBy: { reportDate: "asc" } } },
    });

    return NextResponse.json({
      ...result,
      saved: true,
      report: serializeWeeklyReport(updated),
    });
  }

  return NextResponse.json(result);
}
