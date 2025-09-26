import {
  $applyNodeReplacement,
  createEditor,
  DecoratorNode,
  LineBreakNode,
  ParagraphNode,
  RootNode,
  TextNode
} from 'lexical'
import { LinkNode } from '@lexical/link'

function $convertImageElement (domNode) {
  const img = domNode
  if (img instanceof window.HTMLImageElement) {
    const { alt: altText, src, width, height } = img
    const node = $createImageNode({ altText, src, width, height })
    return { node }
  }
  return null
}

export class ImageNode extends DecoratorNode {
  __src
  __altText
  __width = 'inherit'
  __height = 'inherit'
  __maxWidth
  __showCaption
  __caption
  __captionsEnabled

  static getType () {
    return 'image'
  }

  static clone (node) {
    return new ImageNode(
      node.__src,
      node.__altText,
      node.__width,
      node.__height,
      node.__maxWidth,
      node.__showCaption,
      node.__caption,
      node.__captionsEnabled,
      node.__key
    )
  }

  static importJSON (serializedNode) {
    const { altText, height, width, maxWidth, src, showCaption } = serializedNode
    const node = $createImageNode({ altText, height, width, maxWidth, src, showCaption }).updateFromJSON(serializedNode)
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
    const wrapper = document.createElement('span')
    const theme = editor._config.theme
    const className = theme.mediaContainer
    if (className !== undefined) {
      wrapper.className = className
    }
    const element = document.createElement('img')
    element.setAttribute('src', this.__src)
    element.setAttribute('alt', this.__altText)
    element.setAttribute('width', this.__width.toString())
    element.setAttribute('height', this.__height.toString())
    wrapper.appendChild(element)
    return { element: wrapper }
  }

  static importDOM () {
    return {
      img: (node) => ({
        conversion: $convertImageElement,
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
    captionsEnabled,
    key
  ) {
    super(key)
    this.__src = src
    this.__altText = altText
    this.__maxWidth = maxWidth
    this.__width = width || 'inherit'
    this.__height = height || 'inherit'
    this.__showCaption = showCaption || false
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
      width: this.__width === 'inherit' ? 0 : this.__width
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

  decorate () {
    const ImageComponent = require('./imageWithMediaHelper').default
    return (
      <ImageComponent
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

export function $createImageNode ({
  altText,
  height,
  maxWidth = 500,
  captionsEnabled,
  src,
  width,
  showCaption,
  caption,
  key
}) {
  return $applyNodeReplacement(
    new ImageNode(
      src,
      altText,
      maxWidth,
      width,
      height,
      showCaption,
      caption,
      captionsEnabled,
      key
    )
  )
}

export function $isImageNode (node) {
  return node instanceof ImageNode
}
