import { DecoratorBlockNode } from '@lexical/react/LexicalDecoratorBlockNode'
import { placeholderNode } from './placeholder'

function $convertNostrElement (domNode) {
  const id = domNode.getAttribute('data-lexical-nostr-id')
  const src = domNode.getAttribute('data-lexical-embed-src')
  if (!id) return null
  const node = $createNostrNode(id, src)
  return { node }
}

export class NostrNode extends DecoratorBlockNode {
  __id
  __src

  static getType () {
    return 'nostr'
  }

  static clone (node) {
    return new NostrNode(node.__id, node.__src, node.__format, node.__key)
  }

  static importJSON (serializedNode) {
    return $createNostrNode(serializedNode.id, serializedNode.src).updateFromJSON(serializedNode)
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      id: this.getId() ?? '',
      src: this.getSrc()
    }
  }

  static importDOM () {
    return {
      div: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-nostr-id')) {
          return null
        }
        return {
          conversion: $convertNostrElement,
          priority: 2
        }
      }
    }
  }

  exportDOM () {
    return { element: placeholderNode({ provider: 'nostr', id: this.__id, src: this.__src }) }
  }

  createDOM (config) {
    const domNode = super.createDOM(config)
    domNode.className = config.theme.nostrContainer
    return domNode
  }

  constructor (id, src, format, key) {
    super(format, key)
    this.__id = id
    this.__src = src
  }

  getId () {
    return this.__id ?? ''
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
      domNode.setAttribute('data-lexical-nostr-id', id)
    }
    const prevSrc = prevNode.getSrc()
    const src = this.getSrc()
    if (prevSrc !== src) {
      domNode.setAttribute('data-lexical-embed-src', src)
    }
    return true
  }

  decorate (editor, config) {
    const className = config.theme.nostrEmbed || {}
    const topLevel = config.theme.topLevel || false
    const Embed = require('@/components/embed').default
    return (
      <Embed id={this.__id} provider='nostr' className={className} topLevel={topLevel} src={this.__src} />
    )
  }
}

export function $createNostrNode (id, src) {
  return new NostrNode(id, src)
}

export function $isNostrNode (node) {
  return node instanceof NostrNode
}
