import { DecoratorBlockNode } from '@lexical/react/LexicalDecoratorBlockNode'
import { placeholderNode } from './placeholder'

function $convertYouTubeElement (domNode) {
  const id = domNode.getAttribute('data-lexical-youtube-id')
  const meta = domNode.getAttribute('data-lexical-youtube-meta')
  const src = domNode.getAttribute('data-lexical-youtube-src')
  if (!id) return null
  const node = $createYouTubeNode(id, meta, src)
  return { node }
}

export class YouTubeNode extends DecoratorBlockNode {
  __id
  __meta
  __src

  static getType () {
    return 'youtube'
  }

  static clone (node) {
    return new YouTubeNode(node.__id, node.__meta, node.__src, node.__format, node.__key)
  }

  static importJSON (serializedNode) {
    return $createYouTubeNode(serializedNode.id, serializedNode.meta, serializedNode.src).updateFromJSON(serializedNode)
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      id: this.getId(),
      meta: this.getMeta(),
      src: this.getSrc()
    }
  }

  static importDOM () {
    return {
      div: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-youtube-id')) {
          return null
        }
        return {
          conversion: $convertYouTubeElement,
          priority: 2
        }
      }
    }
  }

  // a good placeholder must be placed for all embeds
  exportDOM (config) {
    return { element: placeholderNode({ provider: 'youtube', id: this.__id, meta: this.__meta, src: this.__src }) }
  }

  createDOM (config) {
    const domNode = super.createDOM(config)
    domNode.className = config.theme.youtubeContainer
    return domNode
  }

  constructor (id, meta, src, format, key) {
    super(format, key)
    this.__id = id
    this.__meta = meta
    this.__src = src
  }

  getId () {
    return this.__id
  }

  getMeta () {
    return this.__meta
  }

  getSrc () {
    return this.__src
  }

  getTextContent (_includeInert, _includeDirectionless) {
    return this.__src
  }

  updateDOM (prevNode, domNode) {
    const prevId = prevNode.getId()
    const id = this.getId()
    if (prevId !== id) {
      domNode.setAttribute('data-lexical-youtube-id', id)
    }
    const prevSrc = prevNode.getSrc()
    const src = this.getSrc()
    if (prevSrc !== src) {
      domNode.setAttribute('data-lexical-youtube-src', src)
    }
    const prevMeta = prevNode.getMeta()
    const meta = this.getMeta()
    if (prevMeta !== meta) {
      domNode.setAttribute('data-lexical-youtube-meta', JSON.stringify(meta))
    }
    return true
  }

  decorate (editor, config) {
    const className = config.theme.youtubeEmbed || {}
    const Embed = require('@/components/embed').default
    return (
      <Embed id={this.__id} provider='youtube' className={className} meta={this.__meta} src={this.__src} />
    )
  }
}

export function $createYouTubeNode (id, meta, src) {
  return new YouTubeNode(id, meta, src)
}

export function $isYouTubeNode (node) {
  return node instanceof YouTubeNode
}
