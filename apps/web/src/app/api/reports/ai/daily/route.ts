import { NextResponse } from "next/server";

import {
  fallbackDailySummary,
  summarizeDailyReport,
} from "@/lib/ai/report-summarizer";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeDailyReport } from "@/lib/reports/helpers";
import { parseDateKey } from "@/lib/reports/dates";

type AiDailyBody = {
  reportDate: string;
  doneToday: string;
  processNotes?: string | null;
  reflection?: string | null;
  save?: boolean;
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as AiDailyBody;
  if (!body.reportDate || !body.doneToday?.trim()) {
    return NextResponse.json(
      { error: "需要 reportDate 和 doneToday" },
      { status: 400 },
    );
  }

  let result;
  try {
    result = await summarizeDailyReport(body);
  } catch {
    result = fallbackDailySummary(body);
  }

  if (body.save) {
    const reportDate = parseDateKey(body.reportDate);
    const updated = await db.dailyReport.updateMany({
      where: {
        authorId: session.user.id,
        reportDate,
      },
      data: {
        leadershipSummary: result.leadershipSummary,
        leadershipItems: result.leadershipItems,
        aiGeneratedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({
        ...result,
        saved: false,
        message: "日报尚未创建，请先生成后保存",
      });
    }

    const report = await db.dailyReport.findUnique({
      where: {
        authorId_reportDate: {
          authorId: session.user.id,
          reportDate,
        },
      },
    });

    return NextResponse.json({
      ...result,
      saved: true,
      report: report ? serializeDailyReport(report) : null,
    });
  }

  return NextResponse.json(result);
}
