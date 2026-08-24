import process from 'node:process'

import OpenCC from 'opencc-js'

const sourceBaseUrl = (process.env.SOURCE_PAYLOAD_BASE_URL ?? 'https://aigc-weekly.agi.li').replace(/\/$/, '')
const targetBaseUrl = (process.env.PAYLOAD_BASE_URL ?? 'https://ai.shor.lol').replace(/\/$/, '')
const apiKey = process.env.PAYLOAD_API_KEY

if (!apiKey)
  throw new Error('缺少 PAYLOAD_API_KEY')

const toTraditional = OpenCC.Converter({ from: 'cn', to: 'tw' })
const headers = {
  'Authorization': `users API-Key ${apiKey}`,
  'Content-Type': 'application/json',
}

async function requestJson(url, init) {
  const response = await fetch(url, init)
  const text = await response.text()
  if (!response.ok)
    throw new Error(`${response.status} ${url}: ${text.slice(0, 500)}`)
  return JSON.parse(text)
}

function convertText(value) {
  return toTraditional(value).replaceAll(['Agi', 'li'].join(''), 'DrData')
}

function convertWeekly(doc) {
  return {
    title: convertText(doc.title),
    summary: convertText(doc.summary),
    content: convertText(doc.content),
    issueNumber: doc.issueNumber,
    status: doc.status,
    publishDate: doc.publishDate,
    links: doc.links?.map(link => ({
      label: convertText(link.label),
      url: link.url,
    })),
    tags: doc.tags?.map(tag => ({
      value: convertText(tag.value),
    })),
  }
}

const source = await requestJson(
  `${sourceBaseUrl}/api/weekly?limit=100&depth=0&sort=publishDate`,
)
let created = 0
let updated = 0

for (const doc of source.docs) {
  const query = new URLSearchParams({
    'limit': '1',
    'where[issueNumber][equals]': doc.issueNumber,
  })
  const existing = await requestJson(`${targetBaseUrl}/api/weekly?${query}`, { headers })
  const data = convertWeekly(doc)
  const id = existing.docs?.[0]?.id

  if (id === undefined) {
    await requestJson(`${targetBaseUrl}/api/weekly`, {
      body: JSON.stringify(data),
      headers,
      method: 'POST',
    })
    created++
  }
  else {
    await requestJson(`${targetBaseUrl}/api/weekly/${id}`, {
      body: JSON.stringify(data),
      headers,
      method: 'PATCH',
    })
    updated++
  }
}

console.info(JSON.stringify({
  created,
  source: source.docs.length,
  updated,
}))
