export function ensureProtocol (value) {
  if (!/^([a-z0-9]+:\/\/|mailto:)/.test(value)) {
    value = 'http://' + value
  }
  return value
}

export function removeTracking (value) {
  const exprs = [
    // twitter URLs
    /^(?<url>https?:\/\/twitter\.com\/(?:#!\/)?(?<user>\w+)\/status(?:es)?\/(?<id>\d+))/,
  ]
  for (const expr of exprs) {
    value = expr.exec(value)?.groups.url ?? value;
  }
  return value
}
