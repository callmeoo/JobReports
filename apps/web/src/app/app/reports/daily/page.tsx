import Link from "next/link";

import {
  DailyReportList,
  ReportCalendar,
} from "@/components/report-calendar";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { toDateKey } from "@/lib/reports/dates";

export default async function DailyReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const params = await searchParams;
  const today = toDateKey();
  const month = params.month ?? today.slice(0, 7);

  const [year, mon] = month.split("-").map(Number);
  const reports = await db.dailyReport.findMany({
    where: {
      authorId: session.user.id,
      reportDate: {
        gte: new Date(Date.UTC(year, mon - 1, 1)),
        lte: new Date(Date.UTC(year, mon, 0)),
      },
    },
    orderBy: { reportDate: "desc" },
  });

  const serialized = reports.map((r) => ({
    reportDate: r.reportDate.toISOString().slice(0, 10),
    status: r.status,
    doneToday: r.doneToday,
  }));

  const prevMonth =
    mon === 1
      ? `${year - 1}-12`
      : `${year}-${String(mon - 1).padStart(2, "0")}`;
  const nextMonth =
    mon === 12
      ? `${year + 1}-01`
      : `${year}-${String(mon + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/app/reports"
            className="text-sm text-zinc-500 hover:underline"
          >
            ← 工作汇报
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">日报</h1>
        </div>
        <Link
          href={`/app/reports/daily/${today}`}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          写今日日报
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <Link
          href={`/app/reports/daily?month=${prevMonth}`}
          className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          ← 上月
        </Link>
        <span className="font-medium">{month}</span>
        <Link
          href={`/app/reports/daily?month=${nextMonth}`}
          className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          下月 →
        </Link>
      </div>

      <ReportCalendar
        month={month}
        reports={serialized}
        basePath="/app/reports/daily"
      />

      <DailyReportList
        reports={serialized}
        basePath="/app/reports/daily"
      />
    </div>
  );
}
