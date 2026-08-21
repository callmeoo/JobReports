import Link from "next/link";

import {
  CONTENT_TYPE_LABELS,
  KNOWLEDGE_TYPES,
  MATERIAL_TYPES,
  PERSONAL_TYPES,
  SCRIPT_SCENARIO_LABELS,
} from "@/lib/content-types";
import type { ContentItem, ContentLocale, ContentType } from "@prisma/client";

type ItemWithLocales = ContentItem & { locales: ContentLocale[] };

function getBasePath(type: ContentType) {
  if (PERSONAL_TYPES.includes(type)) {
    return "/app/personal";
  }
  if (KNOWLEDGE_TYPES.includes(type)) {
    return "/app/knowledge";
  }
  if (MATERIAL_TYPES.includes(type)) {
    return "/app/materials";
  }
  return "/app/search";
}

export function ContentList({
  items,
  basePath,
}: {
  items: ItemWithLocales[];
  basePath?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
        还没有内容，点击右上角新建。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const zh = item.locales.find((locale) => locale.locale === "zh");
        const en = item.locales.find((locale) => locale.locale === "en");
        const missingEnglish = !en || en.status === "DRAFT";

        return (
          <Link
            key={item.id}
            href={`${basePath ?? getBasePath(item.type)}/${item.id}`}
            className="block rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-zinc-500">
                  {CONTENT_TYPE_LABELS[item.type]}
                  {item.scenario ? ` · ${SCRIPT_SCENARIO_LABELS[item.scenario]}` : ""}
                  {item.countryCode ? ` · ${item.countryCode}` : ""}
                </p>
                <h3 className="mt-1 text-base font-medium">{item.title}</h3>
                {item.summary ? (
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {item.summary}
                  </p>
                ) : zh?.body ? (
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {zh.body}
                  </p>
                ) : null}
              </div>
              <div className="shrink-0 text-right text-xs text-zinc-500">
                <p>{new Date(item.updatedAt).toLocaleDateString("zh-CN")}</p>
                {missingEnglish &&
                (KNOWLEDGE_TYPES.includes(item.type) ||
                  PERSONAL_TYPES.includes(item.type)) ? (
                  <p className="mt-1 text-amber-600">缺英文</p>
                ) : null}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
