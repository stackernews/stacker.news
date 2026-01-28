import { DecoratorNode, $applyNodeReplacement } from 'lexical'
import { getStyleFromLexicalFormat } from '@/lib/lexical/nodes/utils'

function $convertItemMentionElement (domNode) {
  const id = domNode.getAttribute('data-lexical-item-mention-id')
  const text = domNode.querySelector('a')?.textContent
  const url = domNode.querySelector('a')?.getAttribute('href')
  const format = domNode.getAttribute('data-lexical-item-mention-format')

  if (id) {
    const node = $createItemMentionNode({ id, text, url, format })
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
  __format

  static getType () {
    return 'item-mention'
  }

  getFormat () {
    return this.__format
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
    return new ItemMentionNode(node.__itemMentionId, node.__text, node.__url, node.__format, node.__key)
  }

  static importJSON (serializedNode) {
    return $createItemMentionNode({ id: serializedNode.itemMentionId, text: serializedNode.text, url: serializedNode.url, format: serializedNode.format })
  }

  constructor (itemMentionId, text, url, format, key) {
    super(key)
    this.__itemMentionId = itemMentionId
    this.__text = text || `#${itemMentionId}`
    this.__url = url
    this.__format = format
  }

  exportJSON () {
    return {
      type: 'item-mention',
      version: 1,
      itemMentionId: this.__itemMentionId,
      text: this.__text,
      url: this.__url,
      format: this.__format
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
    domNode.setAttribute('data-lexical-item-mention-format', this.__format)
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
    wrapper.setAttribute('data-lexical-item-mention-format', this.__format)
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
    const style = getStyleFromLexicalFormat(this.__format)

    return (
      <ItemPopover id={id}>
        <Link href={href} style={style}>{text}</Link>
      </ItemPopover>
    )
  }
}

export function $createItemMentionNode ({ id, text, url, format }) {
  return $applyNodeReplacement(new ItemMentionNode(id, text, url, format))
}

export function $isItemMentionNode (node) {
  return node instanceof ItemMentionNode
}
