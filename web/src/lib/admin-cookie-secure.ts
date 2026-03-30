import { NextRequest } from "next/server";

/**
 * 仅在「明确 HTTPS」时设 Secure Cookie。
 * Nginx 反代 HTTPS 时请保留：proxy_set_header X-Forwarded-Proto $scheme;
 *
 * 若反代误传 https 或旧构建未更新，在 http://公网IP 下浏览器会拒收 Secure Cookie。
 * 备案期仅用 HTTP+IP 测试时可在 .env.local 设 ADMIN_COOKIE_INSECURE_HTTP=1（正式 HTTPS 上线后删掉）。
 */
export function adminCookieSecure(req: NextRequest): boolean {
  const insecure = String(process.env.ADMIN_COOKIE_INSECURE_HTTP ?? "").trim();
  if (insecure === "1" || insecure.toLowerCase() === "true") {
    return false;
  }
  const proto = req.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    ?.toLowerCase();
  return proto === "https";
}
