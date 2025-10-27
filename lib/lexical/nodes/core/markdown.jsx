import { CodeNode, $createCodeHighlightNode } from '@lexical/code'
import { $getRoot, $createLineBreakNode } from 'lexical'

// MarkdownNode is a special CodeNode that allows markdown mode with removal protection
// overrides CodeNode special cases, such as exiting the node after 2 line breaks
export class MarkdownNode extends CodeNode {
  // wip, breaks initial code highlighting
  static getType () {
    return 'markdown'
  }

  static clone (node) {
    return new MarkdownNode('markdown', node.__key)
  }

  bypassProtection () {
    this.getWritable().__bypassProtection = true
    return this
  }

  // don't remove/replace the node if it's the first one and protection is enabled
  // can be bypassed by calling bypassProtection() before removing
  _checkProtection () {
    const isFirst = $getRoot().getFirstChild()?.getKey() === this.getKey()
    if (isFirst && !this.__bypassProtection) {
      console.warn('you can\'t remove/replace the first markdown node without calling bypassProtection() first')
      return false
    }
    if (this.__bypassProtection) this.getWritable().__bypassProtection = false
    return true
  }

  remove (preserveEmptyParent) {
    if (!this._checkProtection()) return
    super.remove(preserveEmptyParent)
  }

  replace (replaceWith, includeChildren) {
    if (!this._checkProtection()) return
    super.replace(replaceWith, includeChildren)
    return this
  }

  createDOM (config) {
    const element = super.createDOM(config)
    element.className = config.theme.markdown
    return element
  }

  // BUG this is fragile, and needs to be addressed before review.
  insertNewAfter (selection, restoreSelection = true) {
    const children = this.getChildren()
    const len = children.length

    // usually if we are at the end of a block with two trailing newlines, lexical exits the node.
    // instead, we keep the caret inside by inserting another line break.
    if (
      len >= 2 &&
      children[len - 1].getTextContent() === '\n' &&
      children[len - 2].getTextContent() === '\n' &&
      selection.isCollapsed() &&
      selection.anchor.key === this.__key &&
      selection.anchor.offset === len
    ) {
      const br = $createLineBreakNode()
      const caret = $createCodeHighlightNode('')
      this.append(br)
      this.append(caret)
      caret.selectEnd()
      return this
    }

    // having done that, we can fall back to standard CodeNode behavior (handles indentation etc.)
    return super.insertNewAfter(selection, restoreSelection)
  }
}

export function $isMarkdownNode (node) {
  return node instanceof MarkdownNode
}

export function $createMarkdownNode () {
  return new MarkdownNode('markdown')
}
