import { getWeekInfo } from './week'

export { WeeklyWorkflow } from './workflow'

function verifyBasicAuth(request: Request, env: Cloudflare.Env): Response | null {
  const username = env.SERVER_USERNAME
  const password = env.SERVER_PASSWORD

  if (!password) {
    return null
  }

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Basic ')) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Agent"' },
    })
  }

  const expected = btoa(`${username}:${password}`)
  const provided = authorization.slice(6)

  if (provided !== expected) {
    return new Response('Unauthorized', { status: 401 })
  }

  return null
}

async function handleFetch(request: Request, env: Cloudflare.Env): Promise<Response> {
  const url = new URL(request.url)

  if (request.method === 'GET' && url.pathname === '/health') {
    return Response.json({
      crawler: ['markdown-for-agents', 'readability', 'browser-run', 'jina-reader'],
      service: 'aigc-weekly-agent',
      status: 'ok',
    })
  }

  const authError = verifyBasicAuth(request, env)
  if (authError) {
    return authError
  }

  if (request.method === 'POST' && url.pathname === '/runs') {
    const body = await request.json<{ date?: string }>().catch(() => ({}))
    const week = getWeekInfo(body.date)
    const instance = await env.WEEKLY_WORKFLOW.create({
      id: `${week.weekId.toLowerCase()}-${crypto.randomUUID()}`,
      params: { date: body.date },
    })

    return Response.json({
      id: instance.id,
      issueNumber: week.weekId,
      status: await instance.status(),
    }, { status: 202 })
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
