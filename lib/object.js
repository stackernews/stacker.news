export const get = (obj, path) => {
  if (!path) return obj
  const keys = path.split('.')
  return keys.reduce((obj, key) => obj?.[key], obj)
}

export const set = (obj, path, value) => {
  const keys = path.split('.')
  const lastKey = keys.pop()
  const parent = get(obj, keys.join('.'))
  parent[lastKey] = value
}

export const remove = (obj, path) => {
  const keys = path.split('.')
  const lastKey = keys.pop()
  const parent = get(obj, keys.join('.'))
  delete parent?.[lastKey]
}

export const move = (obj, fromPath, toPath) => {
  const value = get(obj, fromPath)
  remove(obj, fromPath)
  set(obj, toPath, value)
}
