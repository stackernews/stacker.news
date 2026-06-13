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

/** writes user mention fields as data attributes so the node can be losslessly
 * reconstructed from HTML into Lexical (see $convertUserMentionElement) */
function setUserMentionHydrationAttributes (node, el) {
  el.setAttribute('data-lexical-user-mention', true)
  el.setAttribute('data-lexical-user-mention-name', node.getUserMentionName())
  el.setAttribute('data-lexical-user-mention-path', node.getPath())
}

export class UserMentionNode extends DecoratorNode {
  __userMentionName = ''
  __path = ''

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
    this.__path = path || ''
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
    setUserMentionHydrationAttributes(this, domNode)
    return domNode
  }

  // we need to find a way to allow display name changes
  exportDOM (editor) {
    const wrapper = document.createElement('span')
    const theme = editor._config.theme
    const className = theme.userMention
    if (className !== undefined) {
      wrapper.className = className
    }
    setUserMentionHydrationAttributes(this, wrapper)
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

  getTextContent () {
    return '@' + this.__userMentionName + this.__path
  }

  decorate () {
    const UserPopover = require('@/components/user-popover').default
    const MentionsComponent = require('@/components/editor/nodes/mentions').default
    const name = this.__userMentionName
    const path = this.__path
    const href = '/' + encodeURIComponent(name.toString()) + path?.toString()
    const text = '@' + name + path
    return (
      <UserPopover name={name}>
        <MentionsComponent nodeKey={this.getKey()} href={href} text={text} />
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
