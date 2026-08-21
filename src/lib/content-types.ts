import type {
  ActivityChannel,
  BuyerSource,
  BuyerStage,
  ContentType,
  ScriptScenario,
} from "@prisma/client";

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  JOURNAL: "日记",
  WEEKLY_REPORT: "周报",
  MONTHLY_REPORT: "月报",
  REGULATION: "法规",
  PROCESS: "进口流程",
  SCRIPT: "运营话术",
  SEO_DRAFT: "SEO/GEO 草稿",
  PRODUCT_PLAN: "产品规划",
  CONTRACT_TEMPLATE: "合同模板",
};

export const PERSONAL_TYPES: ContentType[] = [
  "JOURNAL",
  "WEEKLY_REPORT",
  "MONTHLY_REPORT",
];

export const KNOWLEDGE_TYPES: ContentType[] = ["REGULATION", "PROCESS"];

export const MATERIAL_TYPES: ContentType[] = ["SCRIPT"];

export const LOCALE_LABELS = {
  zh: "中文",
  en: "English",
  local: "当地语",
} as const;

export const SCRIPT_SCENARIO_LABELS: Record<ScriptScenario, string> = {
  ICEBREAKER: "破冰",
  FOLLOW_UP: "跟进",
  QUOTE: "报价",
  OBJECTION: "异议处理",
  OTHER: "其他",
};

export const BUYER_STAGE_LABELS: Record<BuyerStage, string> = {
  NEW: "新线索",
  CONTACTED: "已联系",
  INTERESTED: "有意向",
  QUOTED: "已报价",
  WON: "成交",
  PAUSED: "搁置",
};

export const BUYER_STAGE_ORDER: BuyerStage[] = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "QUOTED",
  "WON",
  "PAUSED",
];

export const BUYER_SOURCE_LABELS: Record<BuyerSource, string> = {
  JIJI: "Jiji",
  WEBSITE: "官网",
  EXHIBITION: "展会",
  REFERRAL: "转介绍",
  OTHER: "其他",
};

export const ACTIVITY_CHANNEL_LABELS: Record<ActivityChannel, string> = {
  WHATSAPP: "WhatsApp",
  EMAIL: "邮件",
  PHONE: "电话",
  MEETING: "会面",
  NOTE: "备注",
  OTHER: "其他",
};

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** 生成 wa.me 链接；号码可含空格、+、横线 */
export function whatsappLink(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}`;
}
