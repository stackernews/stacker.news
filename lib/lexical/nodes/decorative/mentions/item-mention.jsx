import { DecoratorNode, $applyNodeReplacement } from 'lexical'

function $convertItemMentionElement (domNode) {
  const textContent = domNode.textContent
  const itemMentionId = domNode.getAttribute('data-lexical-item-mention-id')

  if (textContent !== null) {
    const node = $createItemMentionNode(itemMentionId || textContent, textContent)
    return { node }
  }

  return null
}

export class ItemMentionNode extends DecoratorNode {
  __itemMentionId

  static getType () {
    return 'itemMention'
  }

  getItemMentionId () {
    return this.__itemMentionId
  }

  static clone (node) {
    return new ItemMentionNode(node.__itemMentionId, node.__key)
  }

  static importJSON (serializedNode) {
    return $createItemMentionNode(serializedNode.itemMentionId)
  }

  constructor (itemMentionId, key) {
    super(key)
    this.__itemMentionId = itemMentionId
  }

  exportJSON () {
    return {
      type: 'itemMention',
      version: 1,
      itemMentionId: this.__itemMentionId
    }
  }

  createDOM (config) {
    const domNode = document.createElement('span')
    const theme = config.theme
    const className = theme.itemMention
    if (className !== undefined) {
      domNode.className = className
    }
    domNode.setAttribute('data-lexical-item-mention', true)
    domNode.setAttribute('data-lexical-item-mention-id', this.__itemMentionId)
    domNode.setAttribute('data-item-mention-text', '#' + this.__itemMentionId)
    return domNode
  }

  // we need to find a way to allow display name changes
  exportDOM (editor) {
    const wrapper = document.createElement('span')
    wrapper.setAttribute('data-lexical-item-mention', true)
    const theme = editor._config.theme
    const className = theme.itemMention
    if (className !== undefined) {
      wrapper.className = className
    }
    wrapper.setAttribute('data-lexical-item-mention-id', this.__itemMentionId)
    const a = document.createElement('a')
    a.setAttribute('href', '/items/' + this.__itemMentionId)
    a.textContent = '#' + this.__itemMentionId
    wrapper.appendChild(a)
    return { element: wrapper }
  }

  static importDOM () {
    return {
      span: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-item-mention')) return null
        return { conversion: $convertItemMentionElement, priority: 1 }
      }
    }
  }

  isInline () {
    return true
  }

  updateDOM () {
    return false
  }

  decorate () {
    const ItemPopover = require('@/components/item-popover').default
    const Link = require('next/link').default
    const id = this.__itemMentionId
    const href = '/items/' + id
    return (
      <ItemPopover id={id}>
        <Link href={href}>#{id}</Link>
      </ItemPopover>
    )
  }
}

export function $createItemMentionNode (itemMentionId) {
  return $applyNodeReplacement(new ItemMentionNode(itemMentionId))
}

export function $isItemMentionNode (node) {
  return node instanceof ItemMentionNode
}
