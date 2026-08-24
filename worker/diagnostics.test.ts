import { afterEach, describe, expect, it, vi } from 'vitest'

import { runDiagnostics } from './diagnostics'

function mockFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/users/me'))
      return Response.json({ user: { id: 1 } })
    if (url.includes('api.github.com/repos/'))
      return Response.json({ full_name: 'dr-data/aigc-weekly' })
    if (url.includes('/hackernews/best')) {
      return new Response(`<?xml version="1.0"?><rss><channel><title>HN</title><item><title>Story</title><link>https://example.com/story</link></item></channel></rss>`)
    }
    return new Response('# Example Domain')
  })
}

function createEnv() {
  return {
    AGENT_STORAGE: {
      delete: vi.fn(async () => {}),
      get: vi.fn(async () => new Response('ok')),
      put: vi.fn(async () => {}),
    },
    AI: {
      run: vi.fn(async () => ({ response: 'OK' })),
    },
    BROWSER: {
      quickAction: vi.fn(async () => Response.json({
        result: '# Example Domain',
        success: true,
      })),
    },
    GITHUB_TOKEN: 'github-token',
    PAYLOAD_API_KEY: 'test-key',
    PAYLOAD_BASE_URL: 'https://cms.example.com',
  } as unknown as Cloudflare.Env
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('runDiagnostics', () => {
  it('checks all configured services without returning secrets', async () => {
    vi.stubGlobal('fetch', mockFetch())

    const report = await runDiagnostics(createEnv())

    expect(report.ok).toBe(true)
    expect(report.checks.map(check => check.name)).toEqual([
      'payload',
      'github',
      'r2',
      'rsshub',
      'browser-run',
      'workers-ai',
    ])
    expect(JSON.stringify(report)).not.toContain('test-key')
  })

  it('reports a failed binding without hiding healthy checks', async () => {
    vi.stubGlobal('fetch', mockFetch())
    const env = createEnv()
    vi.mocked(env.AI.run).mockRejectedValue(new Error('model unavailable'))

    const report = await runDiagnostics(env)

    expect(report.ok).toBe(false)
    expect(report.checks.find(check => check.name === 'workers-ai')).toMatchObject({
      message: 'model unavailable',
      ok: false,
    })
    expect(report.checks.filter(check => check.ok)).toHaveLength(5)
  })

  it('checks Jina Reader only when an API key is configured', async () => {
    vi.stubGlobal('fetch', mockFetch())
    const env = createEnv()
    env.JINA_API_KEY = 'jina-key'

    const report = await runDiagnostics(env)

    expect(report.checks.find(check => check.name === 'jina-reader')).toMatchObject({
      ok: true,
    })
  })
})
