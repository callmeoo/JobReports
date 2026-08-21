import { ContentEditor } from "@/components/content-editor";
import { MATERIAL_TYPES } from "@/lib/content-types";

export default function NewMaterialPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">新建话术</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          建议先写英文版（WhatsApp 常用），中文作对照。场景选破冰/跟进更易筛选。
        </p>
      </div>
      <ContentEditor
        allowedTypes={MATERIAL_TYPES}
        showCountry
        showScenario
        defaultLocale="en"
      />
    </div>
  );
}
