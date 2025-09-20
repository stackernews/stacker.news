import { DecoratorBlockNode } from '@lexical/react/LexicalDecoratorBlockNode'
import Embed from '@/components/embed'

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

  static getType () {
    return 'peertube'
  }

  static clone (node) {
    return new PeerTubeNode(node.__id, node.__meta, node.__format, node.__key)
  }

  static importJSON (serializedNode) {
    return $createPeerTubeNode(serializedNode.id, serializedNode.meta).updateFromJSON(serializedNode)
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
        if (!domNode.hasAttribute('data-lexical-peertube-id') || !domNode.hasAttribute('data-lexical-peertube-meta')) {
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
    const element = document.createElement('div')
    element.setAttribute('data-lexical-peertube-id', this.__id)
    element.setAttribute('data-lexical-peertube-meta', JSON.stringify(this.__meta))
    const text = document.createTextNode(this.getTextContent())
    element.append(text)
    return { element }
  }

  createDOM (config) {
    const domNode = super.createDOM(config)
    domNode.className = config.theme.peertubeContainer
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
    return this.__meta?.href
  }

  updateDOM (prevNode, domNode) {
    const prevId = prevNode.getId()
    const id = this.getId()
    if (prevId !== id) {
      domNode.setAttribute('data-lexical-peertube-id', id)
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
    return (
      <Embed id={this.__id} provider='peertube' className={className} meta={this.__meta} />
    )
  }
}

export function $createPeerTubeNode (id, meta) {
  return new PeerTubeNode(id, meta)
}

export function $isPeerTubeNode (node) {
  return node instanceof PeerTubeNode
}
