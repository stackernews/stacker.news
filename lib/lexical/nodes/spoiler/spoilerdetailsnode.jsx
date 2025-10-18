import { IS_CHROME } from '@lexical/utils'
import { setDomHiddenUntilFound, domOnBeforeMatch } from '@/lib/lexical/components/spoiler/spoilerutils'
import { $isSpoilerContainerNode } from './spoilercontainernode'
import { ElementNode } from 'lexical'

// from lexical playground
export function $convertSpoilerDetailsElement (domNode) {
  const node = $createSpoilerDetailsNode()
  return { node }
}

export class SpoilerDetailsNode extends ElementNode {
  static getType () {
    return 'spoiler-details'
  }

  static clone (node) {
    return new SpoilerDetailsNode(node.__key)
  }

  createDOM (config, editor) {
    const dom = document.createElement('div')
    dom.classList.add('sn__spoilerDetails')
    if (IS_CHROME) {
      editor.getEditorState().read(() => {
        const containerNode = this.getParentOrThrow()
        if (!$isSpoilerContainerNode(containerNode)) {
          throw new Error('spoiler details node must have a spoiler container node as parent')
        }
        if (!containerNode.__open) {
          setDomHiddenUntilFound(dom)
        }
      })
      domOnBeforeMatch(dom, () => {
        editor.update(() => {
          const containerNode = this.getParentOrThrow().getLatest()
          if (!$isSpoilerContainerNode(containerNode)) {
            throw new Error('spoiler details node must have a spoiler container node as parent')
          }
          if (!containerNode.__open) {
            containerNode.toggleOpen()
          }
        })
      })
    }
    return dom
  }

  updateDOM (prevNode, dom) {
    return false
  }

  static importDOM () {
    return {
      div: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-spoiler-details')) return null
        return { conversion: $convertSpoilerDetailsElement, priority: 2 }
      }
    }
  }

  exportDOM () {
    const element = document.createElement('div')
    element.classList.add('sn__spoilerDetails')
    element.setAttribute('data-lexical-spoiler-details', true)
    return { element }
  }

  static importJSON (serializedNode) {
    return $createSpoilerDetailsNode().updateFromJSON(serializedNode)
  }

  isShadowRoot () {
    return true
  }
}

export function $createSpoilerDetailsNode () {
  return new SpoilerDetailsNode()
}

export function $isSpoilerDetailsNode (node) {
  return node instanceof SpoilerDetailsNode
}
