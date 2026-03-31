import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "admin_session";

function getExpectedSessionToken() {
  const raw =
    process.env.ADMIN_SESSION_TOKEN ||
    process.env.ADMIN_PASSWORD ||
    "ChangeMe123!";
  return String(raw).trim();
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminPage = pathname.startsWith("/admin");
  const isAdminLoginPage = pathname.startsWith("/admin-login");
  const isAuthApi =
    pathname.startsWith("/api/admin/login") ||
    pathname.startsWith("/api/admin/logout");
  // 注意：/api/interpret 的 GET 需对患者端开放；POST 在 route 内单独校验管理员 Cookie
  const protectedApiPaths = [
    "/api/export",
    "/api/prompts",
    "/api/stats",
    "/api/randomization-config",
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
    "/admin",
    "/admin/:path*",
    "/api/export/:path*",
    "/api/prompts/:path*",
    "/api/stats/:path*",
    "/api/randomization-config/:path*",
    "/api/patients/:path*",
    "/admin-login/:path*",
    // 显式包含无后缀路径，避免部分环境下 :path* 未命中
    "/api/admin/login",
    "/api/admin/logout",
    "/api/admin/login/:path*",
    "/api/admin/logout/:path*",
  ],
};

