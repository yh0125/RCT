/**
 * PM2 config: loads .env.local safely (values may contain spaces).
 * Usage from web/: pm2 start ecosystem.config.cjs
 */
const fs = require("fs");
const path = require("path");

function loadDotEnvLocal(cwd) {
  const env = {};
  const p = path.join(cwd, ".env.local");
  if (!fs.existsSync(p)) return env;
  const text = fs.readFileSync(p, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const lineClean = line.replace(/\r/g, "");
    if (!lineClean || lineClean.trim().startsWith("#")) continue;
    const idx = lineClean.indexOf("=");
    if (idx < 1) continue;
    const key = lineClean.slice(0, idx).trim();
    if (!key) continue;
    env[key] = lineClean.slice(idx + 1);
  }
  return env;
}

const cwd = __dirname;
const fileEnv = loadDotEnvLocal(cwd);
// 绝不把 HOSTNAME 从 .env 带进进程：Linux 系统/用户环境里的 HOSTNAME 常为机器名，
// Next standalone 会用它做 listen，导致绑定 ::1 与 0.0.0.0:3000 冲突（EADDRINUSE）。
const { HOSTNAME: _dropHost, ...fileEnvSafe } = fileEnv;

module.exports = {
  apps: [
    {
      name: process.env.PM2_NAME || "rct-ai-web",
      cwd,
      script: "scripts/start-standalone.sh",
      interpreter: "bash",
      env: {
        ...fileEnvSafe,
        NODE_ENV: "production",
        // 必须写死字符串；勿用 process.env.HOSTNAME（PM2 可能合并进系统变量）
        HOSTNAME: "0.0.0.0",
        PORT: String(process.env.PORT || fileEnv.PORT || "3000"),
      },
    },
  ],
};
