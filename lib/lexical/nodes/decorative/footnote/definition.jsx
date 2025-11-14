import { ElementNode, $applyNodeReplacement } from 'lexical'

export class FootnoteDefinitionNode extends ElementNode {
  __footnoteId

  static getType () {
    return 'footnote-definition'
  }

  getFootnoteId () {
    return this.getLatest().__footnoteId
  }

  static clone (node) {
    return new FootnoteDefinitionNode(node.__footnoteId, node.__key)
  }

  static importJSON (serializedNode) {
    return $createFootnoteDefinitionNode(serializedNode.footnoteId)
  }

  constructor (footnoteId, key) {
    super(key)
    this.__footnoteId = footnoteId
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      type: 'footnote-definition',
      version: 1,
      footnoteId: this.__footnoteId
    }
  }

  createDOM (config) {
    const li = document.createElement('li')
    li.className = 'footnote-definition'
    li.setAttribute('data-lexical-footnote-definition', true)
    li.setAttribute('data-lexical-footnote-definition-id', this.__footnoteId)
    li.setAttribute('id', `fn-${this.__footnoteId}`)
    return li
  }

  updateDOM () {
    return false
  }

  exportDOM () {
    return { element: null }
  }

  isInline () {
    return false
  }

  canIndent () {
    return false
  }

  exportTextContent () {
    return `[^${this.__footnoteId}]: ${super.exportTextContent()}`
  }
}

export function $createFootnoteDefinitionNode (footnoteId) {
  return $applyNodeReplacement(new FootnoteDefinitionNode(footnoteId))
}

export function $isFootnoteDefinitionNode (node) {
  return node instanceof FootnoteDefinitionNode
}
