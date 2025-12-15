import { $applyNodeReplacement, DecoratorNode, createState, $getState, $setState } from 'lexical'

// kind and status can change over time, so we need to store them in states
const kindState = createState('kind', {
  parse: (value) => (typeof value === 'string' ? value : 'unknown')
})

const statusState = createState('status', {
  parse: (value) => (typeof value === 'string' ? value : 'idle')
})

function $convertMediaElement (domNode) {
  let src, alt, title, width, height, kind, autolink

  if (domNode instanceof window.HTMLImageElement || domNode instanceof window.HTMLVideoElement) {
    ({ alt, title, src, width, height } = domNode)
    autolink = domNode.hasAttribute('data-autolink')
    kind = domNode instanceof window.HTMLImageElement ? 'image' : 'video'
  } else if (domNode instanceof window.HTMLAnchorElement && domNode.hasAttribute('data-media-kind')) {
    src = domNode.getAttribute('href')
    alt = domNode.getAttribute('data-media-alt') || ''
    title = domNode.getAttribute('title') || ''
    width = domNode.getAttribute('data-media-width')
    height = domNode.getAttribute('data-media-height')
    kind = domNode.getAttribute('data-media-kind') || 'unknown'
    width = width ? parseInt(width, 10) : 0
    height = height ? parseInt(height, 10) : 0
    autolink = domNode.hasAttribute('data-autolink')
  } else {
    return null
  }

  const node = $createMediaNode({ src, alt, title, width, height, autolink })
  $setState(node, kindState, kind)
  $setState(node, statusState, 'done')
  return { node }
}

export class MediaNode extends DecoratorNode {
  __src
  __title
  __alt
  __width
  __height
  __maxWidth
  __autolink

  $config () {
    return this.config('media', {
      extends: DecoratorNode,
      stateConfigs: [
        { flat: true, stateConfig: kindState },
        { flat: true, stateConfig: statusState }
      ]
    })
  }

  constructor (src, title, alt, width, height, maxWidth, autolink, key) {
    super(key)
    this.__src = src
    this.__title = title ?? ''
    this.__alt = alt ?? ''
    this.__width = width ?? 0
    this.__height = height ?? 0
    this.__maxWidth = maxWidth ?? 500
    this.__autolink = autolink ?? false
  }

  static clone (node) {
    const clone = new MediaNode(
      node.__src,
      node.__title,
      node.__alt,
      node.__width,
      node.__height,
      node.__maxWidth,
      node.__autolink,
      node.__key
    )
    return clone
  }

  static importJSON (serializedNode) {
    const { src, title, alt, width, height, maxWidth, kind, status, autolink } = serializedNode
    const node = $createMediaNode({ src, title, alt, width, height, maxWidth, autolink })
    $setState(node, kindState, kind ?? 'unknown')
    $setState(node, statusState, status ?? 'idle')
    return node
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      src: this.__src,
      title: this.__title,
      alt: this.__alt,
      width: this.__width,
      height: this.__height,
      maxWidth: this.__maxWidth,
      kind: $getState(this, kindState),
      status: $getState(this, statusState),
      autolink: this.__autolink
    }
  }

  static importDOM () {
    return {
      img: () => ({
        conversion: $convertMediaElement,
        priority: 0
      }),
      video: () => ({
        conversion: $convertMediaElement,
        priority: 0
      }),
      a: () => ({
        conversion: $convertMediaElement,
        priority: 0
      })
    }
  }

  // we're exporting a link node instead of a media node
  // it contains everything we need to re-import it as a media node (html -> lexical)
  // because of media checks, rendering HTML as a link ensures the only layout shift will be the media itself (SSR -> Lexical)
  exportDOM (editor) {
    // if autolink, export as a link instead of media
    if (this.__autolink) {
      const link = document.createElement('a')
      link.setAttribute('href', this.__src)
      link.setAttribute('target', '_blank')
      link.setAttribute('rel', 'noopener nofollow noreferrer')
      link.textContent = this.__src
      return { element: link }
    }

    const element = document.createElement('span')
    const className = editor._config.theme?.mediaContainer
    if (className) element.className = className

    element.style.setProperty('--width', this.__width ? `${this.__width}px` : 'inherit')
    element.style.setProperty('--height', this.__height ? `${this.__height}px` : 'inherit')
    element.style.setProperty('--aspect-ratio', this.__width && this.__height ? `${this.__width} / ${this.__height}` : 'auto')
    element.style.setProperty('--max-width', `${this.__maxWidth}px`)

    const kind = $getState(this, kindState)
    const media = document.createElement(kind === 'video' ? 'video' : 'img')

    media.setAttribute('src', this.__src)
    if (this.__title) media.setAttribute('title', this.__title)
    if (this.__alt) media.setAttribute('alt', this.__alt)
    if (this.__width) media.setAttribute('width', String(this.__width))
    if (this.__height) media.setAttribute('height', String(this.__height))
    if (kind === 'video') media.setAttribute('controls', 'true')

    element.appendChild(media)
    return { element }
  }

  createDOM (config) {
    const span = document.createElement('span')
    const className = config.theme?.mediaContainer
    if (className) {
      span.className = className
    }
    span.style.setProperty('--max-width', `${this.__maxWidth}px`)
    return span
  }

  updateDOM () {
    return false
  }

  getSrc () {
    return this.__src
  }

  getAlt () {
    return this.__alt
  }

  getTitle () {
    return this.__title
  }

  getKind () {
    return $getState(this, kindState)
  }

  getStatus () {
    return $getState(this, statusState)
  }

  getWidthAndHeight () {
    return { width: this.__width, height: this.__height }
  }

  setKind (kind) {
    $setState(this, kindState, kind)
  }

  setStatus (status) {
    $setState(this, statusState, status)
  }

  isAutolink () {
    return this.__autolink
  }

  // shortcut for setting kind and status via media check
  applyCheckResult (kind) {
    $setState(this, kindState, kind)
    $setState(this, statusState, kind === 'unknown' ? 'error' : 'done')
  }

  decorate () {
    const MediaComponent = require('@/components/editor/nodes/media').default
    return (
      <MediaComponent
        src={this.__src}
        title={this.__title}
        alt={this.__alt}
        kind={$getState(this, kindState)}
        status={$getState(this, statusState)}
        width={this.__width}
        height={this.__height}
        maxWidth={this.__maxWidth}
        autolink={this.__autolink}
        nodeKey={this.getKey()}
      />
    )
  }
}

export function $createMediaNode ({ src, title, alt, width, height, maxWidth, autolink, key }) {
  return $applyNodeReplacement(
    new MediaNode(
      src,
      title,
      alt,
      width,
      height,
      maxWidth ? Math.min(maxWidth, 500) : Math.min(width ?? 320, 500),
      autolink,
      key
    )
  )
}

export function $isMediaNode (node) {
  return node instanceof MediaNode
}
