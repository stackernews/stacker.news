/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { IS_CHROME } from '@lexical/utils'
import {
  ElementNode
} from 'lexical'

import { $isSpoilerContainerNode } from './container'
import { domOnBeforeMatch, setDomHiddenUntilFound } from './utils'

export function $convertSpoilerContentElement (domNode) {
  const node = $createSpoilerContentNode()
  return {
    node
  }
}

export class SpoilerContentNode extends ElementNode {
  static getType () {
    return 'spoiler-content'
  }

  static clone (node) {
    return new SpoilerContentNode(node.__key)
  }

  createDOM (config, editor) {
    const dom = document.createElement('div')
    dom.classList.add('sn__spoiler__content')
    if (IS_CHROME) {
      editor.getEditorState().read(() => {
        const containerNode = this.getParentOrThrow()
        if (!$isSpoilerContainerNode(containerNode)) {
          throw new Error(
            'Expected parent node to be a SpoilerContainerNode'
          )
        }
        if (!containerNode.__open) {
          setDomHiddenUntilFound(dom)
        }
      })
      domOnBeforeMatch(dom, () => {
        editor.update(() => {
          const containerNode = this.getParentOrThrow().getLatest()
          if (!$isSpoilerContainerNode(containerNode)) {
            throw new Error(
              'Expected parent node to be a SpoilerContainerNode'
            )
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
        if (!domNode.hasAttribute('data-lexical-spoiler-content')) {
          return null
        }
        return {
          conversion: $convertSpoilerContentElement,
          priority: 2
        }
      }
    }
  }

  exportDOM () {
    const element = document.createElement('div')
    element.classList.add('sn__spoiler__content')
    element.setAttribute('data-lexical-spoiler-content', 'true')
    return { element }
  }

  static importJSON (serializedNode) {
    return $createSpoilerContentNode().updateFromJSON(serializedNode)
  }

  isShadowRoot () {
    return true
  }
}

export function $createSpoilerContentNode () {
  return new SpoilerContentNode()
}

export function $isSpoilerContentNode (node) {
  return node instanceof SpoilerContentNode
}
