import Link from "next/link";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  countWeekdaysUpToToday,
  formatDateLabel,
  getWeekEndKey,
  getWeekStartKey,
  toDateKey,
} from "@/lib/reports/dates";
import { REPORT_STATUS_LABELS } from "@/lib/reports/types";

export default async function ReportsHubPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const today = toDateKey();
  const weekStart = getWeekStartKey();
  const weekEnd = getWeekEndKey(weekStart);

  const [todayReport, weekReports, weeklyReport, recentDaily] =
    await Promise.all([
      db.dailyReport.findUnique({
        where: {
          authorId_reportDate: {
            authorId: session.user.id,
            reportDate: new Date(`${today}T00:00:00.000Z`),
          },
        },
      }),
      db.dailyReport.findMany({
        where: {
          authorId: session.user.id,
          reportDate: {
            gte: new Date(`${weekStart}T00:00:00.000Z`),
            lte: new Date(`${weekEnd}T00:00:00.000Z`),
          },
        },
      }),
      db.weeklyReport.findUnique({
        where: {
          authorId_weekStart: {
            authorId: session.user.id,
            weekStart: new Date(`${weekStart}T00:00:00.000Z`),
          },
        },
      }),
      db.dailyReport.findMany({
        where: { authorId: session.user.id },
        orderBy: { reportDate: "desc" },
        take: 7,
      }),
    ]);

  const weekdaysTotal = countWeekdaysUpToToday(weekStart);
  const weekdaysDone = weekReports.filter(
    (r) => r.doneToday.trim().length > 0,
  ).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">工作汇报</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            记录每日、汇总每周、一键提交领导
          </p>
        </div>
        <Link
          href={`/app/reports/daily/${today}`}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {todayReport?.doneToday?.trim() ? "编辑今日日报" : "写今日日报"}
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <p className="text-sm text-zinc-500">本周进度</p>
          <p className="mt-2 text-2xl font-semibold">
            {weekdaysDone}/{weekdaysTotal} 天
          </p>
          <p className="mt-1 text-sm text-zinc-500">工作日已记录</p>
          <Link
            href="/app/reports/daily"
            className="mt-4 inline-block text-sm text-zinc-700 underline dark:text-zinc-300"
          >
            查看全部日报 →
          </Link>
        </div>

        <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <p className="text-sm text-zinc-500">本周周报</p>
          <p className="mt-2 font-medium">
            {weekStart.slice(5).replace("-", "/")} –{" "}
            {weekEnd.slice(5).replace("-", "/")}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {weeklyReport
              ? REPORT_STATUS_LABELS[weeklyReport.status]
              : "尚未创建"}
            {weeklyReport?.shareEnabled ? " · 已发布" : " · 未发布"}
          </p>
          <Link
            href={`/app/reports/weekly/${weekStart}`}
            className="mt-4 inline-block rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            {weeklyReport ? "继续编辑" : "创建周报"}
          </Link>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">最近日报</h2>
          <Link
            href="/app/reports/weekly"
            className="text-sm text-zinc-600 underline dark:text-zinc-400"
          >
            周报列表
          </Link>
        </div>

        {recentDaily.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 px-6 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
            还没有日报，点击上方按钮开始记录
          </p>
        ) : (
          <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {recentDaily.map((report) => {
              const dateKey = report.reportDate.toISOString().slice(0, 10);
              return (
                <Link
                  key={report.id}
                  href={`/app/reports/daily/${dateKey}`}
                  className="flex items-center justify-between px-4 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <div>
                    <p className="font-medium">{formatDateLabel(dateKey)}</p>
                    <p className="mt-0.5 line-clamp-1 text-sm text-zinc-500">
                      {report.doneToday.trim() || "（空）"}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-400">
                    {REPORT_STATUS_LABELS[report.status]}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
