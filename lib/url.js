export function ensureProtocol (value) {
  if (!/^([a-z0-9]+:\/\/|mailto:)/.test(value)) {
    value = 'http://' + value
  }
  return value
}
