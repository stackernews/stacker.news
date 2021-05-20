export function ensureProtocol (value) {
  if (!/^[a-z0-9]+:(\/\/)?/.test(value)) {
    value = 'http://' + value
  }
  return value
}
