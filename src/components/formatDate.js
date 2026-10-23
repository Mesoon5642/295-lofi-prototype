export function formatDate(iso) {
  if (!iso) return 'unknown date'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'unknown date'
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
