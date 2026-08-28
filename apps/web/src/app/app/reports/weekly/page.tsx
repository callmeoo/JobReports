import Link from "next/link";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateRange } from "@/lib/reports/dates";
import { REPORT_STATUS_LABELS } from "@/lib/reports/types";

export default async function WeeklyReportsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const reports = await db.weeklyReport.findMany({
    where: { authorId: session.user.id },
    orderBy: { weekStart: "desc" },
    take: 52,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/app/reports"
          className="text-sm text-zinc-500 hover:underline"
        >
          ← 工作汇报
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">周报</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          汇总本周日报，生成领导版并分享
        </p>
      </div>

      {reports.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 px-6 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          还没有周报。先写几天日报，系统会自动关联到对应周。
        </p>
      ) : (
        <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {reports.map((report) => {
            const weekStart = report.weekStart.toISOString().slice(0, 10);
            const weekEnd = report.weekEnd.toISOString().slice(0, 10);
            return (
              <Link
                key={report.id}
                href={`/app/reports/weekly/${weekStart}`}
                className="flex items-center justify-between px-4 py-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <div>
                  <p className="font-medium">
                    {formatDateRange(weekStart, weekEnd)}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-sm text-zinc-500">
                    {report.leadershipSummary.trim() ||
                      report.personalReview.trim() ||
                      "（空）"}
                  </p>
                </div>
                <div className="text-right text-xs text-zinc-400">
                  <p>{REPORT_STATUS_LABELS[report.status]}</p>
                  {report.shareEnabled ? <p>已发布</p> : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
