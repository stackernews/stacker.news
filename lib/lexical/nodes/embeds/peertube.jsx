import { DecoratorBlockNode } from '@lexical/react/LexicalDecoratorBlockNode'
import { placeholderNode } from './placeholder'

function $convertPeerTubeElement (domNode) {
  const id = domNode.getAttribute('data-lexical-peertube-id')
  const meta = domNode.getAttribute('data-lexical-peertube-meta')
  if (!id) return null
  const node = $createPeerTubeNode(id, meta)
  return { node }
}

export class PeerTubeNode extends DecoratorBlockNode {
  __id
  __meta
  __src

  static getType () {
    return 'peertube'
  }

  static clone (node) {
    return new PeerTubeNode(node.__id, node.__meta, node.__src, node.__format, node.__key)
  }

  static importJSON (serializedNode) {
    return $createPeerTubeNode(serializedNode.id, serializedNode.meta, serializedNode.src).updateFromJSON(serializedNode)
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
        if (!domNode.hasAttribute('data-lexical-peertube-id') || !domNode.hasAttribute('data-lexical-peertube-meta') || !domNode.hasAttribute('data-lexical-peertube-src')) {
          return null
        }
        return {
          conversion: $convertPeerTubeElement,
          priority: 2
        }
      }
    }
  }

  exportDOM () {
    return { element: placeholderNode({ provider: 'peertube', id: this.__id, meta: this.__meta, src: this.__src }) }
  }

  createDOM (config) {
    const domNode = super.createDOM(config)
    domNode.className = config.theme.peertubeContainer
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
    return this.__meta?.href
  }

  updateDOM (prevNode, domNode) {
    const prevId = prevNode.getId()
    const id = this.getId()
    if (prevId !== id) {
      domNode.setAttribute('data-lexical-peertube-id', id)
    }
    const prevSrc = prevNode.getSrc()
    const src = this.getSrc()
    if (prevSrc !== src) {
      domNode.setAttribute('data-lexical-peertube-src', src)
    }
    const prevMeta = prevNode.getMeta()
    const meta = this.getMeta()
    if (prevMeta !== meta) {
      domNode.setAttribute('data-lexical-peertube-meta', JSON.stringify(meta))
    }
    return true
  }

  decorate (editor, config) {
    const className = config.theme.peertubeEmbed || {}
    const Embed = require('@/components/embed').default
    return (
      <Embed id={this.__id} provider='peertube' className={className} meta={this.__meta} src={this.__src} />
    )
  }
}

export function $createPeerTubeNode (id, meta, src) {
  return new PeerTubeNode(id, meta, src)
}

export function $isPeerTubeNode (node) {
  return node instanceof PeerTubeNode
}
