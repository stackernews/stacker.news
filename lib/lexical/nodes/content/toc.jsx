import { $applyNodeReplacement } from 'lexical'
import { DecoratorBlockNode } from '@lexical/react/LexicalDecoratorBlockNode'
import { $extractHeadingsFromRoot, buildNestedTocStructure, buildHtmlFromStructure } from '@/lib/lexical/utils/toc'
import { BlockWithAlignableContents } from '@lexical/react/LexicalBlockWithAlignableContents'
import { isServerRendering } from '@/lib/lexical/server/dom'

function $convertTableOfContentsElement (domNode) {
  if (domNode.hasAttribute('data-lexical-toc')) {
    const node = $createTableOfContentsNode()
    return { node }
  }
  return null
}

export class TableOfContentsNode extends DecoratorBlockNode {
  static getType () {
    return 'table-of-contents'
  }

  static clone (node) {
    return new TableOfContentsNode(node.__format, node.__key)
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

  createDOM (config, editor) {
    // the Lexical reconciler commits the full editor state before calling createDOM,
    // so we can read the headings here.
    if (isServerRendering()) {
      return this.exportDOM(editor).element
    }
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
        emptyDiv.textContent = 'no headings'
        details.appendChild(emptyDiv)
      } else {
        details.appendChild(buildHtmlFromStructure(structure))
      }

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

  decorate (_editor, config) {
    const { TableOfContents } = require('@/components/editor/nodes/toc')
    const headings = $extractHeadingsFromRoot()

    const className = {
      base: config.theme?.toc || '',
      focus: 'focused'
    }

    return (
      <BlockWithAlignableContents
        nodeKey={this.getKey()}
        className={className}
        format={this.__format}
      >
        <TableOfContents headings={headings} />
      </BlockWithAlignableContents>
    )
  }
}

export function $createTableOfContentsNode () {
  return $applyNodeReplacement(new TableOfContentsNode())
}

export function $isTableOfContentsNode (node) {
  return node instanceof TableOfContentsNode
}
