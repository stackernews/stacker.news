import { $applyNodeReplacement, DecoratorNode, createState, $getState, $setState } from 'lexical'

// kind and status can change over time, so we need to store them in states
const kindState = createState('kind', {
  parse: (value) => (typeof value === 'string' ? value : 'unknown')
})

const statusState = createState('status', {
  parse: (value) => (typeof value === 'string' ? value : 'idle')
})

const widthState = createState('width', {
  parse: (value) => (typeof value === 'number' ? value : 0)
})

const heightState = createState('height', {
  parse: (value) => (typeof value === 'number' ? value : 0)
})

const srcSetState = createState('srcSet', {
  parse: (value) => (typeof value === 'string' ? value : null)
})

const bestResSrcState = createState('bestResSrc', {
  parse: (value) => (typeof value === 'string' ? value : null)
})

function $convertMediaElement (domNode) {
  let src, alt, title, width, height, kind, autolink, srcSet, bestResSrc

  if (domNode instanceof window.HTMLImageElement || domNode instanceof window.HTMLVideoElement) {
    ({ alt, title, src, width, height, srcSet, bestResSrc } = domNode)
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

  const node = $createMediaNode({ src, alt, title, width, height, autolink, srcSet, bestResSrc })
  $setState(node, kindState, kind)
  $setState(node, statusState, 'done')
  return { node }
}

export class MediaNode extends DecoratorNode {
  __src
  __title
  __alt
  __maxWidth
  __autolink

  $config () {
    return this.config('media', {
      extends: DecoratorNode,
      stateConfigs: [
        { flat: true, stateConfig: kindState },
        { flat: true, stateConfig: statusState },
        { flat: true, stateConfig: srcSetState },
        { flat: true, stateConfig: bestResSrcState },
        { flat: true, stateConfig: widthState },
        { flat: true, stateConfig: heightState }
      ]
    })
  }

  constructor (src, title, alt, maxWidth, autolink, key) {
    super(key)
    this.__src = src
    this.__title = title ?? ''
    this.__alt = alt ?? ''
    this.__maxWidth = maxWidth ?? 500
    this.__autolink = autolink ?? false
  }

  static clone (node) {
    const clone = new MediaNode(
      node.__src,
      node.__title,
      node.__alt,
      node.__maxWidth,
      node.__autolink,
      node.__key
    )
    return clone
  }

  static importJSON (serializedNode) {
    const { src, srcSet, bestResSrc, title, alt, width, height, maxWidth, kind, status, autolink } = serializedNode
    const node = $createMediaNode({ src, title, alt, width, height, maxWidth, autolink })
    $setState(node, kindState, kind ?? 'unknown')
    $setState(node, statusState, status ?? 'idle')
    $setState(node, srcSetState, srcSet ?? null)
    $setState(node, bestResSrcState, bestResSrc ?? null)
    $setState(node, widthState, width ?? 0)
    $setState(node, heightState, height ?? 0)
    return node
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      src: this.__src,
      srcSet: $getState(this, srcSetState),
      bestResSrc: $getState(this, bestResSrcState),
      title: this.__title,
      alt: this.__alt,
      width: $getState(this, widthState),
      height: $getState(this, heightState),
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
    const kind = $getState(this, kindState)
    if (kind === 'unknown' || this.__autolink) {
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

    const width = $getState(this, widthState)
    const height = $getState(this, heightState)

    element.style.setProperty('--width', width ? `${width}px` : 'inherit')
    element.style.setProperty('--height', height ? `${height}px` : 'inherit')
    element.style.setProperty('--max-width', `${this.__maxWidth}px`)

    const media = document.createElement(kind === 'video' ? 'video' : 'img')

    media.setAttribute('src', this.__src)
    const srcSet = $getState(this, srcSetState)
    const bestResSrc = $getState(this, bestResSrcState)
    if (srcSet) {
      media.setAttribute('srcset', srcSet)
      media.setAttribute('sizes', '66vw')
    }
    if (bestResSrc && kind === 'video') {
      media.setAttribute('poster', bestResSrc !== this.__src ? bestResSrc : undefined)
      media.setAttribute('preload', bestResSrc !== this.__src ? 'metadata' : undefined)
    }
    if (this.__title) media.setAttribute('title', this.__title)
    if (this.__alt) media.setAttribute('alt', this.__alt)
    if (width) media.setAttribute('width', String(width))
    if (height) media.setAttribute('height', String(height))
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

    const { width, height } = this.getWidthAndHeight()
    if (width) {
      span.style.setProperty('--width', `${width}px`)
    }
    if (height) {
      span.style.setProperty('--height', `${height}px`)
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

  getSrcSet () {
    return $getState(this, srcSetState)
  }

  getBestResSrc () {
    return $getState(this, bestResSrcState)
  }

  setBestResSrc (bestResSrc) {
    $setState(this, bestResSrcState, bestResSrc ?? null)
  }

  setSrcSet (srcSet) {
    $setState(this, srcSetState, srcSet ?? null)
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
    return { width: $getState(this, widthState), height: $getState(this, heightState) }
  }

  setWidthAndHeight (width, height) {
    $setState(this, widthState, width)
    $setState(this, heightState, height)
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
        srcSet={$getState(this, srcSetState)}
        bestResSrc={$getState(this, bestResSrcState)}
        title={this.__title}
        alt={this.__alt}
        kind={$getState(this, kindState)}
        status={$getState(this, statusState)}
        width={$getState(this, widthState)}
        height={$getState(this, heightState)}
        maxWidth={this.__maxWidth}
        autolink={this.__autolink}
        nodeKey={this.getKey()}
      />
    )
  }
}

export function $createMediaNode ({ src, title, alt, width, height, maxWidth, autolink, key, srcSet, bestResSrc }) {
  const node = new MediaNode(
    src,
    title,
    alt,
    maxWidth ? Math.min(maxWidth, 500) : Math.min(width ?? 320, 500),
    autolink,
    key
  )
  if (width && height) {
    node.setWidthAndHeight(width, height)
  }
  if (srcSet) {
    node.setSrcSet(srcSet)
  }
  // if imgproxy didn't return a bestResSrc, use the original src
  // this is to ensure the media is displayed even if imgproxy is not available
  node.setBestResSrc(bestResSrc ?? src)
  return $applyNodeReplacement(node)
}

export function $isMediaNode (node) {
  return node instanceof MediaNode
}
