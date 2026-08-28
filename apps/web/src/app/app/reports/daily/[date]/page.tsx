import Link from "next/link";

import {
  DailyReportEditor,
  toDailyReportData,
} from "@/components/daily-report-editor";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureWeeklyReport } from "@/lib/reports/helpers";
import { formatDateLabel, parseDateKey } from "@/lib/reports/dates";
import { parseLeadershipItems } from "@/lib/reports/types";

export default async function DailyReportPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const { date } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return <p className="text-sm text-red-600">无效日期</p>;
  }

  const reportDate = parseDateKey(date);
  await ensureWeeklyReport(session.user.id, reportDate);

  const report = await db.dailyReport.findUnique({
    where: {
      authorId_reportDate: {
        authorId: session.user.id,
        reportDate,
      },
    },
  });

  const initial = report
    ? toDailyReportData({
        reportDate: date,
        doneToday: report.doneToday,
        processNotes: report.processNotes,
        reflection: report.reflection,
        leadershipSummary: report.leadershipSummary,
        leadershipItems: parseLeadershipItems(report.leadershipItems),
        status: report.status,
      })
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/app/reports/daily"
          className="text-sm text-zinc-500 hover:underline"
        >
          ← 日报列表
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          {formatDateLabel(date)} 日报
        </h1>
      </div>

      <DailyReportEditor reportDate={date} initial={initial} />
    </div>
  );
}
