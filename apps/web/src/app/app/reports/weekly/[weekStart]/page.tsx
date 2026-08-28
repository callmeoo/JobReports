import Link from "next/link";

import {
  toWeeklyReportData,
  WeeklyReportEditor,
} from "@/components/weekly-report-editor";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  formatDateRange,
  getWeekEndKey,
  parseDateKey,
} from "@/lib/reports/dates";

export default async function WeeklyReportPage({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const { weekStart: weekStartKey } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartKey)) {
    return <p className="text-sm text-red-600">无效周起始日期</p>;
  }

  const weekStart = parseDateKey(weekStartKey);
  const weekEnd = parseDateKey(getWeekEndKey(weekStartKey));

  let report = await db.weeklyReport.findUnique({
    where: {
      authorId_weekStart: {
        authorId: session.user.id,
        weekStart,
      },
    },
    include: { dailyReports: { orderBy: { reportDate: "asc" } } },
  });

  if (!report) {
    report = await db.weeklyReport.create({
      data: {
        authorId: session.user.id,
        weekStart,
        weekEnd,
      },
      include: { dailyReports: { orderBy: { reportDate: "asc" } } },
    });
  }

  const initial = toWeeklyReportData({
    weekStart: weekStartKey,
    weekEnd: report.weekEnd.toISOString().slice(0, 10),
    personalReview: report.personalReview,
    experienceNotes: report.experienceNotes,
    leadershipSummary: report.leadershipSummary,
    leadershipItems: report.leadershipItems,
    status: report.status,
    shareToken: report.shareToken,
    shareEnabled: report.shareEnabled,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/app/reports/weekly"
          className="text-sm text-zinc-500 hover:underline"
        >
          ← 周报列表
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          {formatDateRange(weekStartKey, initial.weekEnd)} 周报
        </h1>
        {report.dailyReports.length > 0 ? (
          <p className="mt-1 text-sm text-zinc-500">
            已关联 {report.dailyReports.length} 份日报
          </p>
        ) : (
          <p className="mt-1 text-sm text-amber-600">
            本周尚无日报，建议先写日报再生成周报
          </p>
        )}
      </div>

      <WeeklyReportEditor weekStart={weekStartKey} initial={initial} />
    </div>
  );
}
