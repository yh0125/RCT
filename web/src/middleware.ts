import { NextRequest, NextResponse } from "next/server";

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="RCT-AI Admin", charset="UTF-8"',
    },
  });
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminPage = pathname.startsWith("/admin");
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

  if (!isAdminPage && !isProtectedApi && !isPatientsManageApi) {
    return NextResponse.next();
  }

  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "ChangeMe123!";

  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Basic ")) return unauthorized();

  const base64 = auth.split(" ")[1] || "";
  let decoded = "";
  try {
    decoded = atob(base64);
  } catch {
    return unauthorized();
  }

  const idx = decoded.indexOf(":");
  if (idx < 0) return unauthorized();
  const inputUser = decoded.slice(0, idx);
  const inputPass = decoded.slice(idx + 1);

  if (inputUser !== username || inputPass !== password) return unauthorized();

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
  ],
};

