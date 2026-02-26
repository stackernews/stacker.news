export function composeCallbacks (...callbacks) {
  const validFns = callbacks.filter(Boolean)
  if (validFns.length === 0) return undefined

  return (...args) => {
    for (const fn of validFns) {
      fn(...args)
    }
  }
}
