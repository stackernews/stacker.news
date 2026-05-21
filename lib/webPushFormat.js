import removeMd from 'remove-markdown'

export function formatPushBody (body) {
  if (!body) return body

  return removeMd(body)
    .replace(/\$\$([^$]+)\$\$/g, '$1')
    .replace(/\\([,;:!?.])/g, '$1')
}
