// TODO: make this a proper placeholder node
// in SN style, with the provider icon and the explainer text
export function placeholderNode ({ provider, id, src, meta = {} }) {
  const container = document.createElement('div')
  container.className = 'sn__embedWrapper__loading'
  id && container.setAttribute('data-lexical-' + provider + '-id', id)
  src && container.setAttribute('data-lexical-embed-src', src)
  meta && container.setAttribute('data-lexical-' + provider + '-meta', JSON.stringify(meta))

  const messageContainer = document.createElement('div')
  messageContainer.className = 'sn__embedWrapper__loading__message'
  container.append(messageContainer)

  const icon = document.createElement('div')
  icon.className = 'sn__embedWrapper__loading__message__icon spin fill-grey'
  // moon svg source
  icon.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
      <path fill="none" d="M0 0h24v24H0z"/>
      <path d="M11.38 2.019a7.5 7.5 0 1 0 10.6 10.6C21.662 17.854 17.316 22 12.001 22 6.477 22 2 17.523 2 12c0-5.315 4.146-9.661 9.38-9.981z"/>
    </svg>
  `
  messageContainer.append(icon)

  const message = document.createElement('div')
  message.textContent = `loading ${provider}...`
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
