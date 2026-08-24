import type { PublishedWeekly } from './payload'
import type { WeekInfo } from './week'
import type { WeeklyDraft } from './weekly'

const REPOSITORY = 'dr-data/aigc-weekly'

export interface PublishedGitHubIssue {
  number: number
  operation: 'created' | 'updated'
  url: string
}

interface GitHubIssue {
  html_url: string
  number: number
}

function parseRepository(): { owner: string, repo: string } {
  const [owner, repo] = REPOSITORY.split('/')
  return { owner, repo }
}

function githubHeaders(token: string): Headers {
  return new Headers({
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'aigc-weekly-worker',
    'X-GitHub-Api-Version': '2022-11-28',
  })
}

async function githubRequest<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(30_000),
  })
  const body = await response.text()

  if (!response.ok) {
    if (response.status === 410 && body.includes('Issues has been disabled'))
      throw new Error('GitHub Issues 未在 dr-data/aigc-weekly 启用，请先在仓库 Settings → Features 中开启 Issues')

    throw new Error(`GitHub API ${response.status}：${body.slice(0, 1_000)}`)
  }

  try {
    return JSON.parse(body) as T
  }
  catch {
    throw new Error('GitHub API 返回了无效 JSON')
  }
}

function buildIssueTitle(week: WeekInfo, draft: WeeklyDraft): string {
  return `[周刊草稿] ${week.weekId} · ${draft.title}`
}

function buildCmsDraftUrl(env: Cloudflare.Env, week: WeekInfo): string {
  const baseUrl = env.PAYLOAD_BASE_URL.replace(/\/$/, '')
  return `${baseUrl}/weekly/${week.weekId}`
}

function buildCmsAdminUrl(env: Cloudflare.Env, payload: PublishedWeekly): string {
  const baseUrl = env.PAYLOAD_BASE_URL.replace(/\/$/, '')
  return `${baseUrl}/admin/collections/weekly/${payload.id}`
}

export function buildIssueBody(
  env: Cloudflare.Env,
  week: WeekInfo,
  draft: WeeklyDraft,
  payload: PublishedWeekly,
): string {
  const tags = draft.tags.length > 0 ? draft.tags.join('、') : '无'
  const cmsDraftUrl = buildCmsDraftUrl(env, week)
  const cmsAdminUrl = buildCmsAdminUrl(env, payload)

  return [
    '> 自动生成的周刊草稿，待人工审核后发布。',
    '',
    `- **期号**：${week.weekId}`,
    `- **周期**：${week.startDate} ~ ${week.endDate}`,
    `- **CMS 草稿**：${cmsDraftUrl}`,
    `- **CMS 后台**：${cmsAdminUrl}`,
    `- **Payload 操作**：${payload.operation}`,
    '',
    '## 摘要',
    '',
    draft.summary,
    '',
    '## 标签',
    '',
    tags,
    '',
    '---',
    '',
    draft.content,
  ].join('\n')
}

async function findExistingIssue(
  token: string,
  owner: string,
  repo: string,
  weekId: string,
): Promise<GitHubIssue | undefined> {
  const query = new URLSearchParams({
    per_page: '1',
    q: `repo:${owner}/${repo} is:issue in:title [周刊草稿] ${weekId}`,
  })
  const result = await githubRequest<{ items?: GitHubIssue[] }>(
    `https://api.github.com/search/issues?${query}`,
    { headers: githubHeaders(token) },
  )

  return result.items?.[0]
}

export async function publishWeeklyIssue(
  env: Cloudflare.Env,
  week: WeekInfo,
  draft: WeeklyDraft,
  payload: PublishedWeekly,
): Promise<PublishedGitHubIssue> {
  if (!env.GITHUB_TOKEN)
    throw new Error('缺少 GITHUB_TOKEN')
  if (!env.PAYLOAD_BASE_URL)
    throw new Error('缺少 PAYLOAD_BASE_URL')

  const { owner, repo } = parseRepository()
  const headers = githubHeaders(env.GITHUB_TOKEN)
  const title = buildIssueTitle(week, draft)
  const body = buildIssueBody(env, week, draft, payload)
  const existing = await findExistingIssue(env.GITHUB_TOKEN, owner, repo, week.weekId)

  if (existing) {
    const updated = await githubRequest<GitHubIssue>(
      `https://api.github.com/repos/${owner}/${repo}/issues/${existing.number}`,
      {
        body: JSON.stringify({
          body,
          state: 'open',
          title,
        }),
        headers,
        method: 'PATCH',
      },
    )
    return {
      number: updated.number,
      operation: 'updated',
      url: updated.html_url,
    }
  }

  const created = await githubRequest<GitHubIssue>(
    `https://api.github.com/repos/${owner}/${repo}/issues`,
    {
      body: JSON.stringify({
        body,
        title,
      }),
      headers,
      method: 'POST',
    },
  )
  return {
    number: created.number,
    operation: 'created',
    url: created.html_url,
  }
}
