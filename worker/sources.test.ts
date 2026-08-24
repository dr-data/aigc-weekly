import { describe, expect, it } from 'vitest'

import {
  chunkSources,
  filterEnabledSources,
  getMaxCandidates,
  getResearchSources,
  parseDisabledSources,
} from './sources'
import { getWeekInfo } from './week'

const week = getWeekInfo('2025-08-20')

describe('sources', () => {
  it('returns more sources than the original serverless baseline', () => {
    const sources = getResearchSources(week)
    expect(sources.length).toBeGreaterThan(30)
    expect(sources.some(source => source.name.startsWith('HN Front'))).toBe(true)
    expect(sources.some(source => source.name === 'daily.dev AI')).toBe(true)
    expect(sources.some(source => source.name === 'AI Supremacy')).toBe(true)
    expect(sources.some(source => source.name === 'The Rundown AI')).toBe(true)
  })

  it('applies per-source max candidate defaults', () => {
    expect(getMaxCandidates({ kind: 'url', name: 'X', priority: 'important', url: 'https://example.com' })).toBe(6)
    expect(getMaxCandidates({ kind: 'hn', name: 'X', priority: 'important', url: 'https://example.com' })).toBe(10)
    expect(getMaxCandidates({ kind: 'rss', name: 'X', priority: 'important', url: 'https://example.com' })).toBe(10)
  })

  it('filters disabled sources from env', () => {
    const sources = getResearchSources(week, {
      DISABLED_SOURCES: 'Solidot,HN Best',
    } as Cloudflare.Env)

    expect(sources.some(source => source.name === 'Solidot')).toBe(false)
    expect(sources.some(source => source.name === 'HN Best')).toBe(false)
    expect(filterEnabledSources(getResearchSources(week), {
      DISABLED_SOURCES: 'Solidot',
    } as Cloudflare.Env)).toHaveLength(getResearchSources(week).length - 1)
  })

  it('parses disabled source names', () => {
    expect([...parseDisabledSources({ DISABLED_SOURCES: 'A, B' } as Cloudflare.Env)]).toEqual(['A', 'B'])
  })

  it('chunks sources for parallel research', () => {
    expect(chunkSources([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
})
