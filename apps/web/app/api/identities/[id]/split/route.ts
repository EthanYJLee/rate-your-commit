import { prisma } from "@rateyourcommit/db";
import { groupCommitsByTag } from "@rateyourcommit/identity-matching";
import { NextRequest, NextResponse } from "next/server";
import { getActorLogin, logIdentityAction } from "../../../../../lib/audit-log";

/**
 * Splits a shared account's hand-tagged commits (see
 * extractSharedAccountTag) off into their own identity, so the real
 * contributor behind a [태그] can go through the normal S-07 merge
 * flow instead of staying invisible inside the shared account's
 * commit pile. Reuses an existing pending identity with that handle
 * if one was already split off before, rather than creating a
 * duplicate every time.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const contentType = request.headers.get("content-type") ?? "";
  let tag: string | undefined;
  if (contentType.includes("application/json")) {
    const body = await request.json();
    tag = body.tag || undefined;
  } else {
    const form = await request.formData();
    tag = (form.get("tag") as string) || undefined;
  }

  if (!tag) {
    return respond(request, contentType, { error: "tag is required." }, 400);
  }

  const identity = await prisma.identity.findUnique({ where: { id } });
  if (!identity) {
    return respond(request, contentType, { error: "Identity not found." }, 404);
  }
  if (identity.status !== "shared_account") {
    return respond(
      request,
      contentType,
      { error: "Only a shared_account identity can be split." },
      400,
    );
  }

  const commits = await prisma.commit.findMany({
    where: { identityId: id },
    select: { id: true, message: true },
  });
  const group = groupCommitsByTag(commits).find((g) => g.tag === tag);
  if (!group || group.commitIds.length === 0) {
    return respond(request, contentType, { error: `No commits tagged [${tag}].` }, 400);
  }

  const destination =
    (await prisma.identity.findFirst({ where: { handle: tag, email: null } })) ??
    (await prisma.identity.create({ data: { handle: tag, email: null, status: "pending" } }));

  await prisma.commit.updateMany({
    where: { id: { in: group.commitIds } },
    data: { identityId: destination.id },
  });

  await logIdentityAction({
    action: "split",
    identityId: destination.id,
    personId: null,
    previousPersonId: null,
    actorLogin: await getActorLogin(),
    note: `${identity.handle}에서 분리 (${group.commitIds.length}건 커밋)`,
  });

  return respond(request, contentType, { identity: destination, movedCommits: group.commitIds.length }, 200);
}

function respond(
  request: NextRequest,
  contentType: string,
  body: Record<string, unknown>,
  status: number,
) {
  const isFormSubmit = !contentType.includes("application/json");
  if (isFormSubmit && status < 400) {
    return NextResponse.redirect(new URL("/identities", request.url), { status: 303 });
  }
  if (isFormSubmit) {
    const url = new URL("/identities", request.url);
    if (typeof body.error === "string") url.searchParams.set("error", body.error);
    return NextResponse.redirect(url, { status: 303 });
  }
  return NextResponse.json(body, { status });
}
