import { IS_CHROME } from '@lexical/utils'
import { setDomHiddenUntilFound, domOnBeforeMatch } from './utils'
import { $isSpoilerContainerNode } from './container'
import { ElementNode, $createParagraphNode } from 'lexical'

// from lexical playground
export function $convertSpoilerContentElement (domNode) {
  const node = $createSpoilerContentNode()
  return { node }
}

export class SpoilerContentNode extends ElementNode {
  static getType () {
    return 'spoiler-content'
  }

  static clone (node) {
    return new SpoilerContentNode(node.__key)
  }

  createDOM (config, editor) {
    const dom = document.createElement('content')
    dom.className = config.theme.spoilerContent
    if (IS_CHROME) {
      editor.getEditorState().read(() => {
        const containerNode = this.getParentOrThrow()
        if (!$isSpoilerContainerNode(containerNode)) {
          throw new Error('spoiler content node must have a spoiler container node as parent')
        }
        if (!containerNode.__open) {
          setDomHiddenUntilFound(dom)
        }
      })
      domOnBeforeMatch(dom, () => {
        editor.update(() => {
          const containerNode = this.getParentOrThrow().getLatest()
          if (!$isSpoilerContainerNode(containerNode)) {
            throw new Error('spoiler content node must have a spoiler container node as parent')
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
        if (!domNode.hasAttribute('data-lexical-spoiler-content')) return null
        return { conversion: $convertSpoilerContentElement, priority: 2 }
      }
    }
  }

  exportDOM (config) {
    const element = document.createElement('content')
    element.className = config.theme.spoilerContent
    element.setAttribute('data-lexical-spoiler-content', true)
    return { element }
  }

  static importJSON (serializedNode) {
    return $createSpoilerContentNode().updateFromJSON(serializedNode)
  }

  isShadowRoot () {
    return true
  }

  insertNewAfter (_, restoreSelection = true) {
    const lastChild = this.getLastChild()
    if (lastChild) {
      console.log('lastChild', lastChild)
      // If we're not at the last child, continue normally
      const nextSibling = lastChild.getNextSibling()
      if (nextSibling) {
        console.log('were not at the last child')
        return lastChild
      }
    }
    console.log('were at the last child')
    // We're at the end of content - exit the spoiler
    const containerNode = this.getParentOrThrow()
    const paragraph = $createParagraphNode()
    containerNode.insertAfter(paragraph, restoreSelection)
    return paragraph
  }
}

export function $createSpoilerContentNode () {
  return new SpoilerContentNode()
}

export function $isSpoilerContentNode (node) {
  return node instanceof SpoilerContentNode
}
