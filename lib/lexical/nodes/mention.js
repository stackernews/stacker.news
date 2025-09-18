// borrowed from Lexical Mentions Plugin, Copyright Meta Platforms, MIT License
// https://github.com/facebook/lexical/blob/main/packages/lexical-react/src/LexicalMentionsPlugin.tsx
// This is a placeholder to have an idea of a structure for mention nodes.
import { TextNode, $applyNodeReplacement } from 'lexical'

function $convertMentionElement (domNode) {
  const textContent = domNode.textContent
  const mentionName = domNode.getAttribute('data-lexical-mention-name')

  if (textContent !== null) {
    const node = $createMentionNode({ name: mentionName || textContent, text: textContent })
    return { node }
  }

  return null
}

export class MentionNode extends TextNode {
  __mention

  static getType () {
    return 'mention'
  }

  static clone (node) {
    return new MentionNode(node.__mention, node.__text, node.__key)
  }

  static importJSON (serializedNode) {
    return $createMentionNode(serializedNode.mentionName).updateFromJSON(serializedNode)
  }

  constructor (mentionName, text, key) {
    super(text ?? mentionName, key)
    this.__mention = mentionName
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      mentionName: this.__mention
    }
  }

  createDOM (config) {
    const domNode = super.createDOM(config)
    domNode.className = 'mention'
    return domNode
  }

  exportDOM () {
    const element = document.createElement('span')
    element.setAttribute('data-lexical-mention', true)
    if (this.__text !== this.__mention) {
      element.setAttribute('data-lexical-mention-name', this.__mention)
    }
    element.textContent = this.__text
    return { element }
  }

  static importDOM () {
    return {
      span: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-mention')) return null
        return { conversion: $convertMentionElement, priority: 1 }
      }
    }
  }

  isTextEntity () {
    return true
  }

  canInsertTextBefore () {
    return false
  }

  canInsertTextAfter () {
    return false
  }
}

export function $createMentionNode ({ mentionName, textContent }) {
  const node = new MentionNode(mentionName, (textContent = mentionName))
  MentionNode.setMode('segmented').toggleDirectionless()
  return $applyNodeReplacement(node)
}

export function $isMentionNode (node) {
  return node instanceof MentionNode
}
