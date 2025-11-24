import { $applyNodeReplacement, DecoratorNode, createState, $getState, $setState } from 'lexical'

// kind and status can change over time, so we need to store them in states
const kindState = createState('kind', {
  parse: (value) => (typeof value === 'string' ? value : 'unknown')
})

const statusState = createState('status', {
  parse: (value) => (typeof value === 'string' ? value : 'idle')
})

function $convertMediaElement (domNode) {
  if (domNode instanceof window.HTMLImageElement || domNode instanceof window.HTMLVideoElement) {
    const { alt: altText, src, width, height } = domNode
    const kind = domNode instanceof window.HTMLImageElement ? 'image' : 'video'
    const node = $createMediaNode({ altText, src, width, height })
    $setState(node, kindState, kind)
    $setState(node, statusState, 'done')
    return { node }
  }
  return null
}

export class MediaNode extends DecoratorNode {
  __src
  __altText
  __width
  __height
  __maxWidth

  $config () {
    return this.config('media', {
      extends: DecoratorNode,
      stateConfigs: [
        { flat: true, stateConfig: kindState },
        { flat: true, stateConfig: statusState }
      ]
    })
  }

  constructor (src, altText, width, height, maxWidth, key) {
    super(key)
    this.__src = src
    this.__altText = altText ?? ''
    this.__width = width ?? 0
    this.__height = height ?? 0
    this.__maxWidth = maxWidth ?? 500
  }

  static clone (node) {
    const clone = new MediaNode(
      node.__src,
      node.__altText,
      node.__width,
      node.__height,
      node.__maxWidth,
      node.__key
    )
    return clone
  }

  static importJSON (serializedNode) {
    const { src, altText, width, height, maxWidth, kind, status } = serializedNode
    const node = $createMediaNode({ src, altText, width, height, maxWidth })
    $setState(node, kindState, kind ?? 'unknown')
    $setState(node, statusState, status ?? 'idle')
    return node
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      src: this.__src,
      altText: this.__altText,
      width: this.__width,
      height: this.__height,
      maxWidth: this.__maxWidth,
      kind: $getState(this, kindState),
      status: $getState(this, statusState)
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
      })
    }
  }

  exportDOM (editor) {
    const element = document.createElement('span')
    const className = editor._config.theme?.mediaContainer
    if (className) {
      element.className = className
    }

    const style = {
      '--width': this.__width ? `${this.__width}px` : 'inherit',
      '--height': this.__height ? `${this.__height}px` : 'inherit',
      '--aspect-ratio': this.__width && this.__height ? `${this.__width} / ${this.__height}` : 'auto',
      '--max-width': `${this.__maxWidth}px`
    }
    element.setAttribute('style', Object.entries(style).map(([k, v]) => `${k}: ${v}`).join('; '))

    const kind = $getState(this, kindState)
    const media = document.createElement(kind === 'video' ? 'video' : 'img')
    media.setAttribute('src', this.__src)
    media.setAttribute('alt', this.__altText)
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

  getAltText () {
    return this.__altText
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

  // shortcut for setting kind and status via media check
  applyCheckResult (kind) {
    $setState(this, kindState, kind)
    $setState(this, statusState, kind === 'unknown' ? 'error' : 'done')
  }

  decorate () {
    const Media = require('@/components/editor/plugins/content/media').default
    return (
      <Media
        src={this.__src}
        altText={this.__altText}
        kind={$getState(this, kindState)}
        status={$getState(this, statusState)}
        width={this.__width}
        height={this.__height}
        maxWidth={this.__maxWidth}
        nodeKey={this.getKey()}
      />
    )
  }
}

export function $createMediaNode ({ src, altText, width, height, maxWidth, key }) {
  return $applyNodeReplacement(
    new MediaNode(
      src,
      altText,
      width,
      height,
      maxWidth ? Math.min(maxWidth, 500) : Math.min(width ?? 320, 500),
      key
    )
  )
}

export function $isMediaNode (node) {
  return node instanceof MediaNode
}
