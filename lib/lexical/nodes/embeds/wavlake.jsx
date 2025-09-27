import { DecoratorBlockNode } from '@lexical/react/LexicalDecoratorBlockNode'
import { placeholderNode } from './placeholder'

function $convertWavlakeElement (domNode) {
  const id = domNode.getAttribute('data-lexical-wavlake-id')
  const src = domNode.getAttribute('data-lexical-wavlake-src')
  if (!id) return null
  const node = $createWavlakeNode(id, src)
  return { node }
}

export class WavlakeNode extends DecoratorBlockNode {
  __id
  __src

  static getType () {
    return 'wavlake'
  }

  static clone (node) {
    return new WavlakeNode(node.__id, node.__src, node.__format, node.__key)
  }

  static importJSON (serializedNode) {
    return $createWavlakeNode(serializedNode.id, serializedNode.src).updateFromJSON(serializedNode)
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      id: this.getId(),
      src: this.getSrc()
    }
  }

  static importDOM () {
    return {
      div: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-wavlake-id') || !domNode.hasAttribute('data-lexical-wavlake-src')) {
          return null
        }
        return {
          conversion: $convertWavlakeElement,
          priority: 2
        }
      }
    }
  }

  exportDOM () {
    return { element: placeholderNode({ provider: 'wavlake', id: this.__id, src: this.__src }) }
  }

  createDOM (config) {
    const domNode = super.createDOM(config)
    domNode.className = config.theme.wavlakeContainer
    return domNode
  }

  constructor (id, src, format, key) {
    super(format, key)
    this.__id = id
    this.__src = src
  }

  getId () {
    return this.__id
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
      domNode.setAttribute('data-lexical-wavlake-id', id)
    }
    const prevSrc = prevNode.getSrc()
    const src = this.getSrc()
    if (prevSrc !== src) {
      domNode.setAttribute('data-lexical-wavlake-src', src)
    }
    return true
  }

  decorate (editor, config) {
    const className = config.theme.wavlakeEmbed || {}
    const Embed = require('@/components/embed').default
    return (
      <Embed id={this.__id} provider='wavlake' className={className} src={this.__src} />
    )
  }
}

export function $createWavlakeNode (id, src) {
  return new WavlakeNode(id, src)
}

export function $isWavlakeNode (node) {
  return node instanceof WavlakeNode
}
