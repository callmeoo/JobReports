import { z } from "zod";

export const leadershipItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  result: z.string(),
  hasProcess: z.boolean(),
  process: z.string().optional(),
  sourceDate: z.string().optional(),
});

export type LeadershipItem = z.infer<typeof leadershipItemSchema>;

export const leadershipItemsSchema = z.array(leadershipItemSchema);

export function parseLeadershipItems(value: unknown): LeadershipItem[] {
  const parsed = leadershipItemsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function createLeadershipItem(
  partial?: Partial<LeadershipItem>,
): LeadershipItem {
  return {
    id: partial?.id ?? crypto.randomUUID(),
    title: partial?.title ?? "",
    result: partial?.result ?? "",
    hasProcess: partial?.hasProcess ?? false,
    process: partial?.process,
    sourceDate: partial?.sourceDate,
  };
}

export const REPORT_STATUS_LABELS = {
  DRAFT: "草稿",
  READY: "已完成",
  PUBLISHED: "已发布",
} as const;
