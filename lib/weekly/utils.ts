export function formatDate(dateInput: string) {
  const date = new Date(dateInput)
  if (Number.isNaN(date.getTime()))
    return dateInput

  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
