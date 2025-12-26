import { DecoratorNode, $applyNodeReplacement } from 'lexical'

function $convertItemMentionElement (domNode) {
  const id = domNode.getAttribute('data-lexical-item-mention-id')
  const text = domNode.querySelector('a')?.textContent
  const url = domNode.querySelector('a')?.getAttribute('href')

  if (id) {
    const node = $createItemMentionNode({ id, text, url })
    return { node }
  }

  return null
}

export function isCustomText (text, id) {
  return text && text !== `#${id}`
}

export class ItemMentionNode extends DecoratorNode {
  __itemMentionId
  __text
  __url

  static getType () {
    return 'item-mention'
  }

  getItemMentionId () {
    return this.__itemMentionId
  }

  getText () {
    return this.__text
  }

  getURL () {
    return this.__url
  }

  static clone (node) {
    return new ItemMentionNode(node.__itemMentionId, node.__text, node.__url, node.__key)
  }

  static importJSON (serializedNode) {
    return $createItemMentionNode({ id: serializedNode.itemMentionId, text: serializedNode.text, url: serializedNode.url })
  }

  constructor (itemMentionId, text, url, key) {
    super(key)
    this.__itemMentionId = itemMentionId
    this.__text = text || `#${itemMentionId}`
    this.__url = url
  }

  exportJSON () {
    return {
      type: 'item-mention',
      version: 1,
      itemMentionId: this.__itemMentionId,
      text: this.__text,
      url: this.__url
    }
  }

  createDOM (config) {
    const domNode = document.createElement('span')
    const theme = config.theme
    const className = isCustomText(this.__text, this.__itemMentionId) ? theme.link : theme.itemMention
    if (className !== undefined) {
      domNode.className = className
    }
    domNode.setAttribute('data-lexical-item-mention', true)
    domNode.setAttribute('data-lexical-item-mention-id', this.__itemMentionId)
    return domNode
  }

  // we need to find a way to allow display name changes
  exportDOM (editor) {
    const wrapper = document.createElement('span')
    wrapper.setAttribute('data-lexical-item-mention', true)
    const theme = editor._config.theme
    const className = isCustomText(this.__text, this.__itemMentionId) ? theme.link : theme.itemMention
    if (className !== undefined) {
      wrapper.className = className
    }
    wrapper.setAttribute('data-lexical-item-mention-id', this.__itemMentionId)
    const a = document.createElement('a')
    a.setAttribute('href', this.__url)
    a.textContent = this.__text || `#${this.__itemMentionId}`
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

  getTextContent () {
    return this.__text || `#${this.__itemMentionId}`
  }

  decorate () {
    const ItemPopover = require('@/components/item-popover').default
    const Link = require('next/link').default
    const id = this.__itemMentionId
    const href = this.__url
    const text = this.__text || `#${this.__itemMentionId}`
    return (
      <ItemPopover id={id}>
        <Link href={href}>{text}</Link>
      </ItemPopover>
    )
  }
}

export function $createItemMentionNode ({ id, text, url }) {
  return $applyNodeReplacement(new ItemMentionNode(id, text, url))
}

export function $isItemMentionNode (node) {
  return node instanceof ItemMentionNode
}
