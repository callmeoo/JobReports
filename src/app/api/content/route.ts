import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { slugify } from "@/lib/content-types";
import { workspaceAuthorFilter } from "@/lib/workspace";
import type { ContentType, ScriptScenario } from "@prisma/client";

type CreateBody = {
  type: ContentType;
  title: string;
  summary?: string;
  countryCode?: string;
  scenario?: ScriptScenario | null;
  tags?: string[];
  body?: string;
  primaryLocale?: "zh" | "en" | "local";
};

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as ContentType | null;
  const countryCode = searchParams.get("country");
  const scenario = searchParams.get("scenario") as ScriptScenario | null;
  const q = searchParams.get("q")?.trim();
  const authorFilter = await workspaceAuthorFilter();

  const items = await db.contentItem.findMany({
    where: {
      ...authorFilter,
      ...(type ? { type } : {}),
      ...(countryCode ? { countryCode } : {}),
      ...(scenario ? { scenario } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { summary: { contains: q, mode: "insensitive" } },
              { tags: { has: q } },
              {
                locales: {
                  some: {
                    OR: [
                      { title: { contains: q, mode: "insensitive" } },
                      { body: { contains: q, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      locales: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as CreateBody;
  if (!body.type || !body.title?.trim()) {
    return NextResponse.json({ error: "缺少 type 或 title" }, { status: 400 });
  }

  const baseSlug = slugify(body.title) || "untitled";
  let slug = baseSlug;
  let suffix = 1;

  while (
    await db.contentItem.findUnique({
      where: { type_slug: { type: body.type, slug } },
    })
  ) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const primaryLocale = body.primaryLocale ?? "zh";

  const item = await db.contentItem.create({
    data: {
      type: body.type,
      slug,
      title: body.title.trim(),
      summary: body.summary?.trim() || null,
      countryCode: body.countryCode?.trim().toUpperCase() || null,
      scenario: body.scenario ?? null,
      tags: body.tags ?? [],
      authorId: session.user.id,
      locales: {
        create: [
          {
            locale: primaryLocale,
            title: body.title.trim(),
            body: body.body ?? "",
            status: "DRAFT",
          },
        ],
      },
    },
    include: { locales: true },
  });

  return NextResponse.json(item, { status: 201 });
}
