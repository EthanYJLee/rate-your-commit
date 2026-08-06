import { prisma } from "@rateyourcommit/db";
import { NextRequest, NextResponse } from "next/server";
import { getActorLogin, logIdentityAction } from "../../../../../lib/audit-log";

/**
 * Reverts an S-07 merge — sets the identity back to unlinked/pending
 * so it can be re-merged into the correct person. Doesn't touch any
 * already-computed ScoreResult rows (those are immutable snapshots,
 * see the model's doc comment); only future worker runs see the
 * change. Same dual JSON/form-POST support as the merge route.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const identity = await prisma.identity.findUnique({ where: { id } });
  if (!identity) {
    return NextResponse.json({ error: "Identity not found." }, { status: 404 });
  }
  if (!identity.personId) {
    return NextResponse.json({ error: "Identity is not merged into a person." }, { status: 400 });
  }

  const updated = await prisma.identity.update({
    where: { id },
    data: { personId: null, status: "pending" },
  });

  await logIdentityAction({
    action: "unmerge",
    identityId: id,
    personId: null,
    previousPersonId: identity.personId,
    actorLogin: await getActorLogin(),
  });

  const contentType = request.headers.get("content-type") ?? "";
  const isFormSubmit = !contentType.includes("application/json");
  if (isFormSubmit) {
    return NextResponse.redirect(new URL("/identities", request.url), { status: 303 });
  }

  return NextResponse.json({ identity: updated });
}
