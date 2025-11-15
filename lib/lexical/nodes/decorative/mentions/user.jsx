import { DecoratorNode, $applyNodeReplacement } from 'lexical'

function $convertUserMentionElement (domNode) {
  const textContent = domNode.textContent
  const userMentionId = domNode.getAttribute('data-lexical-user-mention-id')
  const userMentionName = domNode.getAttribute('data-lexical-user-mention-name')

  if (textContent !== null) {
    const node = $createUserMentionNode(userMentionId, userMentionName || textContent)
    return { node }
  }

  return null
}

export class UserMentionNode extends DecoratorNode {
  __userMentionId
  __userMentionName

  static getType () {
    return 'user-mention'
  }

  getUserMentionId () {
    return this.__userMentionId
  }

  getUserMentionName () {
    return this.__userMentionName
  }

  static clone (node) {
    return new UserMentionNode(node.__userMentionId, node.__userMentionName, node.__key)
  }

  static importJSON (serializedNode) {
    return $createUserMentionNode(serializedNode.userMentionId, serializedNode.userMentionName)
  }

  constructor (userMentionId, userMentionName, key) {
    super(key)
    this.__userMentionId = userMentionId
    this.__userMentionName = userMentionName
  }

  exportJSON () {
    return {
      type: 'user-mention',
      version: 1,
      userMentionId: this.__userMentionId,
      userMentionName: this.__userMentionName
    }
  }

  createDOM (config) {
    const domNode = document.createElement('span')
    const theme = config.theme
    const className = theme.userMention
    if (className !== undefined) {
      domNode.className = className
    }
    domNode.setAttribute('data-lexical-user-mention', true)
    domNode.setAttribute('data-lexical-user-mention-id', this.__userMentionId)
    domNode.setAttribute('data-lexical-user-mention-name', this.__userMentionName)
    return domNode
  }

  // we need to find a way to allow display name changes
  exportDOM (editor) {
    const wrapper = document.createElement('span')
    wrapper.setAttribute('data-lexical-user-mention', true)
    const theme = editor._config.theme
    const className = theme.userMention
    if (className !== undefined) {
      wrapper.className = className
    }
    wrapper.setAttribute('data-lexical-user-mention-id', this.__userMentionId)
    wrapper.setAttribute('data-lexical-user-mention-name', this.__userMentionName)
    const a = document.createElement('a')
    const href = this.__userMentionId
      ? '/api/u/' + encodeURIComponent(this.__userMentionId.toString())
      : '/' + encodeURIComponent(this.__userMentionName.toString())
    a.setAttribute('href', href)
    a.textContent = '@' + this.__userMentionName
    wrapper.appendChild(a)
    return { element: wrapper }
  }

  static importDOM () {
    return {
      span: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-user-mention')) return null
        return { conversion: $convertUserMentionElement, priority: 1 }
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
    const id = this.__userMentionId
    const name = this.__userMentionName
    const href = id ? '/api/u/' + id : '/' + name
    return (
      <UserPopover id={id} name={name}>
        <Link href={href}>@{name}</Link>
      </UserPopover>
    )
  }
}

export function $createUserMentionNode (userMentionId, userMentionName) {
  return $applyNodeReplacement(new UserMentionNode(userMentionId, userMentionName))
}

export function $isUserMentionNode (node) {
  return node instanceof UserMentionNode
}
