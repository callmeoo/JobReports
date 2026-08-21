import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { LocaleCode, LocaleStatus, ScriptScenario } from "@prisma/client";

type LocalePatch = {
  locale: LocaleCode;
  title?: string;
  body?: string;
  status?: LocaleStatus;
};

type UpdateBody = {
  title?: string;
  summary?: string;
  countryCode?: string | null;
  scenario?: ScriptScenario | null;
  tags?: string[];
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  locales?: LocalePatch[];
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const item = await db.contentItem.findFirst({
    where: { id, authorId: session.user.id },
    include: { locales: { orderBy: { locale: "asc" } } },
  });

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await db.contentItem.findFirst({
    where: { id, authorId: session.user.id },
    include: { locales: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as UpdateBody;

  if (body.locales?.length) {
    for (const locale of body.locales) {
      const current = existing.locales.find((item) => item.locale === locale.locale);
      if (current) {
        await db.contentLocale.update({
          where: { id: current.id },
          data: {
            title: locale.title ?? current.title,
            body: locale.body ?? current.body,
            status: locale.status ?? current.status,
          },
        });
      } else if (locale.title) {
        await db.contentLocale.create({
          data: {
            contentItemId: existing.id,
            locale: locale.locale,
            title: locale.title,
            body: locale.body ?? "",
            status: locale.status ?? "DRAFT",
          },
        });
      }
    }
  }

  const item = await db.contentItem.update({
    where: { id: existing.id },
    data: {
      title: body.title?.trim() ?? undefined,
      summary: body.summary === undefined ? undefined : body.summary?.trim() || null,
      countryCode:
        body.countryCode === undefined
          ? undefined
          : body.countryCode?.trim().toUpperCase() || null,
      scenario: body.scenario === undefined ? undefined : body.scenario,
      tags: body.tags ?? undefined,
      status: body.status ?? undefined,
    },
    include: { locales: { orderBy: { locale: "asc" } } },
  });

  return NextResponse.json(item);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await db.contentItem.findFirst({
    where: { id, authorId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.contentItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
