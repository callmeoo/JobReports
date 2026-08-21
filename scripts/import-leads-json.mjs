import { readFileSync, unlinkSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const PATH = new URL("../tmp-leads-import.json", import.meta.url);

function endOfToday() {
  const d = new Date();
  d.setHours(18, 0, 0, 0);
  return d;
}

async function main() {
  const leads = JSON.parse(readFileSync(PATH, "utf8"));
  const user =
    (await db.user.findFirst({ orderBy: { createdAt: "asc" } })) ??
    (await db.user.create({
      data: {
        email: "yuanlj0119@gmail.com",
        passwordHash: "placeholder",
        name: "yuanlj0119",
      },
    }));

  const due = endOfToday();
  let created = 0;
  let updated = 0;

  for (const lead of leads) {
    const existing = await db.buyer.findFirst({
      where: { authorId: user.id, sourceRef: lead.sourceRef },
    });

    const data = {
      companyName: lead.companyName,
      whatsapp: lead.whatsapp,
      phone: lead.phone,
      countryCode: lead.countryCode,
      city: lead.city,
      source: lead.source,
      sourceRef: lead.sourceRef,
      stage: lead.stage,
      tier: lead.tier,
      notes: lead.notes,
      tags: lead.tags,
      nextFollowUpAt: due,
      authorId: user.id,
    };

    if (existing) {
      await db.buyer.update({
        where: { id: existing.id },
        data: {
          ...data,
          // keep stage if already progressed
          stage: existing.stage === "NEW" ? data.stage : existing.stage,
          nextFollowUpAt:
            existing.stage === "NEW" || !existing.nextFollowUpAt
              ? due
              : existing.nextFollowUpAt,
        },
      });
      updated += 1;
    } else {
      await db.buyer.create({ data });
      created += 1;
    }
  }

  const total = await db.buyer.count({ where: { authorId: user.id } });
  const todo = await db.buyer.count({
    where: {
      authorId: user.id,
      stage: { notIn: ["WON", "PAUSED"] },
      OR: [{ nextFollowUpAt: { lte: due } }, { nextFollowUpAt: null, stage: "NEW" }],
    },
  });

  console.log(JSON.stringify({ created, updated, total, todo }, null, 2));

  try {
    unlinkSync(PATH);
  } catch {
    // ignore
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
