import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const META = {
  "complete-analysis-of-import-taxes-and-fees-for-used-cars-in-cote-d-ivoire-2026-edition": {
    type: "REGULATION",
    countryCode: "CI",
    tags: ["科特迪瓦", "税费", "HS8703", "UCCVIP"],
  },
  "cote-d-ivoire-s-used-car-import-restrictions-and-procedures-2026-edition": {
    type: "PROCESS",
    countryCode: "CI",
    tags: ["科特迪瓦", "准入", "清关", "UCCVIP"],
  },
  "guide-to-importing-used-cars-from-china": {
    type: "PROCESS",
    countryCode: null,
    tags: ["中国出口", "西非", "采购", "UCCVIP"],
  },
  "ghana-used-car-import-taxes": {
    type: "REGULATION",
    countryCode: "GH",
    tags: ["加纳", "税费", "ICUMS", "UCCVIP"],
  },
  "ghana-used-car-import-access-and-customs-clearance-complete-guides": {
    type: "PROCESS",
    countryCode: "GH",
    tags: ["加纳", "准入", "清关", "UCCVIP"],
  },
  "exporting-used-cars-to-nigeria-a-complete-guide-to-documentation-for-domestic-customs-declaration-and-buyer-s-clearance": {
    type: "PROCESS",
    countryCode: "NG",
    tags: ["尼日利亚", "单证", "Form M", "CoC", "UCCVIP"],
  },
  "nigeria-tokunbo-import-documentation-requirements-customs-clearance-compliance-process-and-pitfall-avoidance-guide": {
    type: "PROCESS",
    countryCode: "NG",
    tags: ["尼日利亚", "Tokunbo", "文件", "UCCVIP"],
  },
  "nigeria-imported-used-cars-admission-requirements-and-import-duties-taxes-2026": {
    type: "REGULATION",
    countryCode: "NG",
    tags: ["尼日利亚", "准入", "税费", "2026", "UCCVIP"],
  },
};

function clean(text) {
  return text
    .replace(/^Summary\s+/i, "")
    .replace(/\n?分享\s*\n[\s\S]*$/u, "")
    .replace(/\n?Share\s*\n[\s\S]*$/i, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function main() {
  const articles = JSON.parse(
    readFileSync(new URL("../tmp-uccvip-blog.json", import.meta.url), "utf8"),
  );

  let user = await db.user.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!user) {
    user = await db.user.create({
      data: {
        email: "yuanlj0119@gmail.com",
        passwordHash: "placeholder-will-be-set-on-first-login",
        name: "yuanlj0119",
      },
    });
  }

  for (const article of articles) {
    const meta = META[article.slug];
    const zh = article.locales.zh;
    const en = article.locales.en;
    const zhBody = clean(zh.body);
    const enBody = clean(en.body);

    const existing = await db.contentItem.findUnique({
      where: { type_slug: { type: meta.type, slug: article.slug } },
    });

    if (existing) {
      await db.contentItem.update({
        where: { id: existing.id },
        data: {
          title: zh.title,
          summary: zh.summary,
          countryCode: meta.countryCode,
          tags: meta.tags,
          status: "PUBLISHED",
          locales: {
            deleteMany: {},
            create: [
              { locale: "zh", title: zh.title, body: zhBody, status: "READY" },
              { locale: "en", title: en.title, body: enBody, status: "READY" },
            ],
          },
        },
      });
      console.log("updated", article.slug);
    } else {
      await db.contentItem.create({
        data: {
          type: meta.type,
          slug: article.slug,
          title: zh.title,
          summary: zh.summary,
          countryCode: meta.countryCode,
          tags: meta.tags,
          status: "PUBLISHED",
          authorId: user.id,
          locales: {
            create: [
              { locale: "zh", title: zh.title, body: zhBody, status: "READY" },
              { locale: "en", title: en.title, body: enBody, status: "READY" },
            ],
          },
        },
      });
      console.log("created", article.slug);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
