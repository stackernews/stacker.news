import { DecoratorBlockNode } from '@lexical/react/LexicalDecoratorBlockNode'
import Embed from '@/components/embed'
import { placeholderNode } from './placeholder'

function $convertNostrElement (domNode) {
  const src = domNode.getAttribute('data-lexical-nostr-src')
  if (!src) return null
  const node = $createNostrNode(src)
  return { node }
}

export class NostrNode extends DecoratorBlockNode {
  __src

  static getType () {
    return 'nostr'
  }

  static clone (node) {
    return new NostrNode(node.__src, node.__format, node.__key)
  }

  static importJSON (serializedNode) {
    return $createNostrNode(serializedNode.src).updateFromJSON(serializedNode)
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      src: this.getSrc()
    }
  }

  static importDOM () {
    return {
      div: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-nostr-src')) {
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
    return { element: placeholderNode({ provider: 'nostr', src: this.__src }) }
  }

  createDOM (config) {
    const domNode = super.createDOM(config)
    domNode.className = config.theme.nostrContainer
    return domNode
  }

  constructor (src, format, key) {
    super(format, key)
    this.__src = src
  }

  getSrc () {
    return this.__src
  }

  getTextContent (_includeInert, _includeDirectionless) {
    return `https://njump.me/${this.__src}`
  }

  updateDOM (prevNode, domNode) {
    const prevSrc = prevNode.getSrc()
    const src = this.getSrc()
    if (prevSrc !== src) {
      domNode.setAttribute('data-lexical-nostr-src', src)
    }
    return true
  }

  decorate (editor, config) {
    const className = config.theme.nostrEmbed || {}
    const topLevel = config.theme.topLevel || false
    return (
      <Embed src={this.__src} provider='nostr' className={className} topLevel={topLevel} />
    )
  }
}

export function $createNostrNode (src) {
  return new NostrNode(src)
}

export function $isNostrNode (node) {
  return node instanceof NostrNode
}
