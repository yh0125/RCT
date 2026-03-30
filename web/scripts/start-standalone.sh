#!/usr/bin/env bash
# Next standalone 会读 process.env.HOSTNAME；Linux 系统常自带 HOSTNAME=机器名，
# 经 PM2 合并后可能覆盖 ecosystem，导致监听 ::1 与端口冲突。此处在 exec 前强制监听全网卡。
set -euo pipefail
cd "$(dirname "$0")/.."
export HOSTNAME=0.0.0.0
: "${PORT:=3000}"
exec node .next/standalone/server.js
