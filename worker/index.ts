import { runDiagnostics } from './diagnostics'
import { getWeekInfo } from './week'

export { WeeklyWorkflow } from './workflow'

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left)
  const rightBytes = new TextEncoder().encode(right)
  const length = Math.max(leftBytes.length, rightBytes.length)
  let difference = leftBytes.length ^ rightBytes.length

  for (let index = 0; index < length; index++)
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0)

  return difference === 0
}

function verifyBasicAuth(request: Request, env: Cloudflare.Env): Response | null {
  const username = env.SERVER_USERNAME
  const password = env.SERVER_PASSWORD

  if (!username || !password)
    return Response.json({ error: '服务认证尚未配置' }, { status: 503 })

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Basic ')) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Agent"' },
    })
  }

  const expected = btoa(`${username}:${password}`)
  const provided = authorization.slice(6)

  if (!constantTimeEqual(provided, expected)) {
    return new Response('Unauthorized', { status: 401 })
  }

  return null
}

async function handleFetch(request: Request, env: Cloudflare.Env): Promise<Response> {
  const url = new URL(request.url)

  if (request.method === 'GET' && url.pathname === '/health') {
    return Response.json({
      crawler: [
        'markdown-for-agents',
        'readability',
        'browser-run',
        ...(env.JINA_API_KEY ? ['jina-reader'] : []),
      ],
      service: 'aigc-weekly-agent',
      status: 'ok',
    })
  }

  const authError = verifyBasicAuth(request, env)
  if (authError) {
    return authError
  }

  if (request.method === 'POST' && url.pathname === '/runs') {
    const body: { date?: string } = await request.json<{ date?: string }>().catch(() => ({}))
    const week = getWeekInfo(body.date)
    const instance = await env.WEEKLY_WORKFLOW.create({
      id: `${week.weekId.toLowerCase()}-${crypto.randomUUID()}`,
      params: { date: week.currentDate },
    })

    return Response.json({
      id: instance.id,
      issueNumber: week.weekId,
      status: await instance.status(),
    }, { status: 202 })
  }

  if (request.method === 'GET' && url.pathname === '/diagnostics') {
    const report = await runDiagnostics(env)
    return Response.json(report, { status: report.ok ? 200 : 503 })
  }

  const runMatch = url.pathname.match(/^\/runs\/([^/]+)$/)
  if (request.method === 'GET' && runMatch?.[1]) {
    const instance = await env.WEEKLY_WORKFLOW.get(decodeURIComponent(runMatch[1]))
    return Response.json({
      id: instance.id,
      status: await instance.status(),
    })
  }

  if (request.method === 'GET' && url.pathname === '/') {
    return Response.json({
      endpoints: {
        health: 'GET /health',
        diagnostics: 'GET /diagnostics',
        start: 'POST /runs {"date":"YYYY-MM-DD"}',
        status: 'GET /runs/:id',
      },
      service: 'aigc-weekly-agent',
    })
  }

  return Response.json({ error: 'Not Found' }, { status: 404 })
}

export default {
  fetch: handleFetch,
} satisfies ExportedHandler<Cloudflare.Env>
