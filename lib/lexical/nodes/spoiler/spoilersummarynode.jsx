import { IS_CHROME } from '@lexical/utils'
import { $isSpoilerContainerNode } from './spoilercontainernode'
import { $isSpoilerDetailsNode } from './spoilerdetailsnode'
import { ElementNode, $isElementNode, $createParagraphNode, buildImportMap } from 'lexical'

// from lexical playground
export function $convertSpoilerSummaryElement (domNode) {
  const node = $createSpoilerSummaryNode()
  return { node }
}

export class SpoilerSummaryNode extends ElementNode {
  $config () {
    return this.config('spoiler-summary', {
      $transform (node) {
        if (node.isEmpty()) {
          node.remove()
        }
      },
      extends: ElementNode,
      importDOM: buildImportMap({
        summary: () => ({
          conversion: $convertSpoilerSummaryElement,
          priority: 1
        })
      })
    })
  }

  createDOM (config, editor) {
    const dom = document.createElement('summary')
    dom.classList.add('sn__spoilerSummary')
    if (IS_CHROME) {
      dom.addEventListener('click', () => {
        editor.update(() => {
          const containerNode = this.getLatest().getParentOrThrow()
          if (!$isSpoilerContainerNode(containerNode)) {
            throw new Error('spoiler summary node must have a spoiler container node as parent')
          }
          containerNode.toggleOpen()
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
      throw new Error('spoiler summary node expects to be child of spoiler container node')
    }

    if (containerNode.getOpen()) {
      const contentNode = this.getNextSibling()
      if (!$isSpoilerDetailsNode(contentNode)) {
        throw new Error('spoiler summary node expects to have a spoiler details node as sibling')
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

export function $createSpoilerSummaryNode () {
  return new SpoilerSummaryNode()
}

export function $isSpoilerSummaryNode (node) {
  return node instanceof SpoilerSummaryNode
}
