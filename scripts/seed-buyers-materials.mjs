import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const user =
    (await db.user.findFirst({ orderBy: { createdAt: "asc" } })) ??
    (await db.user.create({
      data: {
        email: "yuanlj0119@gmail.com",
        passwordHash: "placeholder",
        name: "yuanlj0119",
      },
    }));

  const scripts = [
    {
      slug: "ng-icebreaker-short",
      title: "尼日利亚破冰 · 短版",
      scenario: "ICEBREAKER",
      countryCode: "NG",
      tags: ["WhatsApp", "KEY"],
      enTitle: "Nigeria icebreaker (short)",
      enBody:
        "Hi, this is [Name] from [Company] in China.\nWe export used cars / NEV to Lagos (CIF).\nSaw your shop on Jiji — do you buy Tokunbo for wholesale?\nI can share a short unit list if useful.",
      zhTitle: "尼日利亚破冰 · 短版",
      zhBody:
        "你好，我是中国 [Company] 的 [Name]。\n我们做二手车/新能源出口到拉各斯（CIF）。\n在 Jiji 看到你们店铺，请问是否批发采购 Tokunbo？\n如方便我可以发一份简短车单。",
    },
    {
      slug: "ng-followup-read-no-reply",
      title: "跟进 · 已读未回",
      scenario: "FOLLOW_UP",
      countryCode: "NG",
      tags: ["WhatsApp", "跟进"],
      enTitle: "Follow-up · read no reply",
      enBody:
        "Hi again — just checking if you received my note about CIF Lagos stock.\nIf timing is bad, tell me a better window. Happy to send 2–3 units that match your brand mix.",
      zhTitle: "跟进 · 已读未回",
      zhBody:
        "再次打扰——想确认你是否看到我发的 CIF 拉各斯车源信息。\n如果现在不方便，告诉我更合适的时间。我也可以按你们主营品牌发 2–3 台样例。",
    },
  ];

  for (const script of scripts) {
    const existing = await db.contentItem.findUnique({
      where: { type_slug: { type: "SCRIPT", slug: script.slug } },
    });
    if (existing) {
      console.log("skip script", script.slug);
      continue;
    }
    await db.contentItem.create({
      data: {
        type: "SCRIPT",
        slug: script.slug,
        title: script.title,
        summary: script.enTitle,
        countryCode: script.countryCode,
        scenario: script.scenario,
        tags: [...script.tags],
        status: "PUBLISHED",
        authorId: user.id,
        locales: {
          create: [
            {
              locale: "en",
              title: script.enTitle,
              body: script.enBody,
              status: "READY",
            },
            {
              locale: "zh",
              title: script.zhTitle,
              body: script.zhBody,
              status: "READY",
            },
          ],
        },
      },
    });
    console.log("created script", script.slug);
  }

  const buyerCount = await db.buyer.count({ where: { authorId: user.id } });
  if (buyerCount === 0) {
    const next = new Date();
    next.setHours(10, 0, 0, 0);
    await db.buyer.create({
      data: {
        companyName: "Demo Autos Lagos",
        contactName: "Chinedu",
        whatsapp: "2348012345678",
        countryCode: "NG",
        city: "Lagos",
        source: "JIJI",
        stage: "NEW",
        tier: "KEY",
        nextFollowUpAt: next,
        notes: "示例买家：可删。先点「用话术」复制英文，再开 WhatsApp。",
        authorId: user.id,
      },
    });
    console.log("created demo buyer");
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
