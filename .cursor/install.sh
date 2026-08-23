#!/usr/bin/env bash
set -euo pipefail

# 安装依赖（使用锁文件确保可复现）
pnpm install --frozen-lockfile

# 本地开发环境变量：仅在缺失时生成随机 PAYLOAD_SECRET，保证幂等
if [ ! -f .env.local ]; then
  printf 'PAYLOAD_SECRET=%s\nNEXT_PUBLIC_BASE_URL=http://localhost:3000\n' "$(openssl rand -hex 32)" > .env.local
fi

# 生成 Cloudflare 与 Payload 类型定义（离线可用，本地开发必须）
pnpm generate:types
