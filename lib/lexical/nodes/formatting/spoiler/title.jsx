import { IS_CHROME } from '@lexical/utils'
import {
  $createParagraphNode,
  $isElementNode,
  buildImportMap,
  ElementNode
} from 'lexical'

import { $isSpoilerContainerNode } from './container'
import { $isSpoilerContentNode } from './content'

export function $convertSummaryElement (domNode) {
  const node = $createSpoilerTitleNode()
  return {
    node
  }
}

// from lexical, TODO: re-examine
/** @noInheritDoc */
export class SpoilerTitleNode extends ElementNode {
  /** @internal */
  $config () {
    return this.config('spoiler-title', {
      $transform (node) {
        if (node.isEmpty()) {
          node.remove()
        }
      },
      extends: ElementNode,
      importDOM: buildImportMap({
        summary: () => ({
          conversion: $convertSummaryElement,
          priority: 1
        })
      })
    })
  }

  createDOM (config, editor) {
    const dom = document.createElement('summary')
    dom.classList.add('sn__collapsible__header', 'sn__spoiler__title')
    if (IS_CHROME) {
      dom.addEventListener('click', () => {
        editor.update(() => {
          const spoilerContainer = this.getLatest().getParentOrThrow()
          if (!$isSpoilerContainerNode(spoilerContainer)) {
            throw new Error(
              'Expected parent node to be a SpoilerContainerNode'
            )
          }
          spoilerContainer.toggleOpen()
        })
      })
    }
    return dom
  }

  updateDOM (prevNode, dom) {
    return false
  }

  insertNewAfter (_, restoreSelection = true) {
    const containerNode = this.getParentOrThrow()

    if (!$isSpoilerContainerNode(containerNode)) {
      throw new Error(
        'sn__spoilerTitleNode expects to be child of SpoilerContainerNode'
      )
    }

    if (containerNode.getOpen()) {
      const contentNode = this.getNextSibling()
      if (!$isSpoilerContentNode(contentNode)) {
        throw new Error(
          'sn__spoilerTitleNode expects to have SpoilerContentNode sibling'
        )
      }

      const firstChild = contentNode.getFirstChild()
      if ($isElementNode(firstChild)) {
        return firstChild
      } else {
        const paragraph = $createParagraphNode()
        contentNode.append(paragraph)
        return paragraph
      }
    } else {
      const paragraph = $createParagraphNode()
      containerNode.insertAfter(paragraph, restoreSelection)
      return paragraph
    }
  }
}

export function $createSpoilerTitleNode () {
  return new SpoilerTitleNode()
}

export function $isSpoilerTitleNode (node) {
  return node instanceof SpoilerTitleNode
}
