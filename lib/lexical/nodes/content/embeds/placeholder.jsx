// TODO: this is not ideal and a mess to read
export function placeholderNode ({ provider, id, src, meta = {} }) {
  const container = document.createElement('span')
  container.className = 'sn__videoWrapper'
  id && container.setAttribute('data-lexical-' + provider + '-id', id)
  src && container.setAttribute('data-lexical-embed-src', src)
  meta && container.setAttribute('data-lexical-' + provider + '-meta', JSON.stringify(meta))

  const loadingContainer = document.createElement('span')
  loadingContainer.className = 'sn__embedWrapper__loading'
  container.append(loadingContainer)

  const messageContainer = document.createElement('span')
  messageContainer.className = 'sn__embedWrapper__loading__message'
  loadingContainer.append(messageContainer)

  // copied from svg source
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  icon.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  icon.setAttribute('viewBox', '0 0 24 24')
  icon.setAttribute('width', '24')
  icon.setAttribute('height', '24')
  icon.setAttribute('class', 'spin fill-grey')

  const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path1.setAttribute('fill', 'none')
  path1.setAttribute('d', 'M0 0h24v24H0z')

  const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path2.setAttribute('d', 'M11.38 2.019a7.5 7.5 0 1 0 10.6 10.6C21.662 17.854 17.316 22 12.001 22 6.477 22 2 17.523 2 12c0-5.315 4.146-9.661 9.38-9.981z')

  icon.appendChild(path1)
  icon.appendChild(path2)
  messageContainer.append(icon)

  const message = document.createElement('span')
  message.textContent = `preparing ${provider}...`
  messageContainer.append(message)

  if (src) {
    const link = document.createElement('a')
    link.href = src
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = 'view on ' + new URL(src).hostname
    messageContainer.append(link)
  }

  return container
}
