import type { DailyReport, WeeklyReport } from "@prisma/client";

import { db } from "@/lib/db";
import {
  getWeekEndKey,
  getWeekStartKey,
  parseDateKey,
} from "@/lib/reports/dates";
import { parseLeadershipItems } from "@/lib/reports/types";

export async function ensureWeeklyReport(
  authorId: string,
  reportDate: Date,
): Promise<WeeklyReport> {
  const weekStartKey = getWeekStartKey(reportDate);
  const weekEndKey = getWeekEndKey(weekStartKey);

  const existing = await db.weeklyReport.findUnique({
    where: {
      authorId_weekStart: {
        authorId,
        weekStart: parseDateKey(weekStartKey),
      },
    },
  });

  if (existing) return existing;

  return db.weeklyReport.create({
    data: {
      authorId,
      weekStart: parseDateKey(weekStartKey),
      weekEnd: parseDateKey(weekEndKey),
    },
  });
}

export function serializeDailyReport(report: DailyReport) {
  return {
    ...report,
    reportDate: report.reportDate.toISOString().slice(0, 10),
    leadershipItems: parseLeadershipItems(report.leadershipItems),
  };
}

export function serializeWeeklyReport(
  report: WeeklyReport & { dailyReports?: DailyReport[] },
) {
  return {
    ...report,
    weekStart: report.weekStart.toISOString().slice(0, 10),
    weekEnd: report.weekEnd.toISOString().slice(0, 10),
    leadershipItems: parseLeadershipItems(report.leadershipItems),
    dailyReports: report.dailyReports?.map(serializeDailyReport),
  };
}

export function toPublicWeeklyReport(report: {
  weekStart: Date;
  weekEnd: Date;
  leadershipSummary: string;
  leadershipItems: unknown;
  publishedAt: Date | null;
  updatedAt: Date;
}) {
  return {
    weekStart: report.weekStart.toISOString().slice(0, 10),
    weekEnd: report.weekEnd.toISOString().slice(0, 10),
    leadershipSummary: report.leadershipSummary,
    leadershipItems: parseLeadershipItems(report.leadershipItems),
    publishedAt: report.publishedAt?.toISOString() ?? null,
    updatedAt: report.updatedAt.toISOString(),
  };
}
