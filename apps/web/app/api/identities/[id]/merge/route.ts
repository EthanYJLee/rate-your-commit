import { prisma } from "@rateyourcommit/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * Manual identity-to-person merge (S-07). No auto-suggestion logic
 * yet — this is the plain "admin picks or creates a Person" loop.
 * Accepts either JSON or a plain HTML form POST (application/x-www-form-urlencoded),
 * so the /identities page can submit without any client-side JS.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const contentType = request.headers.get("content-type") ?? "";
  let personId: string | undefined;
  let newPersonName: string | undefined;

  if (contentType.includes("application/json")) {
    const body = await request.json();
    personId = body.personId || undefined;
    newPersonName = body.newPersonName || undefined;
  } else {
    const form = await request.formData();
    personId = (form.get("personId") as string) || undefined;
    newPersonName = (form.get("newPersonName") as string) || undefined;
  }

  if (!personId && !newPersonName) {
    return NextResponse.json(
      { error: "Provide either personId or newPersonName." },
      { status: 400 }
    );
  }

  const identity = await prisma.identity.findUnique({ where: { id } });
  if (!identity) {
    return NextResponse.json({ error: "Identity not found." }, { status: 404 });
  }

  const person = personId
    ? await prisma.person.findUniqueOrThrow({ where: { id: personId } })
    : await prisma.person.create({ data: { displayName: newPersonName! } });

  const updated = await prisma.identity.update({
    where: { id },
    data: { personId: person.id, status: "confirmed" },
  });

  const isFormSubmit = !contentType.includes("application/json");
  if (isFormSubmit) {
    return NextResponse.redirect(new URL("/identities", request.url), { status: 303 });
  }

  return NextResponse.json({ identity: updated, person });
}
