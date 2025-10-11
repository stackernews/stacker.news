// TODO: make this a proper placeholder node
// in SN style, with the provider icon and the explainer text
export function placeholderNode ({ provider, id, src, meta = {} }) {
  const container = document.createElement('div')
  container.className = 'sn__videoWrapper__explainer'
  id && container.setAttribute('data-lexical-' + provider + '-id', id)
  src && container.setAttribute('data-lexical-' + provider + '-src', src)
  meta && container.setAttribute('data-lexical-' + provider + '-meta', JSON.stringify(meta))

  const link = document.createElement('a')
  link.href = src || meta?.href || '#'
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  container.append(link)

  const explainer = document.createElement('div')
  explainer.className = 'sn__videoWrapper__explainer'
  explainer.textContent = 'Provider Placeholder (needs to be replaced)'
  link.append(explainer)

  return container
}
