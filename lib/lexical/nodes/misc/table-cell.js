import { TableCellNode } from '@lexical/table'
import { $applyNodeReplacement, isHTMLElement } from 'lexical'

/**
 * SNTableCellNode strips hardcoded inline styles from Lexical's exportDOM
 * so that SSR HTML matches the hydrated Lexical styling (via CSS classes).
 *
 * Without this, table cells flash with black borders and gray headers
 * before Lexical hydrates and applies theme classes.
 *
 * Fixes: https://github.com/stackernews/stacker.news/issues/2777
 */
export class SNTableCellNode extends TableCellNode {
  static getType () {
    return 'sn-tablecell'
  }

  static clone (node) {
    return new SNTableCellNode(
      node.__headerState,
      node.__colSpan,
      node.__width,
      node.__key
    )
  }

  static importJSON (serializedNode) {
    return $createSNTableCellNode(
      serializedNode.headerState,
      serializedNode.colSpan,
      serializedNode.width
    ).updateFromJSON(serializedNode)
  }

  exportDOM (editor) {
    const output = super.exportDOM(editor)
    if (isHTMLElement(output.element)) {
      const el = output.element
      // strip hardcoded inline styles that conflict with theme CSS classes:
      // - border: '1px solid black' → CSS uses var(--theme-borderColor)
      // - width: 'Xpx' → CSS uses min-width: 75px
      // - vertical-align, text-align → CSS handles these
      // - background-color: '#f2f3f5' for headers → CSS uses var(--theme-commentBg)
      // preserve any user-set custom background color
      const customBg = this.getBackgroundColor()
      el.removeAttribute('style')
      if (customBg) {
        el.style.backgroundColor = customBg
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
