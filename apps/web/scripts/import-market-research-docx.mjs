import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const article = JSON.parse(
    readFileSync(
      new URL("./data/jiji-ng-market-analysis.json", import.meta.url),
      "utf8",
    ),
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

  const existing = await db.contentItem.findUnique({
    where: {
      type_slug: { type: "MARKET_RESEARCH", slug: article.slug },
    },
  });

  const data = {
    title: article.title,
    summary: article.summary,
    countryCode: article.countryCode,
    tags: article.tags,
    status: "PUBLISHED" as const,
    locales: {
      deleteMany: {},
      create: [
        {
          locale: "zh" as const,
          title: article.title,
          body: article.bodyFormat === "html"
            ? `<!-- format:html -->${article.body}`
            : article.body,
          status: "READY" as const,
        },
      ],
    },
  };

  if (existing) {
    await db.contentItem.update({
      where: { id: existing.id },
      data,
    });
    console.log("updated", article.slug);
  } else {
    await db.contentItem.create({
      data: {
        type: "MARKET_RESEARCH",
        slug: article.slug,
        authorId: user.id,
        ...data,
      },
    });
    console.log("created", article.slug);
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
