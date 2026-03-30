import { NextRequest } from "next/server";

/** Host 为公网 IPv4（含可选端口）时用浏览器地址栏多为 http://IP，Cookie 绝不能带 Secure */
function hostIsIPv4Literal(hostHeader: string | null): boolean {
  if (!hostHeader) return false;
  const h = hostHeader.trim();
  return /^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?$/.test(h);
}

/**
 * 登录 Cookie 是否加 Secure。
 * - 域名 + HTTPS：依赖 X-Forwarded-Proto: https（Nginx 请设 proxy_set_header X-Forwarded-Proto $scheme）
 * - 用 http://公网IP 访问：即使反代误传 proto=https，也不设 Secure，否则浏览器丢弃 Cookie，表现为「登录后无法进 /admin」
 * - 可设 ADMIN_COOKIE_INSECURE_HTTP=1 强制永不 Secure（仅临时排障）
 */
export function adminCookieSecure(req: NextRequest): boolean {
  const insecure = String(process.env.ADMIN_COOKIE_INSECURE_HTTP ?? "").trim();
  if (insecure === "1" || insecure.toLowerCase() === "true") {
    return false;
  }
  if (hostIsIPv4Literal(req.headers.get("host"))) {
    return false;
  }
  const proto = req.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    ?.toLowerCase();
  return proto === "https";
}
