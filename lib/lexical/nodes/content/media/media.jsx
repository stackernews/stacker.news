import {
  $applyNodeReplacement,
  createEditor,
  DecoratorNode,
  LineBreakNode,
  ParagraphNode,
  RootNode,
  TextNode,
  $getRoot,
  $createParagraphNode,
  $createTextNode
} from 'lexical'
import { LinkNode } from '@lexical/link'

function $convertMediaElement (domNode) {
  const media = domNode
  if (media instanceof window.HTMLImageElement || media instanceof window.HTMLVideoElement) {
    const { alt: altText, src, width, height } = media
    const kind = domNode instanceof window.HTMLImageElement ? 'image' : 'video'
    const node = $createMediaNode({ altText, src, width, height, captionText: media.getAttribute('caption') })
    node.setKind(kind)
    node.setStatus('done')
    return { node }
  }
  return null
}

export class MediaNode extends DecoratorNode {
  __src
  __altText
  __width = 'inherit'
  __height = 'inherit'
  __maxWidth
  __showCaption
  __caption
  __captionsEnabled
  __kind = 'unknown' // 'unknown', 'image', 'video'
  __status = 'idle' // 'idle', 'pending', 'done', 'error'

  static getType () {
    return 'media'
  }

  getKind () {
    return this.__kind
  }

  static clone (node) {
    const clone = new MediaNode(
      node.__src,
      node.__altText,
      node.__width,
      node.__height,
      node.__maxWidth,
      node.__showCaption,
      node.__caption,
      node.getCaptionText?.(),
      node.__captionsEnabled,
      node.__innerType,
      node.__key
    )
    clone.__kind = node.__kind
    clone.__status = node.__status
    return clone
  }

  static importJSON (serializedNode) {
    const { altText, height, width, maxWidth, src, showCaption, innerType, kind = 'unknown', status = 'idle' } = serializedNode
    const node = $createMediaNode({ altText, height, width, maxWidth, src, showCaption, innerType }).updateFromJSON(serializedNode)
    node.__kind = kind
    node.__status = status
    return node
  }

  updateFromJSON (serializedNode) {
    const node = super.updateFromJSON(serializedNode)
    const { caption } = serializedNode

    const nestedEditor = node.__caption
    const editorState = nestedEditor.parseEditorState(caption.editorState)
    if (!editorState.isEmpty()) {
      nestedEditor.setEditorState(editorState)
    }

    return node
  }

  exportDOM (editor) {
    const element = document.createElement('span')
    const theme = editor._config.theme
    const className = theme.mediaContainer
    if (className !== undefined) {
      element.className = className
    }
    const style = {
      '--height': this.__height === 'inherit' ? this.__height : `${this.__height}px`,
      '--width': this.__width === 'inherit' ? this.__width : `${this.__width}px`,
      '--aspect-ratio': `${this.__width} / ${this.__height}`,
      ...(this.__maxWidth && { '--max-width': `${this.__maxWidth}px` })
    }
    element.setAttribute('style', Object.entries(style).map(([key, value]) => `${key}: ${value}`).join('; '))
    const k = this.getKind()
    const media = document.createElement(k === 'image' ? 'img' : 'video')
    media.setAttribute('src', this.__src)
    media.setAttribute('alt', this.__altText)
    media.setAttribute('width', this.__width.toString())
    media.setAttribute('height', this.__height.toString())
    if (k === 'video') {
      media.setAttribute('controls', 'true')
    }
    element.appendChild(media)
    return { element }
  }

  static importDOM () {
    return {
      img: (node) => ({
        conversion: $convertMediaElement,
        priority: 0
      }),
      video: (node) => ({
        conversion: $convertMediaElement,
        priority: 0
      })
    }
  }

