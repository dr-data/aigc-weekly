# Serverless 周刊 Agent 方案

## 目标

移除 OpenCode、Docker、Cloudflare Containers 和 Firecrawl，将周刊生产流程迁移到 Cloudflare Serverless 服务，同时保留原有的信息源、评分标准、中文写作要求、三轮审核和 Payload 草稿发布。

## 架构

```text
Workflow Schedule / POST /runs
  → Cloudflare Workflow
    → 来源研究（逐来源耐久步骤）
      → 静态 fetch + Markdown for Agents
      → Readability + Turndown
      → Browser Run
      → Jina Reader
      → 失败写入 R2
    → Workers AI 筛选、评分和历史去重
    → Workers AI 撰写
    → Workers AI 审核与最多三轮修订
    → Payload REST API 幂等写入草稿
    → 研究记录、失败详情和最终 Markdown 写入 R2
```

## 设计决定

- **Workflow 替代常驻 Agent**：每个来源和生产阶段都成为耐久步骤，平台负责状态持久化、超时和重试。
- **计划任务生成完整周期**：周日计划触发时以触发时间的前一天为目标日期，生成刚结束的周日至周六，而不是抓取尚未发生的一周。
- **不使用 Queue**：当前来源规模适合 Workflow 顺序执行，可自然遵守网站限流并控制 Browser Run 并发。来源规模显著增加时再引入 Queue 扇出。
- **不使用 D1 保存 Agent 状态**：Workflow 已持久化执行状态；R2 保存可审计产物；Payload 的 `issueNumber` 唯一字段保证发布幂等。
- **Browser Run 不是第一选择**：优先使用低成本静态获取，仅在正文不可用时启动浏览器。
- **Jina Reader 是最终外部回退**：它使用不同抓取基础设施，但不是 Cloudflare 服务。没有配置 API Key 时使用其公开接口。
- **失败隔离**：单一来源失败不会终止本期任务；全部来源均无合格内容时才停止发布。

## 抓取成功判定

正文必须达到最小有效长度，且不能是常见验证码、浏览器检查或访问拒绝页面。每次最终失败都记录静态抓取、Browser Run 和 Jina Reader 三个阶段的错误。

Browser Run 和 Jina Reader 都不能保证绕过验证码、登录墙或网站条款限制。抓取器遵循目标站点的访问规则，不把重复调用当作反爬绕过手段。

## Cloudflare bindings

| Binding           | 用途                             |
| ----------------- | -------------------------------- |
| `WEEKLY_WORKFLOW` | 周刊耐久任务和每周计划           |
| `AI`              | 候选提取、评分、筛选、写作和审核 |
| `BROWSER`         | 动态网页转 Markdown              |
| `AGENT_STORAGE`   | 原始来源、失败记录和最终产物     |

## Secrets

- `SERVER_USERNAME`
- `SERVER_PASSWORD`
- `PAYLOAD_BASE_URL`
- `PAYLOAD_API_KEY`
- `JINA_API_KEY`（可选）

## 运维接口

- `GET /health`：公开健康检查。
- `POST /runs`：通过 Basic Auth 手动启动，可传 `{"date":"YYYY-MM-DD"}`。
- `GET /runs/:id`：通过 Basic Auth 查询 Workflow 状态。
