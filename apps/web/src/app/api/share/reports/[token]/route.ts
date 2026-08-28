import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { toPublicWeeklyReport } from "@/lib/reports/helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const report = await db.weeklyReport.findUnique({
    where: { shareToken: token },
    select: {
      weekStart: true,
      weekEnd: true,
      leadershipSummary: true,
      leadershipItems: true,
      publishedAt: true,
      updatedAt: true,
      shareEnabled: true,
    },
  });

  if (!report || !report.shareEnabled) {
    return NextResponse.json({ error: "未找到或链接已失效" }, { status: 404 });
  }

  return NextResponse.json(
    toPublicWeeklyReport({
      ...report,
      publishedAt: report.publishedAt,
    }),
  );
}
