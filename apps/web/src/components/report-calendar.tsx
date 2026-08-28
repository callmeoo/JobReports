"use client";

import Link from "next/link";

import { formatDateLabel } from "@/lib/reports/dates";
import { REPORT_STATUS_LABELS } from "@/lib/reports/types";

type DailyRow = {
  reportDate: string;
  status: keyof typeof REPORT_STATUS_LABELS;
  doneToday: string;
};

export function ReportCalendar({
  month,
  reports,
  basePath,
}: {
  month: string;
  reports: DailyRow[];
  basePath: string;
}) {
  const [year, mon] = month.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, mon - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const startWeekday = firstDay.getUTCDay();
  const offset = startWeekday === 0 ? 6 : startWeekday - 1;

  const reportMap = new Map(reports.map((r) => [r.reportDate, r]));

  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weekdays = ["一", "二", "三", "四", "五", "六", "日"];

  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-3 grid grid-cols-7 gap-1 text-center text-xs font-medium text-zinc-500">
        {weekdays.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) {
            return <div key={`empty-${i}`} className="aspect-square" />;
          }

          const dateKey = `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const report = reportMap.get(dateKey);
          const hasContent = Boolean(report?.doneToday?.trim());

          return (
            <Link
              key={dateKey}
              href={`${basePath}/${dateKey}`}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition hover:bg-zinc-100 dark:hover:bg-zinc-900 ${
                hasContent
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-700 dark:text-zinc-300"
              }`}
            >
              <span>{day}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function DailyReportList({
  reports,
  basePath,
}: {
  reports: DailyRow[];
  basePath: string;
}) {
  if (reports.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 px-6 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
        本月暂无日报
      </p>
    );
  }

  return (
    <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {reports.map((report) => (
        <Link
          key={report.reportDate}
          href={`${basePath}/${report.reportDate}`}
          className="flex items-center justify-between px-4 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          <div>
            <p className="font-medium">{formatDateLabel(report.reportDate)}</p>
            <p className="mt-0.5 line-clamp-1 text-sm text-zinc-500">
              {report.doneToday?.trim() || "（空）"}
            </p>
          </div>
          <span className="text-xs text-zinc-400">
            {REPORT_STATUS_LABELS[report.status]}
          </span>
        </Link>
      ))}
    </div>
  );
}
