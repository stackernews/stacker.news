import { DecoratorBlockNode } from '@lexical/react/LexicalDecoratorBlockNode'
import Embed from '@/components/embed'
import { placeholderNode } from './placeholder'

function $convertYouTubeElement (domNode) {
  const id = domNode.getAttribute('data-lexical-youtube-id')
  const meta = domNode.getAttribute('data-lexical-youtube-meta')
  if (!id) return null
  const node = $createYouTubeNode(id, meta)
  return { node }
}

export class YouTubeNode extends DecoratorBlockNode {
  __id
  __meta

  static getType () {
    return 'youtube'
  }

  static clone (node) {
    return new YouTubeNode(node.__id, node.__meta, node.__format, node.__key)
  }

  static importJSON (serializedNode) {
    return $createYouTubeNode(serializedNode.id, serializedNode.meta).updateFromJSON(serializedNode)
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      id: this.getId(),
      meta: this.getMeta()
    }
  }

  static importDOM () {
    return {
      div: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-youtube-id') || !domNode.hasAttribute('data-lexical-youtube-meta')) {
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
    return placeholderNode('youtube', this.__id, this.__meta)
  }

  createDOM (config) {
    const domNode = super.createDOM(config)
    domNode.className = config.theme.youtubeContainer
    return domNode
  }

  constructor (id, meta, format, key) {
    super(format, key)
    this.__id = id
    this.__meta = meta
  }

  getId () {
    return this.__id
  }

  getMeta () {
    return this.__meta
  }

  getTextContent (_includeInert, _includeDirectionless) {
    return `https://www.youtube.com/watch?v=${this.__id}&s=${this.__meta?.start || 0}`
  }

  updateDOM (prevNode, domNode) {
    const prevId = prevNode.getId()
    const id = this.getId()
    if (prevId !== id) {
      domNode.setAttribute('data-lexical-youtube-id', id)
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
    return (
      <Embed id={this.__id} provider='youtube' className={className} meta={this.__meta} />
    )
  }
}

export function $createYouTubeNode (id, meta) {
  return new YouTubeNode(id, meta)
}

export function $isYouTubeNode (node) {
  return node instanceof YouTubeNode
}
