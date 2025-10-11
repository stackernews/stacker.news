import { CodeNode } from '@lexical/code'
import { $getRoot } from 'lexical'

// MarkdownNode is a special CodeNode that allows markdown mode with removal protection
export class MarkdownNode extends CodeNode {
  static getType () {
    return 'sn-markdown'
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
}

export function $isMarkdownNode (node) {
  return node instanceof MarkdownNode
}

export function $createMarkdownNode () {
  return new MarkdownNode('markdown')
}
