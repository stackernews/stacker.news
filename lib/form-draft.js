export const fieldDraftKey = (prefix, name) => prefix ? `${prefix}-${name}` : undefined

// clear the same draft keys used by inputs and the editor
export function clearFieldDrafts (prefix, values) {
  if (!prefix) return
  const clear = (value, name) => {
    window.localStorage.removeItem(fieldDraftKey(prefix, name))
    if (Array.isArray(value)) {
      // array entries use brackets, e.g. 'forward[0]'
      value.forEach((entry, i) => clear(entry, `${name}[${i}]`))
    } else if (value && typeof value === 'object') {
      // nested fields use dots, e.g. 'forward[0].nym'
      Object.entries(value).forEach(([key, entry]) => clear(entry, `${name}.${key}`))
    }
  }
  // top-level fields, e.g. 'title' -> 'discussion-title'
  Object.entries(values).forEach(([name, value]) => clear(value, name))
}
