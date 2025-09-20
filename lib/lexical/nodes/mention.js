import { DecoratorNode, $applyNodeReplacement } from 'lexical'
import UserPopover from '@/components/user-popover'
import Link from 'next/link'

function $convertMentionElement (domNode) {
  const textContent = domNode.textContent
  const mentionName = domNode.getAttribute('data-lexical-mention-name')

  if (textContent !== null) {
    const node = $createMentionNode(mentionName || textContent, textContent)
    return { node }
  }

  return null
}

export class MentionNode extends DecoratorNode {
  __mention

  static getType () {
    return 'mention'
  }

  getMentionName () {
    return this.__mention
  }

  static clone (node) {
    return new MentionNode(node.__mention, node.__key)
  }

  static importJSON (serializedNode) {
    return $createMentionNode(serializedNode.mentionName)
  }

  constructor (mentionName, key) {
    super(key)
    this.__mention = mentionName
  }

  exportJSON () {
    return {
      type: 'mention',
      version: 1,
      mentionName: this.__mention
    }
  }

  createDOM (config) {
    const domNode = document.createElement('span')
    const theme = config.theme
    const className = theme.mention
    if (className !== undefined) {
      domNode.className = className
    }
    domNode.setAttribute('data-lexical-mention', true)
    domNode.setAttribute('data-lexical-mention-name', this.__mention)
    domNode.setAttribute('data-mention-text', '@' + this.__mention)
    return domNode
  }

  // we need to find a way to allow display name changes
  exportDOM (editor) {
    const wrapper = document.createElement('span')
    wrapper.setAttribute('data-lexical-mention', true)
    const theme = editor._config.theme
    const className = theme.mention
    if (className !== undefined) {
      wrapper.className = className
    }
    wrapper.setAttribute('data-lexical-mention-name', this.__mention)
    const a = document.createElement('a')
    a.setAttribute('href', '/' + this.__mention)
    a.textContent = '@' + this.__mention
    wrapper.appendChild(a)
    return { element: wrapper }
  }

  static importDOM () {
    return {
      span: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-mention')) return null
        return { conversion: $convertMentionElement, priority: 1 }
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
    const name = this.__mention
    const href = '/' + name
    return (
      <UserPopover name={name}>
        <Link href={href}>@{name}</Link>
      </UserPopover>
    )
  }
}

export function $createMentionNode (mentionName) {
  return $applyNodeReplacement(new MentionNode(mentionName))
}

export function $isMentionNode (node) {
  return node instanceof MentionNode
}
