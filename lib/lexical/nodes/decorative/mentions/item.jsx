import { DecoratorNode, $applyNodeReplacement } from 'lexical'
import { parseItemUrl } from '@/lib/url'
import {
  IS_BOLD,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_CODE,
  IS_HIGHLIGHT,
  IS_SUPERSCRIPT,
  IS_SUBSCRIPT,
  IS_UNDERLINE
} from '@/lib/lexical/mdast/format-constants'

function $convertItemMentionElement (domNode) {
  const id = domNode.getAttribute('data-lexical-item-mention-id')
  const text = domNode.getAttribute('data-lexical-item-mention-text') ?? domNode.querySelector('a')?.textContent
  const url = domNode.getAttribute('data-lexical-item-mention-url') ?? domNode.querySelector('a')?.getAttribute('href')
  const format = Number(domNode.getAttribute('data-lexical-item-mention-format')) || 0

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

  getDisplayText () {
    if (this.__text) return this.__text
    try {
      // derive the label straight from the url's path
      const { linkText } = parseItemUrl(new URL(this.__url))
      if (linkText) return linkText
    } catch {}
    return `#${this.__itemMentionId}`
  }

  static clone (node) {
    return new ItemMentionNode(node.__itemMentionId, node.__text, node.__url, node.__format, node.__key)
  }

  static importJSON (serializedNode) {
    return $createItemMentionNode({
      id: serializedNode.itemMentionId,
      text: serializedNode.text,
      url: serializedNode.url,
      format: serializedNode.format || 0
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
    const className = isCustomText(this.__text, this.__itemMentionId) ? theme.link : theme.itemMention
    if (className !== undefined) {
      domNode.className = className
    }
    domNode.setAttribute('data-lexical-item-mention', true)
    domNode.setAttribute('data-lexical-item-mention-id', this.__itemMentionId)
    if (this.__format) {
      domNode.setAttribute('data-lexical-item-mention-format', this.__format)
    }
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
    const className = isCustomText(this.__text, this.__itemMentionId) ? theme.link : theme.itemMention
    if (className !== undefined) {
      wrapper.className = className
    }
    wrapper.setAttribute('data-lexical-item-mention-id', this.__itemMentionId)
    if (this.__format) {
      wrapper.setAttribute('data-lexical-item-mention-format', this.__format)
    }
    const a = document.createElement('a')
    a.setAttribute('href', this.__url)
    let content = document.createTextNode(this.getDisplayText())
    const textTheme = theme?.text || {}
    const formatWrappers = [
      { flag: IS_CODE, tag: 'code' },
      { flag: IS_HIGHLIGHT, tag: 'mark', cls: textTheme.highlight },
      { flag: IS_STRIKETHROUGH, tag: 's', cls: textTheme.strikethrough },
      { flag: IS_BOLD, tag: 'strong', cls: textTheme.bold },
      { flag: IS_ITALIC, tag: 'em', cls: textTheme.italic },
      { flag: IS_UNDERLINE, tag: 'u', cls: textTheme.underline },
      { flag: IS_SUBSCRIPT, tag: 'sub', cls: textTheme.subscript },
      { flag: IS_SUPERSCRIPT, tag: 'sup', cls: textTheme.superscript }
    ]
    for (const { flag, tag, cls } of formatWrappers) {
      if (this.__format & flag) {
        const el = document.createElement(tag)
        if (cls) el.className = cls
        el.appendChild(content)
        content = el
      }
    }
    a.appendChild(content)
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
    return this.getDisplayText()
  }

  decorate () {
    const ItemPopover = require('@/components/item-popover').default
    const MentionsComponent = require('@/components/editor/nodes/mentions').default
    const id = this.__itemMentionId
    const href = this.__url
    const text = this.getDisplayText()
    const format = this.__format
    return (
      <ItemPopover id={id}>
        <MentionsComponent nodeKey={this.getKey()} href={href} text={text} format={format} />
      </ItemPopover>
    )
  }
}

export function $createItemMentionNode ({ id, text, url, format = 0 }) {
  return $applyNodeReplacement(new ItemMentionNode(id, text, url, format))
}

export function $isItemMentionNode (node) {
  return node instanceof ItemMentionNode
}
