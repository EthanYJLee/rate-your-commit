import { NextResponse } from "next/server";
import { auth } from "./auth";

export default auth((req) => {
  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
});

/**
 * Protects every route except NextAuth's own callback/API routes,
 * the login page itself, and static assets — otherwise those would
 * redirect-loop against the very check that's supposed to let you
 * reach them.
 */
export const config = {
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};
