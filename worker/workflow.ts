import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers'

import type { ResearchFailure, SourceResearchResult, WeeklyDraft } from './weekly'

import { WorkflowEntrypoint } from 'cloudflare:workers'

import { publishWeekly } from './payload'
import { createCloudflareScraper } from './scraper'
import { getResearchSources } from './sources'
import { getWeekInfo, getWorkflowTargetDate } from './week'
import {
  deduplicateArticles,
  researchSource,
  reviewWeekly,
  reviseWeekly,
  selectArticles,
  writeWeekly,
} from './weekly'

export interface WeeklyWorkflowParams {
  date?: string
}

const STEP_OPTIONS = {
  retries: {
    backoff: 'exponential' as const,
    delay: '10 seconds' as const,
    limit: 2,
  },
  timeout: '15 minutes' as const,
}

async function getHistoricalRss(env: Cloudflare.Env): Promise<string> {
  try {
    const result = await createCloudflareScraper(env).scrape('https://aigc-weekly.agi.li/rss.xml')
    return result.content
  }
  catch (error) {
    console.warn('历史 RSS 抓取失败，将继续生成周刊', error)
    return ''
  }
}

function unexpectedFailure(source: string, url: string, error: unknown): ResearchFailure {
  return {
    error: error instanceof Error ? error.message : String(error),
    source,
    url,
  }
}

function assertWorkflowConfiguration(env: Cloudflare.Env): void {
  const missing = [
    ['PAYLOAD_BASE_URL', env.PAYLOAD_BASE_URL],
    ['PAYLOAD_API_KEY', env.PAYLOAD_API_KEY],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name)

  if (missing.length > 0)
    throw new Error(`周刊 Workflow 缺少必要配置：${missing.join(', ')}`)
}

export class WeeklyWorkflow extends WorkflowEntrypoint<Cloudflare.Env, WeeklyWorkflowParams> {
  async run(event: WorkflowEvent<WeeklyWorkflowParams>, step: WorkflowStep) {
    assertWorkflowConfiguration(this.env)

    const targetDate = getWorkflowTargetDate(
      event.payload?.date,
      event.timestamp,
      event.schedule?.scheduledTime,
    )
    const week = getWeekInfo(targetDate)
    const artifactPrefix = `weekly-agent/${week.weekId}/${event.instanceId}`
    const sources = getResearchSources(week)
    const researchResults: SourceResearchResult[] = []

    for (const [index, source] of sources.entries()) {
      try {
        const result = await step.do(
          `研究来源 ${String(index + 1).padStart(2, '0')}`,
          STEP_OPTIONS,
          () => researchSource(this.env, source, week, artifactPrefix),
        )
        researchResults.push(result)
      }
      catch (error) {
        researchResults.push({
          articles: [],
          failures: [unexpectedFailure(source.name, source.url, error)],
          source: source.name,
        })
      }
    }

    const failures = researchResults.flatMap(result => result.failures)
    const researchedArticles = deduplicateArticles(
      researchResults.flatMap(result => result.articles),
    )

    await step.do('保存研究结果', async () => {
      await Promise.all([
        this.env.AGENT_STORAGE.put(
          `${artifactPrefix}/research.json`,
          JSON.stringify(researchResults, null, 2),
          { httpMetadata: { contentType: 'application/json; charset=utf-8' } },
        ),
        this.env.AGENT_STORAGE.put(
          `${artifactPrefix}/failures.json`,
          JSON.stringify(failures, null, 2),
          { httpMetadata: { contentType: 'application/json; charset=utf-8' } },
        ),
      ])
    })

    if (researchedArticles.length === 0)
      throw new Error('没有找到达到 70 分的本周 AIGC 内容，已保存失败记录')

    const historicalRss = await step.do('读取历史周刊', STEP_OPTIONS, () => getHistoricalRss(this.env))
    const selected = await step.do(
      '筛选和去重',
      STEP_OPTIONS,
      () => selectArticles(this.env, researchedArticles, historicalRss),
    )

    let draft = await step.do(
      '撰写周刊',
      STEP_OPTIONS,
      () => writeWeekly(this.env, week, selected),
    )

    for (let revision = 1; revision <= 3; revision++) {
      const review = await step.do(
        `审核周刊 ${revision}`,
        STEP_OPTIONS,
        () => reviewWeekly(this.env, week, draft),
      )
      if (review.pass)
        break

      if (revision === 3)
        throw new Error(`周刊连续三次审核未通过：${review.critique}`)

      draft = await step.do(
        `修订周刊 ${revision}`,
        STEP_OPTIONS,
        () => reviseWeekly(this.env, draft, review.critique),
      )
    }

    const published = await step.do(
      '发布 Payload 草稿',
      STEP_OPTIONS,
      () => publishWeekly(this.env, week, draft),
    )

    await step.do('保存最终产物', () => this.saveFinalArtifact(artifactPrefix, draft, published))

    return {
      artifactPrefix,
      articleCount: selected.length,
      failureCount: failures.length,
      issueNumber: week.weekId,
      payload: published,
    }
  }

  private async saveFinalArtifact(
    artifactPrefix: string,
    draft: WeeklyDraft,
    published: { id: number | string, operation: string },
  ): Promise<void> {
    await Promise.all([
      this.env.AGENT_STORAGE.put(
        `${artifactPrefix}/weekly.md`,
        draft.content,
        { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } },
      ),
      this.env.AGENT_STORAGE.put(
        `${artifactPrefix}/published.json`,
        JSON.stringify(published, null, 2),
        { httpMetadata: { contentType: 'application/json; charset=utf-8' } },
      ),
    ])
  }
}
