import { NextResponse } from "next/server";
import type { ActivityChannel, BuyerStage } from "@prisma/client";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workspaceAuthorFilter } from "@/lib/workspace";

type CreateBody = {
  channel?: ActivityChannel;
  content: string;
  scriptId?: string;
  scriptTitle?: string;
  stageAfter?: BuyerStage;
  nextFollowUpAt?: string | null;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const authorFilter = await workspaceAuthorFilter();
  const buyer = await db.buyer.findFirst({
    where: { id, ...authorFilter },
  });
  if (!buyer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as CreateBody;
  if (!body.content?.trim()) {
    return NextResponse.json({ error: "跟进内容必填" }, { status: 400 });
  }

  const stageAfter = body.stageAfter ?? undefined;

  const [activity] = await db.$transaction([
    db.activity.create({
      data: {
        buyerId: buyer.id,
        authorId: session.user.id,
        channel: body.channel ?? "WHATSAPP",
        content: body.content.trim(),
        scriptId: body.scriptId || null,
        scriptTitle: body.scriptTitle?.trim() || null,
        stageAfter: stageAfter ?? null,
      },
    }),
    db.buyer.update({
      where: { id: buyer.id },
      data: {
        ...(stageAfter ? { stage: stageAfter } : {}),
        nextFollowUpAt:
          body.nextFollowUpAt === undefined
            ? undefined
            : body.nextFollowUpAt
              ? new Date(body.nextFollowUpAt)
              : null,
      },
    }),
  ]);

  return NextResponse.json(activity, { status: 201 });
}
