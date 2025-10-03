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
import { VIDEO_URL_REGEXP } from '@/lib/url'

function $convertMediaElement (domNode) {
  const media = domNode
  if (media instanceof window.HTMLImageElement || media instanceof window.HTMLVideoElement) {
    const { alt: altText, src, width, height } = media
    const node = $createMediaNode({ altText, src, width, height, captionText: media.getAttribute('caption') })
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

  static getType () {
    return 'media'
  }

  // we need to have a real way to determine if the link is an image or a video or a link
  getInnerType () {
    if (VIDEO_URL_REGEXP.test(this.__src)) {
      return 'video'
    }
    return 'image'
  }

  static clone (node) {
    return new MediaNode(
      node.__src,
      node.__altText,
      node.__width,
      node.__height,
      node.__maxWidth,
      node.__showCaption,
      node.__caption,
      node.__captionText,
      node.__captionsEnabled,
      node.__innerType,
      node.__key
    )
  }

  static importJSON (serializedNode) {
    const { altText, height, width, maxWidth, src, showCaption, innerType } = serializedNode
    const node = $createMediaNode({ altText, height, width, maxWidth, src, showCaption, innerType }).updateFromJSON(serializedNode)
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
    const media = document.createElement(this.getInnerType() === 'image' ? 'img' : 'video')
    media.setAttribute('src', this.__src)
    media.setAttribute('alt', this.__altText)
    media.setAttribute('width', this.__width.toString())
    media.setAttribute('height', this.__height.toString())
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
      innerType: this.__innerType
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

  decorate (editor) {
    const MediaComponent = require('./media').default
    return (
      <MediaComponent
        src={this.__src}
        altText={this.__altText}
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
  console.log('createMediaNode', altText, height, maxWidth, captionsEnabled, src, width, showCaption, caption, captionText, key)
  return $applyNodeReplacement(
    new MediaNode(
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
  )
}

export function $isMediaNode (node) {
  return node instanceof MediaNode
}