  constructor (
    src,
    altText,
    maxWidth,
    width,
    height,
    showCaption,
    caption,
    captionText,
    captionsEnabled,
    innerType,
    key
  ) {
    super(key)
    this.__src = src
    this.__altText = altText
    this.__maxWidth = maxWidth
    this.__width = width || 'inherit'
    this.__height = height || 'inherit'
    this.__showCaption = showCaption || false
    this.__innerType = innerType
    this.__caption =
      caption ||
      createEditor({
        namespace: 'snImageCaption',
        nodes: [
          RootNode,
          TextNode,
          LineBreakNode,
          ParagraphNode,
          LinkNode
        ]
      })

    // populate caption text if captionText is provided via ![](src "caption")
    if (captionText && !caption) {
      this.__caption.update(() => {
        const root = $getRoot()
        const paragraph = $createParagraphNode()
        paragraph.append($createTextNode(captionText))
        root.append(paragraph)
      })
    }

    this.__captionsEnabled = captionsEnabled || captionsEnabled === undefined
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      altText: this.getAltText(),
      caption: this.__caption.toJSON(),
      height: this.__height === 'inherit' ? 0 : this.__height,
      maxWidth: this.__maxWidth,
      showCaption: this.__showCaption,
      src: this.getSrc(),
      width: this.__width === 'inherit' ? 0 : this.__width,
      innerType: this.__innerType,
      kind: this.__kind,
      status: this.__status
    }
  }

  setWidthAndHeight (width = 'inherit', height = 'inherit') {
    const writable = this.getWritable()
    writable.__width = width
    writable.__height = height
  }

  setShowCaption (showCaption) {
    const writable = this.getWritable()
    writable.__showCaption = showCaption
  }

  createDOM (config) {
    const span = document.createElement('span')
    const theme = config.theme
    const className = theme.mediaContainer
    if (className !== undefined) {
      span.className = className
    }
    return span
  }

  updateDOM () {
    return false
  }

  getSrc () {
    return this.__src
  }

  setSrc (src) {
    const writable = this.getWritable()
    writable.__src = src
    writable.__kind = 'unknown'
    writable.__status = 'idle'
  }

  getAltText () {
    return this.__altText
  }

  getShowCaption () {
    return this.__showCaption
  }

  getCaptionText () {
    let text = ''
    const nestedEditor = this.__caption
    const state = nestedEditor.getEditorState()
    state.read(() => {
      text = $getRoot().getTextContent()
    })
    return text
  }

  setCaptionText (text) {
    const writable = this.getWritable()
    const nestedEditor = writable.__caption
    nestedEditor.update(() => {
      const root = $getRoot()
      root.clear()
      const paragraph = $createParagraphNode()
      paragraph.append($createTextNode(text))
      root.append(paragraph)
    })
  }

  getStatus () {
    return this.__status
  }

  setStatus (status) {
    this.getWritable().__status = status
  }

  setKind (kind) {
    this.getWritable().__kind = kind
  }

  // this is how we apply the result of the media check to the node
  applyCheckResult (kind) {
    const writable = this.getWritable()
    writable.__kind = kind
    writable.__status = kind === 'unknown' ? 'error' : 'done'
  }

  decorate (editor) {
    const MediaComponent = require('./media-component').default
    return (
      <MediaComponent
        src={this.__src}
        altText={this.__altText}
        kind={this.__kind}
        width={this.__width}
        height={this.__height}
        maxWidth={this.__maxWidth}
        nodeKey={this.getKey()}
        showCaption={this.__showCaption}
        caption={this.__caption}
        captionsEnabled={this.__captionsEnabled}
        resizable
      />
    )
  }
}

export function $createMediaNode ({
  altText,
  height,
  maxWidth = 500,
  captionsEnabled,
  src,
  width,
  showCaption,
  caption,
  captionText,
  key
}) {
  const node = new MediaNode(
    src,
    altText,
    maxWidth,
    width,
    height,
    showCaption,
    caption,
    captionText,
    captionsEnabled,
    key
  )
  node.__kind = 'unknown'
  node.__status = 'idle'
  return $applyNodeReplacement(node)
}

export function $isMediaNode (node) {
  return node instanceof MediaNode
}
