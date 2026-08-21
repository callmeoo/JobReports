import { ContentEditor } from "@/components/content-editor";
import { PERSONAL_TYPES } from "@/lib/content-types";

export default function NewPersonalPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">新建个人内容</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          默认创建中文版本，可在下方切换到英文或当地语。
        </p>
      </div>
      <ContentEditor allowedTypes={PERSONAL_TYPES} />
    </div>
  );
}
