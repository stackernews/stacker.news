import { TableCellNode } from '@lexical/table'
import { $applyNodeReplacement, isHTMLElement } from 'lexical'

export class SNTableCellNode extends TableCellNode {
  static getType () {
    return 'sn-tablecell'
  }

  static clone (node) {
    return new SNTableCellNode(node.__headerState, node.__colSpan, node.__width, node.__key)
  }

  static importDOM () {
    return TableCellNode.importDOM()
  }

  static importJSON (serializedNode) {
    return $createSNTableCellNode(serializedNode.headerState, serializedNode.colSpan, serializedNode.width)
      .updateFromJSON(serializedNode)
  }

  exportDOM (editor) {
    const output = super.exportDOM(editor)
    const { element } = output

    if (isHTMLElement(element)) {
      const width = this.getWidth()
      const verticalAlign = this.getVerticalAlign()
      const backgroundColor = this.getBackgroundColor()

      element.removeAttribute('style')

      if (width) {
        element.style.width = `${width}px`
      }
      if (verticalAlign) {
        element.style.verticalAlign = verticalAlign
      }
      if (backgroundColor) {
        element.style.backgroundColor = backgroundColor
      }
    }

    return output
  }
}

export function $createSNTableCellNode (headerState, colSpan, width) {
  return $applyNodeReplacement(new SNTableCellNode(headerState, colSpan, width))
}

export function $isSNTableCellNode (node) {
  return node instanceof SNTableCellNode
}
