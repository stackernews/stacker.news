import { ElementNode, $applyNodeReplacement } from 'lexical'

function sectionDOM (config) {
  const ol = document.createElement('ol')
  ol.setAttribute('data-lexical-footnotes-section', 'true')
  const theme = config.theme
  const className = theme.footnotesSection
  if (className !== undefined) {
    ol.className = className
  }
  return ol
}

function $convertFootnotesSectionElement (domNode) {
  if (domNode.hasAttribute('data-lexical-footnotes-section')) {
    return { node: $createFootnotesSectionNode() }
  }
  return null
}

export class FootnotesSectionNode extends ElementNode {
  static getType () {
    return 'footnotes-section'
  }

  static clone (node) {
    return new FootnotesSectionNode(node.__key)
  }

  static importJSON (serializedNode) {
    return $createFootnotesSectionNode().updateFromJSON(serializedNode)
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      type: 'footnotes-section',
      version: 1
    }
  }

  createDOM (config) {
    return sectionDOM(config)
  }

  updateDOM () {
    return false
  }

  exportDOM (editor) {
    return { element: sectionDOM(editor._config) }
  }

  static importDOM () {
    return {
      ol: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-footnotes-section')) return null
        return { conversion: $convertFootnotesSectionElement, priority: 1 }
      }
    }
  }

  isInline () {
    return false
  }
}

export function $createFootnotesSectionNode () {
  return $applyNodeReplacement(new FootnotesSectionNode())
}

export function $isFootnotesSectionNode (node) {
  return node instanceof FootnotesSectionNode
}
