import { DecoratorNode, $applyNodeReplacement } from 'lexical'
import { formatToClassName } from '@/lib/lexical/mdast/format'

const ITEM_MENTION_FORMAT_ATTRIBUTE = 'data-lexical-item-mention-format'

function $convertItemMentionElement (domNode) {
  const id = domNode.getAttribute('data-lexical-item-mention-id')
  const text = domNode.getAttribute('data-lexical-item-mention-text') ?? domNode.querySelector('a')?.textContent
  const url = domNode.getAttribute('data-lexical-item-mention-url') ?? domNode.querySelector('a')?.getAttribute('href')
  const format = Number(domNode.getAttribute(ITEM_MENTION_FORMAT_ATTRIBUTE)) || 0

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

  getItemMentionId () {
    return this.__itemMentionId
  }

  getText () {
    return this.__text
  }

  getURL () {
    return this.__url
  }

  getFormat () {
    return this.__format
  }

  static clone (node) {
    return new ItemMentionNode(node.__itemMentionId, node.__text, node.__url, node.__format, node.__key)
  }

  static importJSON (serializedNode) {
    return $createItemMentionNode({
      id: serializedNode.itemMentionId,
      text: serializedNode.text,
      url: serializedNode.url,
      format: serializedNode.format
    })
  }

  constructor (itemMentionId, text, url, format = 0, key) {
    super(key)
    this.__itemMentionId = itemMentionId
    this.__text = text
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
    const className = itemMentionClassName(theme, this.__text, this.__itemMentionId)
    if (className !== undefined) {
      domNode.className = className
    }
    domNode.setAttribute('data-lexical-item-mention', true)
    domNode.setAttribute('data-lexical-item-mention-id', this.__itemMentionId)
    domNode.setAttribute(ITEM_MENTION_FORMAT_ATTRIBUTE, this.__format)
    // text/url aren't derivable from id alone, so serialize them for hydration
    this.__text && domNode.setAttribute('data-lexical-item-mention-text', this.__text)
    this.__url && domNode.setAttribute('data-lexical-item-mention-url', this.__url)
    return domNode
  }

  // we need to find a way to allow display name changes
  exportDOM (editor) {
    const wrapper = document.createElement('span')
    wrapper.setAttribute('data-lexical-item-mention', true)
    const theme = editor._config.theme
    const className = formattedItemMentionClassName(theme, this.__text, this.__itemMentionId, this.__format)
    if (className !== undefined) {
      wrapper.className = className
    }
    wrapper.setAttribute('data-lexical-item-mention-id', this.__itemMentionId)
    wrapper.setAttribute(ITEM_MENTION_FORMAT_ATTRIBUTE, this.__format)
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
    const MentionsComponent = require('@/components/editor/nodes/mentions').default
    const id = this.__itemMentionId
    const href = this.__url
    const text = this.__text || `#${this.__itemMentionId}`
    return (
      <ItemPopover id={id}>
        <MentionsComponent nodeKey={this.getKey()} href={href} text={text} format={this.__format} />
      </ItemPopover>
    )
  }
}

function itemMentionClassName (theme, text, id) {
  return isCustomText(text, id) ? theme.link : theme.itemMention
}

function formattedItemMentionClassName (theme, text, id, format) {
  return [
    itemMentionClassName(theme, text, id),
    formatToClassName(format)
  ].filter(Boolean).join(' ')
}

export function $createItemMentionNode ({ id, text, url, format = 0 }) {
  return $applyNodeReplacement(new ItemMentionNode(id, text, url, format))
}

export function $isItemMentionNode (node) {
  return node instanceof ItemMentionNode
}
