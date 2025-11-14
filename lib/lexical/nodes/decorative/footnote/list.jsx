import { ElementNode, $applyNodeReplacement } from 'lexical'

export class FootnoteListNode extends ElementNode {
  static getType () {
    return 'footnote-list'
  }

  static clone (node) {
    return new FootnoteListNode(node.__key)
  }

  static importJSON (serializedNode) {
    return $createFootnoteListNode()
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      type: 'footnote-list',
      version: 1
    }
  }

  createDOM (config) {
    const ol = document.createElement('ol')
    ol.className = 'footnotes-list'
    return ol
  }

  updateDOM () {
    return false
  }

  isInline () {
    return false
  }

  canBeEmpty () {
    return false
  }
}

export function $createFootnoteListNode () {
  return $applyNodeReplacement(new FootnoteListNode())
}

export function $isFootnoteListNode (node) {
  return node instanceof FootnoteListNode
}
