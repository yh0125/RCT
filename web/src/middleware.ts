import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "admin_session";

function getExpectedSessionToken() {
  return (
    process.env.ADMIN_SESSION_TOKEN ||
    process.env.ADMIN_PASSWORD ||
    "ChangeMe123!"
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminPage = pathname.startsWith("/admin");
  const isAdminLoginPage = pathname.startsWith("/admin-login");
  const isAuthApi =
    pathname.startsWith("/api/admin/login") ||
    pathname.startsWith("/api/admin/logout");
  const protectedApiPaths = [
    "/api/export",
    "/api/prompts",
    "/api/stats",
    "/api/interpret",
  ];
  const isProtectedApi = protectedApiPaths.some((p) => pathname.startsWith(p));
  const isPatientsManageApi =
    pathname.startsWith("/api/patients") &&
    (req.method === "PATCH" || req.method === "DELETE");

  if (
    !isAdminPage &&
    !isProtectedApi &&
    !isPatientsManageApi &&
    !isAdminLoginPage &&
    !isAuthApi
  ) {
    return NextResponse.next();
  }

  const expectedToken = getExpectedSessionToken();
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  const authed = sessionToken && sessionToken === expectedToken;

  if (isAdminLoginPage || isAuthApi) {
    if (authed && isAdminLoginPage) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    return NextResponse.next();
  }

  if (!authed) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/admin-login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/export/:path*",
    "/api/prompts/:path*",
    "/api/stats/:path*",
    "/api/interpret/:path*",
    "/api/patients/:path*",
    "/admin-login/:path*",
    "/api/admin/login/:path*",
    "/api/admin/logout/:path*",
  ],
};

