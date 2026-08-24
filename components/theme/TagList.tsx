interface Tag {
  value: string
}

interface TagListProps {
  tags: string[] | Tag[]
}

export function TagList({ tags }: TagListProps) {
  if (!tags || tags.length === 0)
    return null

  const tagStrings = tags.map(tag => (typeof tag === 'string' ? tag : tag.value))

  return (
    <ul className="post-tags" aria-label="標籤">
      {tagStrings.map(tag => (
        <li key={tag} className="post-tag">
          #
          {tag}
        </li>
      ))}
    </ul>
  )
}
