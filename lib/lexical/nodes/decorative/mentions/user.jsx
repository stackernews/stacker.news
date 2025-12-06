import { DecoratorNode, $applyNodeReplacement } from 'lexical'

function $convertUserMentionElement (domNode) {
  const textContent = domNode.textContent
  const userMentionName = domNode.getAttribute('data-lexical-user-mention-name')
  const path = domNode.getAttribute('data-lexical-user-mention-path')

  if (textContent !== null) {
    const node = $createUserMentionNode({ name: userMentionName || textContent, path })
    return { node }
  }

  return null
}

export class UserMentionNode extends DecoratorNode {
  __userMentionName
  __path

  static getType () {
    return 'user-mention'
  }

  getUserMentionName () {
    return this.__userMentionName
  }

  getPath () {
    return this.__path
  }

  static clone (node) {
    return new UserMentionNode(node.__userMentionName, node.__path, node.__key)
  }

  static importJSON (serializedNode) {
    return $createUserMentionNode({ name: serializedNode.userMentionName, path: serializedNode.path })
  }

  constructor (userMentionName, path, key) {
    super(key)
    this.__userMentionName = userMentionName
    this.__path = path
  }

  exportJSON () {
    return {
      type: 'user-mention',
      version: 1,
      userMentionName: this.__userMentionName,
      path: this.__path
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
    domNode.setAttribute('data-lexical-user-mention-name', this.__userMentionName)
    domNode.setAttribute('data-lexical-user-mention-path', this.__path)
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
    wrapper.setAttribute('data-lexical-user-mention-name', this.__userMentionName)
    wrapper.setAttribute('data-lexical-user-mention-path', this.__path)
    const a = document.createElement('a')
    const href = '/' + encodeURIComponent(this.__userMentionName.toString()) + this.__path.toString()
    a.setAttribute('href', href)
    const text = '@' + this.__userMentionName + this.__path
    a.textContent = text
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
    const name = this.__userMentionName
    const path = this.__path
    const href = '/' + encodeURIComponent(name.toString()) + path.toString()
    const text = '@' + name + path
    return (
      <UserPopover name={name}>
        <Link href={href}>{text}</Link>
      </UserPopover>
    )
  }
}

export function $createUserMentionNode ({ name, path }) {
  return $applyNodeReplacement(new UserMentionNode(name, path))
}

export function $isUserMentionNode (node) {
  return node instanceof UserMentionNode
}
