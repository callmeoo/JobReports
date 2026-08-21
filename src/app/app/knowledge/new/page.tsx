import { ContentEditor } from "@/components/content-editor";
import { KNOWLEDGE_TYPES } from "@/lib/content-types";

export default function NewKnowledgePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">新建业务知识</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          建议填写国家代码，方便按目的地筛选。
        </p>
      </div>
      <ContentEditor allowedTypes={KNOWLEDGE_TYPES} showCountry />
    </div>
  );
}
