import { ElementNode, $applyNodeReplacement } from 'lexical'

function $convertFootnoteReferenceElement (domNode) {
  const footnoteId = domNode.getAttribute('data-lexical-footnote-id')

  if (footnoteId !== null) {
    const node = $createFootnoteReferenceNode(footnoteId)
    return { node }
  }

  return null
}

export class FootnoteReferenceNode extends ElementNode {
  __footnoteId

  static getType () {
    return 'footnote-reference'
  }

  getFootnoteId () {
    return this.__footnoteId
  }

  static clone (node) {
    return new FootnoteReferenceNode(node.__footnoteId, node.__key)
  }

  static importJSON (serializedNode) {
    return $createFootnoteReferenceNode(serializedNode.footnoteId)
  }

  constructor (footnoteId, key) {
    super(key)
    this.__footnoteId = footnoteId
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      type: 'footnote-reference',
      version: 1,
      footnoteId: this.__footnoteId
    }
  }

  createDOM (config, editor) {
    const domNode = document.createElement('a')
    const theme = config.theme
    const className = theme.footnoteReference
    if (className !== undefined) {
      domNode.className = className
    }
    domNode.setAttribute('data-lexical-footnote-reference', true)
    domNode.setAttribute('data-lexical-footnote-id', this.__footnoteId)
    domNode.setAttribute('id', `fnref-${this.__footnoteId}`)
    domNode.setAttribute('href', `#fn-${this.__footnoteId}`)
    return domNode
  }

  exportDOM (editor) {
    const domNode = document.createElement('a')
    const theme = editor._config.theme
    const className = theme.footnoteReference
    if (className !== undefined) {
      domNode.className = className
    }
    domNode.setAttribute('data-lexical-footnote-reference', true)
    domNode.setAttribute('data-lexical-footnote-id', this.__footnoteId)
    domNode.setAttribute('id', `fnref-${this.__footnoteId}`)
    domNode.setAttribute('href', `#fn-${this.__footnoteId}`)
    return { element: domNode }
  }

  static importDOM () {
    return {
      sup: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-footnote-reference')) return null
        return { conversion: $convertFootnoteReferenceElement, priority: 1 }
      }
    }
  }

  isInline () {
    return true
  }

  isTextEntity () {
    return true
  }

  updateDOM () {
    return false
  }

  canBeEmpty () {
    return false
  }
}

export function $createFootnoteReferenceNode (footnoteId) {
  return $applyNodeReplacement(new FootnoteReferenceNode(footnoteId))
}

export function $isFootnoteReferenceNode (node) {
  return node instanceof FootnoteReferenceNode
}
