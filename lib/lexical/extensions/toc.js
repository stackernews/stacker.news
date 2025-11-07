import { defineExtension, signal, effect, batch, NodeSelectionExtension } from '@lexical/extension'
import { mergeRegister, addClassNamesToElement, removeClassNamesFromElement } from '@lexical/utils'
import {
  TableOfContentsNode,
  $isTableOfContentsNode
} from '@/lib/lexical/nodes/misc/toc'
import {
  COMMAND_PRIORITY_LOW,
  CLICK_COMMAND,
  isDOMNode,
  $getNodeFromDOMNode,
  $getSelection,
  $isNodeSelection,
  $createNodeSelection,
  $setSelection
} from 'lexical'

function $toggleNodeSelection (node, shiftKey = false) {
  const selection = $getSelection()
  const wasSelected = node.isSelected()
  const key = node.getKey()
  let nodeSelection
  if (shiftKey && $isNodeSelection(selection)) {
    nodeSelection = selection
  } else {
    nodeSelection = $createNodeSelection()
    $setSelection(nodeSelection)
  }
  if (wasSelected) {
    nodeSelection.delete(key)
  } else {
    nodeSelection.add(key)
  }
}

// mimicks HorizontalRuleExtension to provide selectable ToC nodes
export const TableOfContentsExtension = defineExtension({
  dependencies: [NodeSelectionExtension],
  name: 'TableOfContentsExtension',
  nodes: [TableOfContentsNode],
  register (editor, config, state) {
    // watchNodeKey allows us to track when a node is selected
    const { watchNodeKey } = state.getDependency(NodeSelectionExtension).output

    // store reactive signals for each TOC node instance
    const nodeSelectionStore = signal({ nodeSelections: new Map() })
    const isSelectedClassName = editor._config.theme.tocSelected ?? 'selected'

    return mergeRegister(
      editor.registerCommand(
        CLICK_COMMAND,
        event => {
          if (isDOMNode(event.target)) {
            // don't intercept clicks on interactive elements
            const tagName = event.target.tagName.toLowerCase()
            if (tagName === 'a' || tagName === 'summary') {
              return false
            }

            // traverse up the DOM tree to find the decorator container
            let target = event.target
            while (target) {
              const node = $getNodeFromDOMNode(target)
              if ($isTableOfContentsNode(node)) {
                $toggleNodeSelection(node, event.shiftKey)
                return true
              }
              target = target.parentElement
            }
          }
          return false
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerMutationListener(
        TableOfContentsNode,
        (nodes, payload) => {
          batch(() => {
            let didChange = false
            const { nodeSelections } = nodeSelectionStore.peek()

            for (const [k, v] of nodes.entries()) {
              if (v === 'destroyed') {
                nodeSelections.delete(k)
                didChange = true
              } else {
                const prev = nodeSelections.get(k)
                const dom = editor.getElementByKey(k)
                if (prev) {
                  prev.domNode.value = dom
                } else {
                  didChange = true
                  nodeSelections.set(k, {
                    domNode: signal(dom),
                    selectedSignal: watchNodeKey(k)
                  })
                }
              }
            }

            if (didChange) {
              nodeSelectionStore.value = { nodeSelections }
            }
          })
        }
      ),
      effect(() => {
        const effects = []
        for (const { domNode, selectedSignal } of nodeSelectionStore.value.nodeSelections.values()) {
          effects.push(
            effect(() => {
              const dom = domNode.value
              if (dom) {
                const isSelected = selectedSignal.value
                if (isSelected) {
                  addClassNamesToElement(dom, isSelectedClassName)
                } else {
                  removeClassNamesFromElement(dom, isSelectedClassName)
                }
              }
            })
          )
        }
        return mergeRegister(...effects)
      }))
  }
})
