import { NextRequest, NextResponse } from "next/server";
import { adminCookieSecure } from "@/lib/admin-cookie-secure";

const SESSION_COOKIE = "admin_session";

function getExpectedSessionToken() {
  const raw =
    process.env.ADMIN_SESSION_TOKEN ||
    process.env.ADMIN_PASSWORD ||
    "ChangeMe123!";
  return String(raw).trim();
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "").trim();

  const expectedUser = (process.env.ADMIN_USERNAME || "admin").trim();
  const expectedPassword = (process.env.ADMIN_PASSWORD || "ChangeMe123!").trim();

  if (username !== expectedUser || password !== expectedPassword) {
    return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, getExpectedSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: adminCookieSecure(req),
    path: "/",
    maxAge: 60 * 60 * 12, // 12h
  });
  return res;
}

