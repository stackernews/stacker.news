import { DecoratorNode, $applyNodeReplacement } from 'lexical'
import { parseItemUrl } from '@/lib/url'
import {
  DEFAULT_FORMAT,
  IS_BOLD,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_HIGHLIGHT,
  IS_CODE
} from '@/lib/lexical/mdast/format-constants'

function $convertItemMentionElement (domNode) {
  const id = domNode.getAttribute('data-lexical-item-mention-id')
  const text = domNode.getAttribute('data-lexical-item-mention-text') ?? domNode.querySelector('a')?.textContent
  const url = domNode.getAttribute('data-lexical-item-mention-url') ?? domNode.querySelector('a')?.getAttribute('href')
  const format = Number(domNode.getAttribute('data-lexical-item-mention-format')) || DEFAULT_FORMAT

  if (id) {
    const node = $createItemMentionNode({ id, text, url, format })
    return { node }
  }

  return null
}

export function isCustomText (text, id) {
  return text && text !== `#${id}`
}

// item mention format wrappers, ordered inner -> outer like markdown (**_text_**)
export const ITEM_MENTION_FORMAT_WRAPPERS = [
  { flag: IS_ITALIC, tag: 'em', mdastType: 'emphasis' },
  { flag: IS_BOLD, tag: 'strong', mdastType: 'strong' },
  { flag: IS_STRIKETHROUGH, tag: 'del', mdastType: 'delete' },
  { flag: IS_HIGHLIGHT, tag: 'mark', mdastType: 'highlight' }
]

export function getFormatTags (format) {
  return ITEM_MENTION_FORMAT_WRAPPERS
    .filter(({ flag }) => format & flag)
    .map(({ tag }) => tag)
}

export function formatChildrenToMdast (text, format) {
  const children = format & IS_CODE
    ? [{ type: 'inlineCode', value: text }]
    : [{ type: 'text', value: text }]
  return ITEM_MENTION_FORMAT_WRAPPERS.reduce((acc, { flag, mdastType }) => (
    format & flag ? [{ type: mdastType, children: acc }] : acc
  ), children)
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
    return new ItemMentionNode(node.__itemMentionId, node.__text, node.__url, node.__key, node.__format)
  }

  static importJSON (serializedNode) {
    return $createItemMentionNode({
      id: serializedNode.itemMentionId,
      text: serializedNode.text,
      url: serializedNode.url,
      format: serializedNode.format
    })
  }

  constructor (itemMentionId, text, url, key, format = DEFAULT_FORMAT) {
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
    // text/url aren't derivable from id alone, so serialize them for hydration
    this.__text && domNode.setAttribute('data-lexical-item-mention-text', this.__text)
    this.__url && domNode.setAttribute('data-lexical-item-mention-url', this.__url)
    this.__format && domNode.setAttribute('data-lexical-item-mention-format', String(this.__format))
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
    const displayText = this.getDisplayText()
    if (this.__format) {
      // wrap the label in the format tags, inner -> outer
      let node = document.createTextNode(displayText)
      if (this.__format & IS_CODE) {
        const code = document.createElement('code')
        code.appendChild(node)
        node = code
      }
      for (const tag of getFormatTags(this.__format)) {
        const el = document.createElement(tag)
        el.appendChild(node)
        node = el
      }
      a.appendChild(node)
    } else {
      a.textContent = displayText
    }
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
    return (
      <ItemPopover id={id}>
        <MentionsComponent nodeKey={this.getKey()} href={href} text={text} format={this.__format} />
      </ItemPopover>
    )
  }
}

export function $createItemMentionNode ({ id, text, url, format }) {
  return $applyNodeReplacement(new ItemMentionNode(id, text, url, undefined, format))
}

export function $isItemMentionNode (node) {
  return node instanceof ItemMentionNode
}
