import type { CollectionConfig } from 'payload'

import { revalidateWeeklyCache } from '@/lib/weekly/cache'
// import OvertypeFieldComponent from '@/components/payload/overtype'

async function invalidateWeeklyCache<T>(doc: T): Promise<T> {
  await revalidateWeeklyCache()
  return doc
}

export const Weekly: CollectionConfig = {
  slug: 'weekly',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'issueNumber', 'publishDate'],
  },
  access: {
    read: () => true,
  },
  hooks: {
    afterChange: [({ doc }) => invalidateWeeklyCache(doc)],
    afterDelete: [({ doc }) => invalidateWeeklyCache(doc)],
  },
  fields: [
    {
      name: 'title',
      label: '標題',
      type: 'text',
      required: true,
    },
    {
      name: 'summary',
      label: '摘要',
      type: 'textarea',
      required: true,
      admin: {
        rows: 3,
      },
    },
    {
      name: 'content',
      label: '內容',
      type: 'textarea',
      required: true,
      admin: {
        components: {
          Field: {
            path: '@/components/payload/overtype.tsx#OvertypeFieldComponent',
          },
        },
      },
    },
    {
      name: 'issueNumber',
      label: '期刊編號',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        position: 'sidebar',
        description: '格式：Y + 年份（兩位數）+ W + 週數（兩位數），例如：Y26W12',
      },
      validate: (value: string) => {
        const pattern = /^Y\d{2}W\d{2}$/
        if (!pattern.test(value)) {
          return '期刊編號格式不正確，請使用格式：Y[年份]W[週數]，例如 Y26W12'
        }
        return true
      },
    },
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      options: [
        {
          label: '草稿',
          value: 'draft',
        },
        {
          label: '已發佈',
          value: 'published',
        },
      ],
      defaultValue: 'draft',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'publishDate',
      label: '發佈日期',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
        },
        position: 'sidebar',
      },
    },
    {
      name: 'coverImage',
      label: '封面圖',
      type: 'relationship',
      relationTo: 'media',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'links',
      label: '連結',
      type: 'array',
      admin: {
        position: 'sidebar',
      },
      fields: [
        {
          name: 'label',
          label: '標籤',
          type: 'text',
          required: true,
        },
        {
          name: 'url',
          label: 'URL',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'tags',
      label: '標籤',
      type: 'array',
      admin: {
        position: 'sidebar',
      },
      fields: [
        {
          name: 'value',
          label: '標籤值',
          type: 'text',
          required: true,
        },
      ],
    },
  ],
}
