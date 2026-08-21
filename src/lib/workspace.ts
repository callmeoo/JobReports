import { getAllowedEmails } from "@/lib/allowed-emails";
import { db } from "@/lib/db";

/** 个人工作台：白名单邮箱共享同一套买家/内容数据 */
export async function getWorkspaceUserIds(): Promise<string[]> {
  const users = await db.user.findMany({
    where: { email: { in: getAllowedEmails() } },
    select: { id: true },
  });
  return users.map((user) => user.id);
}

export async function workspaceAuthorFilter() {
  const ids = await getWorkspaceUserIds();
  return { authorId: { in: ids.length > 0 ? ids : ["__none__"] } };
}
