# DrData 的 AIGC 週刊

一个由 Agentic AI Agent 驱动的 AIGC（人工智能生成内容）精选周刊。本项目利用最新的 AI 和 Serverless 技术，为您提供最新的资讯、工具和资源。

---

**在线阅读**: <https://ai.shor.lol>

**RSS订阅**: <https://ai.shor.lol/rss.xml>

![aigc-weekly](https://socialify.git.ci/dr-data/aigc-weekly/image?description=1&forks=1&name=1&owner=1&pattern=Circuit+Board&stargazers=1&theme=Auto)

## 🚀 特性

- **AI 智能策展**：利用 Agentic AI Agent 自动发现和筛选内容。
- **现代技术栈**：基于 Next.js 15、Payload CMS 3.0 和 Cloudflare 边缘基础设施构建。
- **Serverless 架构**：完全部署在 Cloudflare Workers、Workflows、Workers AI、Browser Run、D1 和 R2 上。
- **耐久任务编排**：周刊生产的每个阶段都可独立重试，并从最近成功的 Workflow 步骤恢复。
- **多级网页提取**：按静态 Markdown、Readability、Browser Run、Jina Reader 的顺序逐级回退。

## 🛠 技术栈

- **框架**：[Next.js](https://nextjs.org/) (App Router) & [OpenNext](https://opennext.js.org/)
- **CMS**：[Payload CMS](https://payloadcms.com/) (Headless)
- **数据库**：[Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite)
- **存储**：[Cloudflare R2](https://developers.cloudflare.com/r2/) (对象存储)
- **Agent 编排**：[Cloudflare Workflows](https://developers.cloudflare.com/workflows/)
- **模型推理**：[Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
- **动态网页**：[Cloudflare Browser Run](https://developers.cloudflare.com/browser-run/)
- **边缘运行时**：[Cloudflare Workers](https://workers.cloudflare.com/)

## 🏗 架构

本项目包含三个主要组件：

1. **Next.js 应用 (`app/`)**：负责面向读者的前端页面以及 Payload CMS 管理界面。
2. **Weekly Workflow (`worker/workflow.ts`)**：按信息收集、筛选、写作、审核、发布五个阶段生成周刊。
3. **抓取模块 (`worker/scraper.ts`)**：首先请求 Markdown for Agents，再使用 Readability；内容仍不可用时依次调用 Browser Run 和 Jina Reader。
4. **Worker API (`worker/index.ts`)**：启动 Workflow、查询任务状态并提供健康检查。

抓取失败不会中断其他来源。研究产物、最终 Markdown 和失败详情会保存到 R2 的 `weekly-agent/` 前缀中。

## 🏁 快速开始

### 前置要求

- **Node.js**：v22 或更高版本
- **pnpm**：v10 或更高版本
- **Cloudflare 账号**：用于 D1、R2 和 Workers 部署。

### 安装

1. 克隆仓库：

   ```bash
   git clone https://github.com/dr-data/aigc-weekly.git
   cd aigc-weekly
   ```

2. 安装依赖：
   ```bash
   pnpm install
   ```

### 配置

1. **环境变量**：
   配置必要的环境变量：
   - 复制 `.env.example` 为 `.env.local` 并填写相应值。
   - 复制 `worker/.env.example` 为 `worker/.env.local` 并填写相应值。

   确保你已经配置了必要的 Cloudflare 绑定, 你需要在 `wrangler.jsonc` 中配置以下绑定：
   - `D1`：数据库
   - `R2`：对象存储
   - `PAYLOAD_SECRET`：一个安全的随机字符串。

2. **生成类型**：

   ```bash
   pnpm generate:types
   ```

3. **配置周刊 Worker**：
   - `SERVER_USERNAME`、`SERVER_PASSWORD`：手动启动和查询任务所需的 Basic Auth。
   - `PAYLOAD_BASE_URL`、`PAYLOAD_API_KEY`：将最终周刊写入 Payload CMS。
   - `JINA_API_KEY`：可选；配置后才启用 Jina Reader 最终回退，未配置时完全跳过。

   Workers AI、Browser Run、R2 和 Workflows 通过 `worker/wrangler.jsonc` 中的 Cloudflare bindings 访问，无需在应用中保存对应 API Token。

### 本地运行

- **Next.js 应用**：

  ```bash
  pnpm dev
  ```

  访问应用：`http://localhost:3000` 和 `http://localhost:3000/admin`。

- **Cloudflare Worker（包含 Agent）**：

  ```bash
  pnpm dev:worker
  ```

  Browser Run Quick Actions 使用远程 binding，因此本地开发需要 Cloudflare 登录状态和网络连接，不需要 Docker。

### 手动运行周刊

```bash
curl -u "$SERVER_USERNAME:$SERVER_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-08-23"}' \
  http://localhost:2442/runs
```

请求返回 Workflow 实例 ID。使用 `GET /runs/:id` 查询状态。生产环境也会按 `worker/wrangler.jsonc` 中的计划每周自动启动。

## 🚀 部署

本项目设计为部署在 Cloudflare 上。

1. **部署数据库和应用**：

   ```bash
   pnpm deploy
   ```

   此命令会运行 `deploy:database`（迁移）和 `deploy:app`（OpenNext 构建与上传）。

2. **部署 Worker**：
   ```bash
   pnpm deploy:worker
   ```

## 📂 项目结构

- `app/`：Next.js 应用源代码。
- `worker/`：Cloudflare Worker、Workflow、Workers AI 调用和网页抓取代码。
- `collections/`：Payload CMS 数据模型。
- `migrations/`：数据库迁移文件。
- `public/`：静态资源。

## 🤖 AI 代码助手

本项目包含 [AGENTS.md](AGENTS.md) 文件，为 AI 代码助手（如 Claude Code、Cursor、Copilot 等）提供开发指南，包括命令、代码风格和架构信息。

## 📄 许可证

本项目采用 [GNU Affero General Public License v3.0](LICENSE) 许可证。
