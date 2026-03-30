import { NextRequest, NextResponse } from "next/server";
import { adminCookieSecure } from "@/lib/admin-cookie-secure";

const SESSION_COOKIE = "admin_session";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: adminCookieSecure(req),
    path: "/",
    maxAge: 0,
  });
  return res;
}

