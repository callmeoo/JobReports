import { notFound } from "next/navigation";

import { ShareReportPage } from "@/components/share-report-page";
import { db } from "@/lib/db";
import { parseLeadershipItems } from "@/lib/reports/types";

export default async function PublicShareReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
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
    notFound();
  }

  return (
    <ShareReportPage
      weekStart={report.weekStart.toISOString().slice(0, 10)}
      weekEnd={report.weekEnd.toISOString().slice(0, 10)}
      leadershipSummary={report.leadershipSummary}
      leadershipItems={parseLeadershipItems(report.leadershipItems)}
      publishedAt={report.publishedAt?.toISOString() ?? null}
      updatedAt={report.updatedAt.toISOString()}
    />
  );
}
