import {
  createLeadershipItem,
  leadershipItemsSchema,
  type LeadershipItem,
} from "@/lib/reports/types";

type AiResult = {
  leadershipSummary: string;
  leadershipItems: LeadershipItem[];
};

function getAiConfig() {
  const apiKey = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;
  const baseUrl =
    process.env.AI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.AI_MODEL ?? "gpt-4o-mini";

  if (!apiKey) {
    throw new Error("未配置 AI_API_KEY 或 OPENAI_API_KEY");
  }

  return { apiKey, baseUrl, model };
}

async function callAi(system: string, user: string): Promise<string> {
  const { apiKey, baseUrl, model } = getAiConfig();

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI 请求失败: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI 返回为空");
  }

  return content;
}

function parseAiResult(raw: string): AiResult {
  const parsed = JSON.parse(raw) as {
    leadershipSummary?: string;
    leadershipItems?: Array<{
      title?: string;
      result?: string;
      hasProcess?: boolean;
      process?: string;
      sourceDate?: string;
    }>;
  };

  const items = (parsed.leadershipItems ?? []).map((item) =>
    createLeadershipItem({
      title: item.title ?? "",
      result: item.result ?? "",
      hasProcess: Boolean(item.hasProcess),
      process: item.process,
      sourceDate: item.sourceDate,
    }),
  );

  const validated = leadershipItemsSchema.safeParse(items);
  return {
    leadershipSummary: parsed.leadershipSummary?.trim() ?? "",
    leadershipItems: validated.success ? validated.data : items,
  };
}

const DAILY_SYSTEM = `你是工作汇报助手。根据员工的日报个人记录，生成给领导看的精简版内容。
要求：
1. 结果导向，去情绪化，尽量量化
2. leadershipSummary 1-3 句话概括今日核心成果
3. leadershipItems 提炼 1-5 个事项，每项含 title、result
4. 仅当过程对理解结果有帮助时，设 hasProcess=true 并填写 process
5. 不要包含个人感悟、情绪、复盘类内容
6. 严格返回 JSON：{"leadershipSummary":"...","leadershipItems":[{"title":"...","result":"...","hasProcess":false,"process":"...","sourceDate":"YYYY-MM-DD"}]}`;

const WEEKLY_SYSTEM = `你是工作汇报助手。根据本周多份日报的领导版内容，合并生成周报领导版。
要求：
1. 合并同类事项，去重，保留最重要的结果
2. leadershipSummary 2-4 句话概括本周核心成果
3. leadershipItems 3-8 个事项，每项含 title、result
4. 仅重要事项设 hasProcess=true
5. 严格返回 JSON：{"leadershipSummary":"...","leadershipItems":[{"title":"...","result":"...","hasProcess":false,"process":"...","sourceDate":"YYYY-MM-DD"}]}`;

export async function summarizeDailyReport(input: {
  reportDate: string;
  doneToday: string;
  processNotes?: string | null;
  reflection?: string | null;
}): Promise<AiResult> {
  const user = JSON.stringify({
    reportDate: input.reportDate,
    doneToday: input.doneToday,
    processNotes: input.processNotes ?? "",
    reflection: input.reflection ?? "",
  });

  const raw = await callAi(DAILY_SYSTEM, user);
  return parseAiResult(raw);
}

export async function summarizeWeeklyReport(
  dailySummaries: Array<{
    reportDate: string;
    leadershipSummary: string;
    leadershipItems: LeadershipItem[];
  }>,
): Promise<AiResult> {
  const user = JSON.stringify({ dailyReports: dailySummaries });
  const raw = await callAi(WEEKLY_SYSTEM, user);
  return parseAiResult(raw);
}

/** Fallback when AI is not configured */
export function fallbackDailySummary(input: {
  reportDate: string;
  doneToday: string;
  processNotes?: string | null;
}): AiResult {
  const lines = input.doneToday
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const items = lines.slice(0, 5).map((line) =>
    createLeadershipItem({
      title: line.slice(0, 40),
      result: line,
      hasProcess: Boolean(input.processNotes?.trim()),
      process: input.processNotes?.trim() || undefined,
      sourceDate: input.reportDate,
    }),
  );

  return {
    leadershipSummary: lines.slice(0, 2).join("；") || "今日暂无记录",
    leadershipItems: items,
  };
}

export function fallbackWeeklySummary(
  dailySummaries: Array<{
    reportDate: string;
    leadershipSummary: string;
    leadershipItems: LeadershipItem[];
  }>,
): AiResult {
  const allItems = dailySummaries.flatMap((d) =>
    d.leadershipItems.map((item) => ({
      ...item,
      sourceDate: item.sourceDate ?? d.reportDate,
    })),
  );

  const summaries = dailySummaries
    .map((d) => d.leadershipSummary)
    .filter(Boolean);

  return {
    leadershipSummary: summaries.join(" ") || "本周暂无记录",
    leadershipItems: allItems.slice(0, 8),
  };
}
