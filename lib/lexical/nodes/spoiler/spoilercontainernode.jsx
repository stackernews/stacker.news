import { $getSiblingCaret, $isElementNode, ElementNode, $rewindSiblingCaret, isHTMLElement } from 'lexical'
import { IS_CHROME } from '@lexical/utils'
import { setDomHiddenUntilFound } from '@/lib/lexical/components/spoiler/spoilerutils'

// from lexical playground
export function $convertSpoilerElement (domNode) {
  const open = domNode.open !== undefined ? domNode.open : true
  const node = $createSpoilerContainerNode(open)
  return { node }
}

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
    const nodesToInsert = []
    for (const child of this.getChildren()) {
      if ($isElementNode(child)) {
        nodesToInsert.push(...child.getChildren())
      }
    }
    const caret = $rewindSiblingCaret($getSiblingCaret(this, 'previous'))
    caret.splice(1, nodesToInsert)

    // merge first child of spoiler title with the previous sibling of spoiler container node
    const [firstChild] = nodesToInsert
    if (firstChild) {
      firstChild.selectStart().deleteCharacter(true)
    }

    return true
  }

  createDOM (config, editor) {
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
    dom.classList.add('sn__spoilerContainer')
    return dom
  }

  updateDOM (prevNode, dom) {
    const currentOpen = this.__open
    if (prevNode.__open !== currentOpen) {
      if (IS_CHROME) {
        const contentDom = dom.children[1]
        if (!isHTMLElement(contentDom)) {
          throw new Error('content dom is not an html element')
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
          conversion: $convertSpoilerElement,
          priority: 1
        }
      }
    }
  }

  static importJSON (serializedNode) {
    return $createSpoilerContainerNode(serializedNode.open).updateFromJSON(serializedNode)
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      open: this.__open
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

export function $createSpoilerContainerNode (open = false) {
  return new SpoilerContainerNode(open)
}

export function $isSpoilerContainerNode (node) {
  return node instanceof SpoilerContainerNode
}
