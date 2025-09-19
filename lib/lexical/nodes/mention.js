// borrowed from Lexical Mentions Plugin, Copyright Meta Platforms, MIT License
// https://github.com/facebook/lexical/blob/main/packages/lexical-react/src/LexicalMentionsPlugin.tsx
// This is a placeholder to have an idea of a structure for mention nodes.
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
    return domNode
  }

  // we need to find a way to allow display name changes
  exportDOM (editor) {
    const element = document.createElement('a')
    element.setAttribute('data-lexical-mention', true)
    const theme = editor._config.theme
    const className = theme.mention
    if (className !== undefined) {
      element.className = className
    }
    element.setAttribute('data-lexical-mention-name', this.__mention)
    element.setAttribute('href', '/' + this.__mention)
    element.textContent = this.__mention
    return { element }
  }

  static importDOM () {
    return {
      a: (domNode) => {
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
