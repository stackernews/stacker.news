import { DecoratorBlockNode } from '@lexical/react/LexicalDecoratorBlockNode'
import Embed from '@/components/embed'

function $convertWavlakeElement (domNode) {
  const id = domNode.getAttribute('data-lexical-wavlake-id')
  if (!id) return null
  const node = $createWavlakeNode(id)
  return { node }
}

export class WavlakeNode extends DecoratorBlockNode {
  __id

  static getType () {
    return 'wavlake'
  }

  static clone (node) {
    return new WavlakeNode(node.__id, node.__format, node.__key)
  }

  static importJSON (serializedNode) {
    return $createWavlakeNode(serializedNode.id).updateFromJSON(serializedNode)
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      id: this.getId()
    }
  }

  static importDOM () {
    return {
      div: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-wavlake-id')) {
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
    const element = document.createElement('div')
    element.setAttribute('data-lexical-wavlake-id', this.__id)
    const text = document.createTextNode(this.getTextContent())
    element.append(text)
    return { element }
  }

  createDOM (config) {
    const domNode = super.createDOM(config)
    domNode.className = config.theme.wavlakeContainer
    return domNode
  }

  constructor (id, format, key) {
    super(format, key)
    this.__id = id
  }

  getId () {
    return this.__id
  }

  getTextContent (_includeInert, _includeDirectionless) {
    return `https://embed.wavlake.com/track/${this.__id}`
  }

  updateDOM (prevNode, domNode) {
    const prevId = prevNode.getId()
    const id = this.getId()
    if (prevId !== id) {
      domNode.setAttribute('data-lexical-wavlake-id', id)
    }
    return true
  }

  decorate (editor, config) {
    const className = config.theme.wavlakeEmbed || {}
    return (
      <Embed id={this.__id} provider='wavlake' className={className} />
    )
  }
}

export function $createWavlakeNode (id) {
  return new WavlakeNode(id)
}

export function $isWavlakeNode (node) {
  return node instanceof WavlakeNode
}
