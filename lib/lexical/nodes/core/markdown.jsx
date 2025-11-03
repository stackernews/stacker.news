import { CodeNode, $isCodeNode } from '@lexical/code'
import { $getRoot, $createLineBreakNode, $isTextNode, $isLineBreakNode } from 'lexical'

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

  // prevent exiting markdown mode by overriding insertNewAfter
  // just create a new line break node (like shift+enter)
  insertNewAfter (selection, _restoreSelection = true) {
    const { anchor } = selection
    const anchorNode = anchor.getNode()

    // case 1: caret is inside text inside this code block
    if ($isTextNode(anchorNode) || $isLineBreakNode(anchorNode)) {
      console.log('inserting line break in text node', anchorNode)
      const splitLeft = anchorNode.splitText(anchor.offset)[0]
      const insertIndex =
        splitLeft.getIndexWithinParent() + (anchor.offset === 0 ? 0 : 1)

      const parent = splitLeft.getParentOrThrow()
      parent.splice(insertIndex, 0, [$createLineBreakNode()])

      // move caret to after the break
      const after = splitLeft.getNextSibling()
      if (after != null) {
        after.selectNext(0, 0)
      }
      return null
    }

    // case 2: caret is directly in the CodeNode/MarkdownNode (rare)
    if ($isCodeNode(anchorNode) || $isMarkdownNode(anchorNode)) {
      console.log('inserting line break in code node', anchorNode)
      const { offset } = selection.anchor
      anchorNode.splice(offset, 0, [$createLineBreakNode()])
      anchorNode.select(offset + 1, offset + 1)
      return null
    }

    return null
  }
}

export function $isMarkdownNode (node) {
  return node instanceof MarkdownNode
}

export function $createMarkdownNode () {
  return new MarkdownNode('markdown')
}
