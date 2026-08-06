import { prisma } from "@rateyourcommit/db";
import { auth } from "../auth";

export type IdentityAction = "merge" | "unmerge" | "split";

/**
 * The signed-in GitHub login, for attributing an S-07 identity action.
 * Every route that calls this sits behind proxy.ts's auth middleware,
 * so a session should always exist — "unknown" is a defensive
 * fallback, not an expected path.
 */
export async function getActorLogin(): Promise<string> {
  const session = await auth();
  return session?.user?.login ?? "unknown";
}

export interface LogIdentityActionParams {
  action: IdentityAction;
  identityId: string;
  personId?: string | null;
  previousPersonId?: string | null;
  actorLogin: string;
  /** e.g. the [태그] name for a "split" action. */
  note?: string | null;
}

export async function logIdentityAction(params: LogIdentityActionParams): Promise<void> {
  await prisma.identityAuditLog.create({
    data: {
      action: params.action,
      identityId: params.identityId,
      personId: params.personId ?? null,
      previousPersonId: params.previousPersonId ?? null,
      actorLogin: params.actorLogin,
      note: params.note ?? null,
    },
  });
}
