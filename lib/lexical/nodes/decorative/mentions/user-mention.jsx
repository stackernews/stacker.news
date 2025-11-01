import { DecoratorNode, $applyNodeReplacement } from 'lexical'

function $convertMentionElement (domNode) {
  const textContent = domNode.textContent
  const mentionId = domNode.getAttribute('data-lexical-mention-id')
  const mentionName = domNode.getAttribute('data-lexical-mention-name')

  if (textContent !== null) {
    const node = $createMentionNode(mentionId, mentionName || textContent)
    return { node }
  }

  return null
}

export class MentionNode extends DecoratorNode {
  __mentionId
  __mentionName

  static getType () {
    return 'mention'
  }

  getMentionId () {
    return this.__mentionId
  }

  getMentionName () {
    return this.__mentionName
  }

  static clone (node) {
    return new MentionNode(node.__mentionId, node.__mentionName, node.__key)
  }

  static importJSON (serializedNode) {
    return $createMentionNode(serializedNode.mentionId, serializedNode.mentionName)
  }

  constructor (mentionId, mentionName, key) {
    super(key)
    this.__mentionId = mentionId
    this.__mentionName = mentionName
  }

  exportJSON () {
    return {
      type: 'mention',
      version: 1,
      mentionId: this.__mentionId,
      mentionName: this.__mentionName
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
    domNode.setAttribute('data-lexical-mention-id', this.__mentionId)
    domNode.setAttribute('data-lexical-mention-name', this.__mentionName)
    domNode.setAttribute('data-mention-text', '@' + this.__mentionName)
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
    wrapper.setAttribute('data-lexical-mention-id', this.__mentionId)
    wrapper.setAttribute('data-lexical-mention-name', this.__mentionName)
    const a = document.createElement('a')
    a.setAttribute('href', '/' + this.__mentionId)
    a.textContent = '@' + this.__mentionName
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
    const UserPopover = require('@/components/user-popover').default
    const Link = require('next/link').default
    const id = this.__mentionId
    const name = this.__mentionName
    const href = '/api/u/' + id
    return (
      <UserPopover id={id} name={name}>
        <Link href={href}>@{name}</Link>
      </UserPopover>
    )
  }
}

export function $createMentionNode (mentionId, mentionName) {
  return $applyNodeReplacement(new MentionNode(mentionId, mentionName))
}

export function $isMentionNode (node) {
  return node instanceof MentionNode
}
