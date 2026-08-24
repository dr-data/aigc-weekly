# DrData 的 AIGC 週刊

由 Agentic AI 驱动的 AIGC 精选周刊。项目完全运行在 Cloudflare Serverless 基础设施上：周刊由 Workflow 自动生产，经 CMS 保存草稿，并同步发布到 GitHub Issue 供审核。

---

**在线阅读**：<https://ai.shor.lol>

**RSS 订阅**：<https://ai.shor.lol/rss.xml>

![aigc-weekly](https://socialify.git.ci/dr-data/aigc-weekly/image?description=1&forks=1&name=1&owner=1&pattern=Circuit+Board&stargazers=1&theme=Auto)

## 特性

- **全自动周刊生产**：Cloudflare Workflow 编排信息收集、筛选、写作、审核与发布，每个阶段可独立重试。
- **多级内容抓取**：按 Markdown for Agents → Readability → Browser Run → Jina Reader 逐级回退。
- **CMS + GitHub 双通道发布**：草稿写入 Payload CMS，并同步创建/更新 [dr-data/aigc-weekly](https://github.com/dr-data/aigc-weekly) 的 GitHub Issue。
- **现代 Web 栈**：Next.js 15 + Payload CMS 3.0，部署在 Cloudflare Workers、D1 与 R2。
- **无容器依赖**：不依赖 Docker、常驻 Agent 或外部爬虫服务。

## 技术栈

| 层级       | 技术                                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 前端与 CMS | [Next.js](https://nextjs.org/)（App Router）、[Payload CMS](https://payloadcms.com/)、[OpenNext](https://opennext.js.org/)                                                                       |
| 周刊 Agent | [Cloudflare Workflows](https://developers.cloudflare.com/workflows/)、[Workers AI](https://developers.cloudflare.com/workers-ai/)、[Browser Run](https://developers.cloudflare.com/browser-run/) |
| 数据与存储 | [Cloudflare D1](https://developers.cloudflare.com/d1/)、[Cloudflare R2](https://developers.cloudflare.com/r2/)                                                                                   |
| 运行时     | [Cloudflare Workers](https://workers.cloudflare.com/)                                                                                                                                            |

## 架构

项目由两个独立部署单元组成：

```text
┌─────────────────────────────────────────────────────────────┐
│  Next.js 应用（wrangler.jsonc → ai.shor.lol）               │
│  app/          读者前台 + Payload Admin                      │
│  collections/  周刊数据模型                                   │
│  lib/          数据访问与站点配置                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  周刊 Worker（worker/wrangler.jsonc → aigc-weekly-worker）   │
│  Workflow  →  研究来源 → 筛选 → 写作 → 审核 → 发布           │
│  payload.ts   写入 Payload CMS 草稿                          │
│  github.ts    同步 GitHub Issue（dr-data/aigc-weekly）       │
│  scraper.ts   多级网页抓取                                   │
│  R2           保存研究记录、失败详情与最终 Markdown           │
└─────────────────────────────────────────────────────────────┘
```

周刊 Workflow 流程：

```text
计划任务 / POST /runs
  → 逐来源研究（RSS、HN API、RSSHub、网页抓取）
  → Workers AI 筛选与去重
  → Workers AI 撰写周刊
  → Workers AI 审核（最多 3 轮修订）
  → Payload REST API 幂等写入草稿
  → GitHub REST API 创建/更新 Issue
  → R2 保存最终产物
```

更详细的设计说明见 [docs/serverless-weekly-agent.md](docs/serverless-weekly-agent.md)。

## 项目结构

```text
aigc-weekly/
├── app/                 # Next.js App Router（前台 + Payload Admin）
├── collections/         # Payload CMS 数据模型
├── components/          # React 组件
├── lib/                 # 工具函数与配置
├── migrations/          # D1 数据库迁移（自动生成，勿手动修改）
├── public/              # 静态资源
├── worker/              # 周刊 Agent Worker
│   ├── workflow.ts      # Workflow 编排
│   ├── weekly.ts        # 研究、筛选、写作、审核
│   ├── sources.ts       # 信息源配置
│   ├── scraper.ts       # 多级网页抓取
│   ├── payload.ts       # Payload CMS 发布
│   ├── github.ts        # GitHub Issue 发布
│   ├── images.ts        # 文章配图提取
│   └── index.ts         # HTTP API（/runs、/health、/diagnostics）
├── wrangler.jsonc       # Next.js 应用 Cloudflare 配置
├── payload.config.ts    # Payload CMS 配置
└── docs/                # 补充文档
```

## 快速开始

### 前置要求

- **Node.js** 22+
- **pnpm** 10+（推荐通过 Corepack 启用：`corepack enable`）
- **Cloudflare 账号**：用于 D1、R2、Workers、Workflows、Workers AI 与 Browser Run

### 安装

```bash
git clone https://github.com/dr-data/aigc-weekly.git
cd aigc-weekly
pnpm install
pnpm generate:types
```

### 配置

#### 1. Next.js 应用

复制根目录环境变量模板：

```bash
cp .env.example .env.local
```

| 变量                   | 说明                                                   |
| ---------------------- | ------------------------------------------------------ |
| `PAYLOAD_SECRET`       | Payload 加密密钥，本地可用 `openssl rand -hex 32` 生成 |
| `NEXT_PUBLIC_BASE_URL` | 站点 URL，本地开发填 `http://localhost:3000`           |

根目录 `wrangler.jsonc` 已声明 D1、R2 等 Cloudflare bindings，本地开发通过 Wrangler 平台代理访问。

#### 2. 周刊 Worker

复制 Worker 环境变量模板：

```bash
cp worker/.env.example worker/.env.local
```

本地开发时，`worker/.env.local` 供 `wrangler dev` 读取；生产环境通过 `wrangler secret put` 写入。

| Secret             | 必需 | 说明                                                                                                               |
| ------------------ | ---- | ------------------------------------------------------------------------------------------------------------------ |
| `SERVER_USERNAME`  | 是   | 手动触发与查询任务的 Basic Auth 用户名                                                                             |
| `SERVER_PASSWORD`  | 是   | Basic Auth 密码                                                                                                    |
| `PAYLOAD_BASE_URL` | 是   | Payload CMS 地址（如 `https://ai.shor.lol`）                                                                       |
| `PAYLOAD_API_KEY`  | 是   | Payload API Key（`users` 集合中创建）                                                                              |
| `GITHUB_TOKEN`     | 是   | GitHub PAT（`repo` 权限），用于在 [dr-data/aigc-weekly](https://github.com/dr-data/aigc-weekly) 创建周刊草稿 Issue |
| `JINA_API_KEY`     | 否   | Jina Reader API Key；未配置时跳过该回退                                                                            |
| `RSSHUB_BASE_URL`  | 否   | RSSHub 实例地址，默认 `https://rsshub.shorlol.workers.dev`                                                         |

生产环境写入 Worker secrets：

```bash
cd worker
npx wrangler secret put SERVER_USERNAME
npx wrangler secret put SERVER_PASSWORD
npx wrangler secret put PAYLOAD_BASE_URL
npx wrangler secret put PAYLOAD_API_KEY
npx wrangler secret put GITHUB_TOKEN
# 可选
npx wrangler secret put JINA_API_KEY
npx wrangler secret put RSSHUB_BASE_URL
```

> **注意**：仓库需在 GitHub Settings → Features 中启用 **Issues**，Workflow 才能同步发布草稿 Issue。

Workers AI、Browser Run、R2 与 Workflows 通过 `worker/wrangler.jsonc` 中的 bindings 访问，无需额外 API Token。

### 本地运行

**Next.js 应用**（前台 + Payload Admin）：

```bash
pnpm dev
```

- 前台：<http://localhost:3000>
- 后台：<http://localhost:3000/admin>

**周刊 Worker**：

```bash
pnpm dev:worker
```

Worker API 默认监听 <http://localhost:2442>。Browser Run 使用远程 binding，本地开发需要 `wrangler login` 与网络连接。

### 手动触发周刊

```bash
curl -u "$SERVER_USERNAME:$SERVER_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"date":"2025-08-20"}' \
  http://localhost:2442/runs
```

返回 Workflow 实例 ID，用以下命令查询进度：

```bash
curl -u "$SERVER_USERNAME:$SERVER_PASSWORD" \
  http://localhost:2442/runs/<instance-id>
```

生产环境按 `worker/wrangler.jsonc` 中的 cron（每周日 23:00 UTC）自动触发。

### 运维接口

| 端点               | 认证       | 说明                                                      |
| ------------------ | ---------- | --------------------------------------------------------- |
| `GET /health`      | 无         | 公开健康检查                                              |
| `GET /diagnostics` | Basic Auth | 检查 Payload、GitHub、R2、RSSHub、Browser Run、Workers AI |
| `POST /runs`       | Basic Auth | 手动启动 Workflow，可传 `{"date":"YYYY-MM-DD"}`           |
| `GET /runs/:id`    | Basic Auth | 查询 Workflow 状态                                        |

## 开发与测试

```bash
pnpm lint:fix      # ESLint 检查并自动修复
pnpm typecheck     # TypeScript 类型检查（含 worker）
pnpm test          # Vitest 单元测试
```

AI 代码助手开发约定见 [AGENTS.md](AGENTS.md)。

## 部署

项目分两部分部署：

```bash
# 1. 数据库迁移 + Next.js 应用
pnpm deploy

# 2. 周刊 Worker（含 Workflow）
pnpm deploy:worker
```

`pnpm deploy` 依次执行 `deploy:database`（Payload 迁移 + D1 优化）和 `deploy:app`（OpenNext 构建与上传）。

## 许可证

本项目采用 [GNU Affero General Public License v3.0](LICENSE) 许可证。
