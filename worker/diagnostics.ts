import { AI_MODEL } from './config'
import { readBrowserMarkdownResponse } from './scraper'

interface DiagnosticCheck {
  durationMs: number
  message?: string
  name: string
  ok: boolean
}

export interface DiagnosticReport {
  checks: DiagnosticCheck[]
  ok: boolean
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function check(name: string, operation: () => Promise<void>): Promise<DiagnosticCheck> {
  const startedAt = Date.now()
  try {
    await operation()
    return {
      durationMs: Date.now() - startedAt,
      name,
      ok: true,
    }
  }
  catch (error) {
    return {
      durationMs: Date.now() - startedAt,
      message: errorMessage(error).slice(0, 500),
      name,
      ok: false,
    }
  }
}

async function checkPayload(env: Cloudflare.Env): Promise<void> {
  const baseUrl = env.PAYLOAD_BASE_URL.replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/api/users/me`, {
    headers: {
      Authorization: `users API-Key ${env.PAYLOAD_API_KEY}`,
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok)
    throw new Error(`Payload HTTP ${response.status}`)

  const result = await response.json<{ user?: { id?: unknown } }>()
  if (!result.user?.id)
    throw new Error('Payload API Key 未识别到用户')
}

async function checkR2(env: Cloudflare.Env): Promise<void> {
  const key = `_diagnostics/${crypto.randomUUID()}.txt`
  try {
    await env.AGENT_STORAGE.put(key, 'ok')
    const object = await env.AGENT_STORAGE.get(key)
    if (await object?.text() !== 'ok')
      throw new Error('R2 读写内容不一致')
  }
  finally {
    await env.AGENT_STORAGE.delete(key)
  }
}

async function checkBrowserRun(env: Cloudflare.Env): Promise<void> {
  const response = await env.BROWSER.quickAction('markdown', {
    rejectResourceTypes: ['image', 'media', 'font'],
    url: 'https://example.com/',
  })
  const markdown = await readBrowserMarkdownResponse(response)
  if (!markdown.toLowerCase().includes('example domain'))
    throw new Error('Browser Run 未返回预期正文')
}

async function checkWorkersAI(env: Cloudflare.Env): Promise<void> {
  const result = await env.AI.run(AI_MODEL, {
    max_tokens: 8,
    messages: [
      { role: 'user', content: 'Reply with exactly OK' },
    ],
    temperature: 0,
  })
  if (!result || typeof result !== 'object')
    throw new Error('Workers AI 未返回结果')
}

async function checkJinaReader(env: Cloudflare.Env): Promise<void> {
  const headers = new Headers({ Accept: 'text/markdown' })
  if (env.JINA_API_KEY)
    headers.set('Authorization', `Bearer ${env.JINA_API_KEY}`)

  const response = await fetch('https://r.jina.ai/https://example.com/', {
    headers,
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok)
    throw new Error(`Jina Reader HTTP ${response.status}`)

  const content = await response.text()
  if (!content.toLowerCase().includes('example domain'))
    throw new Error('Jina Reader 未返回预期正文')
}

export async function runDiagnostics(env: Cloudflare.Env): Promise<DiagnosticReport> {
  const checks = await Promise.all([
    check('payload', () => checkPayload(env)),
    check('r2', () => checkR2(env)),
    check('browser-run', () => checkBrowserRun(env)),
    check('workers-ai', () => checkWorkersAI(env)),
    check('jina-reader', () => checkJinaReader(env)),
  ])

  return {
    checks,
    ok: checks.every(result => result.ok),
  }
}
