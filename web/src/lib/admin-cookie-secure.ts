import { NextRequest } from "next/server";

/**
 * 仅在「明确 HTTPS」时设 Secure Cookie。
 * 若缺省 X-Forwarded-Proto 却按 production 默认可 Secure，在 http://IP 访问时浏览器会丢弃 Cookie，
 * 登录后跳转 /admin 会立刻被中间件打回登录页。
 * Nginx 反代 HTTPS 时请保留：proxy_set_header X-Forwarded-Proto $scheme;
 */
export function adminCookieSecure(req: NextRequest): boolean {
  const proto = req.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    ?.toLowerCase();
  return proto === "https";
}
