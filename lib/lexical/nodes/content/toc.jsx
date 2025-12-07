import { DecoratorNode, $applyNodeReplacement } from 'lexical'
import { $extractHeadingsFromRoot, buildNestedTocStructure, buildHtmlFromStructure } from '@/lib/lexical/utils/toc'

function $convertTableOfContentsElement (domNode) {
  if (domNode.hasAttribute('data-lexical-toc')) {
    const node = $createTableOfContentsNode()
    return { node }
  }
  return null
}

export class TableOfContentsNode extends DecoratorNode {
  static getType () {
    return 'table-of-contents'
  }

  static clone (node) {
    return new TableOfContentsNode(node.__key)
  }

  static importJSON (serializedNode) {
    return $createTableOfContentsNode()
  }

  exportJSON () {
    return {
      type: 'table-of-contents',
      version: 1
    }
  }

  createDOM (config) {
    const domNode = document.createElement('div')
    domNode.setAttribute('data-lexical-toc', 'true')
    return domNode
  }

  exportDOM (editor) {
    return editor.getEditorState().read(() => {
      const div = document.createElement('div')
      div.setAttribute('data-lexical-toc', 'true')
      const details = document.createElement('details')
      details.setAttribute('class', 'sn-collapsible sn-toc')

      const summary = document.createElement('summary')
      summary.setAttribute('class', 'sn-collapsible__header')
      summary.textContent = 'table of contents'
      details.appendChild(summary)

      const headings = $extractHeadingsFromRoot()
      const structure = buildNestedTocStructure(headings)

      if (structure.length === 0) {
        const emptyDiv = document.createElement('div')
        emptyDiv.setAttribute('class', 'text-muted fst-italic')
        emptyDiv.textContent = 'No headings found'
        details.appendChild(emptyDiv)
        return { element: details }
      }

      const tocList = buildHtmlFromStructure(structure)
      details.appendChild(tocList)
      div.appendChild(details)
      return { element: div }
    })
  }

  static importDOM () {
    return {
      div: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-toc')) return null
        return { conversion: $convertTableOfContentsElement, priority: 1 }
      },
      details: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-toc')) return null
        return { conversion: $convertTableOfContentsElement, priority: 1 }
      },
      nav: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-toc')) return null
        return { conversion: $convertTableOfContentsElement, priority: 1 }
      }
    }
  }

  updateDOM () {
    return false
  }

  isInline () {
    return false
  }

  isSelectable () {
    return true
  }

  isIsolated () {
    return true
  }

  decorate (editor) {
    const { TableOfContents } = require('@/components/editor/plugins/content/toc')
    const headings = $extractHeadingsFromRoot()
    return <TableOfContents headings={headings} />
  }
}

export function $createTableOfContentsNode () {
  return $applyNodeReplacement(new TableOfContentsNode())
}

export function $isTableOfContentsNode (node) {
  return node instanceof TableOfContentsNode
}
