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

module.exports = {
  apps: [
    {
      name: process.env.PM2_NAME || "rct-ai-web",
      cwd,
      script: ".next/standalone/server.js",
      interpreter: "node",
      env: {
        ...fileEnv,
        NODE_ENV: "production",
        HOSTNAME: process.env.HOSTNAME || "0.0.0.0",
        PORT: process.env.PORT || fileEnv.PORT || "3000",
      },
    },
  ],
};
