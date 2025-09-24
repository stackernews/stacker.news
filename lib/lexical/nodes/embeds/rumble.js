import { DecoratorBlockNode } from '@lexical/react/LexicalDecoratorBlockNode'
import Embed from '@/components/embed'
import { placeholderNode } from './placeholder'

function $convertRumbleElement (domNode) {
  const id = domNode.getAttribute('data-lexical-rumble-id')
  const meta = domNode.getAttribute('data-lexical-rumble-meta')
  if (!id) return null
  const node = $createRumbleNode(id, meta)
  return { node }
}

export class RumbleNode extends DecoratorBlockNode {
  __id
  __meta

  static getType () {
    return 'rumble'
  }

  static clone (node) {
    return new RumbleNode(node.__id, node.__meta, node.__format, node.__key)
  }

  static importJSON (serializedNode) {
    return $createRumbleNode(serializedNode.id, serializedNode.meta).updateFromJSON(serializedNode)
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
        if (!domNode.hasAttribute('data-lexical-rumble-id') || !domNode.hasAttribute('data-lexical-rumble-meta')) {
          return null
        }
        return {
          conversion: $convertRumbleElement,
          priority: 2
        }
      }
    }
  }

  exportDOM () {
    return { element: placeholderNode({ provider: 'rumble', id: this.__id, meta: this.__meta }) }
  }

  createDOM (config) {
    const domNode = super.createDOM(config)
    domNode.className = config.theme.rumbleContainer
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
      domNode.setAttribute('data-lexical-rumble-id', id)
    }
    const prevMeta = prevNode.getMeta()
    const meta = this.getMeta()
    if (prevMeta !== meta) {
      domNode.setAttribute('data-lexical-rumble-meta', JSON.stringify(meta))
    }
    return true
  }

  decorate (editor, config) {
    const className = config.theme.rumbleEmbed || {}
    return (
      <Embed id={this.__id} provider='rumble' className={className} meta={this.__meta} />
    )
  }
}

export function $createRumbleNode (id, meta) {
  return new RumbleNode(id, meta)
}

export function $isRumbleNode (node) {
  return node instanceof RumbleNode
}
