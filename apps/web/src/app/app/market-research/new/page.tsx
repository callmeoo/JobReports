import { ContentEditor } from "@/components/content-editor";
import { MARKET_RESEARCH_TYPES } from "@/lib/content-types";

export default function NewMarketResearchPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">新建市场调研</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          记录平台挂牌、价格带、品牌车型等结构化观察；建议填写国家代码。
        </p>
      </div>
      <ContentEditor allowedTypes={MARKET_RESEARCH_TYPES} showCountry />
    </div>
  );
}
