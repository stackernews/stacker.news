import { DecoratorNode, $applyNodeReplacement } from 'lexical'
import classNames from 'classnames'
import {
  DEFAULT_FORMAT,
  IS_BOLD,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_HIGHLIGHT,
  IS_SUPERSCRIPT,
  IS_SUBSCRIPT,
  IS_UNDERLINE
} from '@/lib/lexical/mdast/format-constants'

const DEFAULT_TEXT_THEME = {
  bold: 'sn-text__bold',
  italic: 'sn-text__italic',
  highlight: 'sn-text__highlight',
  underline: 'sn-text__underline',
  strikethrough: 'sn-text__strikethrough',
  underlineStrikethrough: 'sn-text__underline-strikethrough',
  superscript: 'sn-text__superscript',
  subscript: 'sn-text__subscript'
}

function $convertItemMentionElement (domNode) {
  const id = domNode.getAttribute('data-lexical-item-mention-id')
  const text = domNode.querySelector('a')?.textContent
  const url = domNode.querySelector('a')?.getAttribute('href')
  const format = getTextFormatFromClassName(domNode)

  if (id) {
    const node = $createItemMentionNode({ id, text, url, format })
    return { node }
  }

  return null
}

export function isCustomText (text, id) {
  return text && text !== `#${id}`
}

function textClass (theme, key) {
  return theme?.[key] || DEFAULT_TEXT_THEME[key]
}

function hasTextClass (domNode, key) {
  return domNode.classList.contains(DEFAULT_TEXT_THEME[key])
}

function getTextFormatFromClassName (domNode) {
  let format = DEFAULT_FORMAT

  if (hasTextClass(domNode, 'bold')) format |= IS_BOLD
  if (hasTextClass(domNode, 'italic')) format |= IS_ITALIC
  if (hasTextClass(domNode, 'highlight')) format |= IS_HIGHLIGHT
  if (hasTextClass(domNode, 'superscript')) format |= IS_SUPERSCRIPT
  if (hasTextClass(domNode, 'subscript')) format |= IS_SUBSCRIPT

  if (hasTextClass(domNode, 'underlineStrikethrough')) {
    format |= IS_UNDERLINE | IS_STRIKETHROUGH
  } else {
    if (hasTextClass(domNode, 'underline')) format |= IS_UNDERLINE
    if (hasTextClass(domNode, 'strikethrough')) format |= IS_STRIKETHROUGH
  }

  return format
}

export function getTextFormatClassName (format = DEFAULT_FORMAT, theme) {
  const underlined = format & IS_UNDERLINE
  const struck = format & IS_STRIKETHROUGH

  return classNames({
    [textClass(theme, 'bold')]: format & IS_BOLD,
    [textClass(theme, 'italic')]: format & IS_ITALIC,
    [textClass(theme, 'highlight')]: format & IS_HIGHLIGHT,
    [textClass(theme, 'underline')]: underlined && !struck,
    [textClass(theme, 'strikethrough')]: struck && !underlined,
    [textClass(theme, 'underlineStrikethrough')]: underlined && struck,
    [textClass(theme, 'superscript')]: format & IS_SUPERSCRIPT,
    [textClass(theme, 'subscript')]: format & IS_SUBSCRIPT
  })
}

function getItemMentionClassName (theme, text, id, format) {
  return classNames(
    isCustomText(text, id) ? theme?.link : theme?.itemMention,
    getTextFormatClassName(format, theme?.text)
  )
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
      format: serializedNode.format ?? DEFAULT_FORMAT
    })
  }

  constructor (itemMentionId, text, url, format = DEFAULT_FORMAT, key) {
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
    const className = getItemMentionClassName(theme, this.__text, this.__itemMentionId, this.__format)
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
    const className = getItemMentionClassName(theme, this.__text, this.__itemMentionId, this.__format)
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

  decorate (_editor, config) {
    const ItemPopover = require('@/components/item-popover').default
    const MentionsComponent = require('@/components/editor/nodes/mentions').default
    const id = this.__itemMentionId
    const href = this.__url
    const text = this.__text || `#${this.__itemMentionId}`
    const className = getItemMentionClassName(config?.theme, this.__text, this.__itemMentionId, this.__format)
    return (
      <ItemPopover id={id}>
        <MentionsComponent nodeKey={this.getKey()} href={href} text={text} className={className} />
      </ItemPopover>
    )
  }
}

export function $createItemMentionNode ({ id, text, url, format = DEFAULT_FORMAT }) {
  return $applyNodeReplacement(new ItemMentionNode(id, text, url, format))
}

export function $isItemMentionNode (node) {
  return node instanceof ItemMentionNode
}
