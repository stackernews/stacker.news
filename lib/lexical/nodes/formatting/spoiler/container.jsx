import { IS_CHROME } from '@lexical/utils'
import {
  $getSiblingCaret,
  $isElementNode,
  $rewindSiblingCaret,
  ElementNode,
  isHTMLElement,
  $applyNodeReplacement
} from 'lexical'

import { setDomHiddenUntilFound } from './utils'

export function $convertDetailsElement (domNode) {
  const isOpen = domNode.open !== undefined ? domNode.open : true
  const node = $createSpoilerContainerNode({ isOpen })
  return {
    node
  }
}

// from lexical, TODO: re-examine
export class SpoilerContainerNode extends ElementNode {
  __open

  constructor (open, key) {
    super(key)
    this.__open = open
  }

  static getType () {
    return 'spoiler-container'
  }

  static clone (node) {
    return new SpoilerContainerNode(node.__open, node.__key)
  }

  isShadowRoot () {
    return true
  }

  collapseAtStart (selection) {
    // Unwrap the SpoilerContainerNode by replacing it with the children
    // of its children (SpoilerTitleNode, SpoilerContentNode)
    const nodesToInsert = []
    for (const child of this.getChildren()) {
      if ($isElementNode(child)) {
        nodesToInsert.push(...child.getChildren())
      }
    }
    const caret = $rewindSiblingCaret($getSiblingCaret(this, 'previous'))
    caret.splice(1, nodesToInsert)
    // Merge the first child of the SpoilerTitleNode with the
    // previous sibling of the SpoilerContainerNode
    const [firstChild] = nodesToInsert
    if (firstChild) {
      firstChild.selectStart().deleteCharacter(true)
    }
    return true
  }

  createDOM (config, editor) {
    // details is not well supported in Chrome #5582
    let dom
    if (IS_CHROME) {
      dom = document.createElement('div')
      dom.setAttribute('open', '')
    } else {
      const detailsDom = document.createElement('details')
      detailsDom.open = this.__open
      detailsDom.addEventListener('toggle', () => {
        const open = editor.getEditorState().read(() => this.getOpen())
        if (open !== detailsDom.open) {
          editor.update(() => this.toggleOpen())
        }
      })
      dom = detailsDom
    }
    dom.classList.add('sn__collapsible', 'sn__spoiler__container')

    return dom
  }

  updateDOM (prevNode, dom) {
    const currentOpen = this.__open
    if (prevNode.__open !== currentOpen) {
      // details is not well supported in Chrome #5582
      if (IS_CHROME) {
        const contentDom = dom.children[1]
        if (!isHTMLElement(contentDom)) {
          throw new Error('Expected contentDom to be an HTMLElement')
        }
        if (currentOpen) {
          dom.setAttribute('open', '')
          contentDom.hidden = false
        } else {
          dom.removeAttribute('open')
          setDomHiddenUntilFound(contentDom)
        }
      } else {
        dom.open = this.__open
      }
    }

    return false
  }

  static importDOM () {
    return {
      details: (domNode) => {
        return {
          conversion: $convertDetailsElement,
          priority: 1
        }
      }
    }
  }

  static importJSON (serializedNode) {
    return $createSpoilerContainerNode({ isOpen: serializedNode.open }).updateFromJSON(
      serializedNode
    )
  }

  exportDOM () {
    const element = document.createElement('details')
    element.classList.add('sn__collapsible', 'sn__spoiler__container')
    return { element }
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      open: false // always save spoilers as collapsed
    }
  }

  setOpen (open) {
    const writable = this.getWritable()
    writable.__open = open
  }

  getOpen () {
    return this.getLatest().__open
  }

  toggleOpen () {
    this.setOpen(!this.getOpen())
  }
}

export function $createSpoilerContainerNode ({ isOpen = true } = {}) {
  return $applyNodeReplacement(new SpoilerContainerNode(isOpen))
}

export function $isSpoilerContainerNode (node) {
  return node instanceof SpoilerContainerNode
}
