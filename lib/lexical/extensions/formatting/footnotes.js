import { defineExtension, $getRoot, $createParagraphNode, $createTextNode, $getNodeByKey } from 'lexical'
import {
  FootnoteListNode, FootnoteDefinitionNode, FootnoteReferenceNode,
  $createFootnoteListNode, $createFootnoteDefinitionNode,
  $isFootnoteDefinitionNode
} from '@/lib/lexical/nodes/decorative/footnote'
import { mergeRegister } from '@lexical/utils'

export const FootnotesExtension = defineExtension({
  name: 'FootnotesExtension',
  nodes: [FootnoteListNode, FootnoteDefinitionNode, FootnoteReferenceNode],
  register: (editor) => {
    let listKey = null
    const footnotes = new Set()

    const unregister = mergeRegister(
      editor.registerMutationListener(FootnoteListNode, (mutations) => {
        for (const [key, type] of mutations) {
          if (type === 'created') {
            if (!listKey) {
              listKey = key
            } else {
              editor.update(() => {
                const node = $getNodeByKey(key)
                if (node && key !== listKey) node.remove()
              })
            }
          } else if (type === 'destroyed') {
            if (key === listKey) listKey = null
          }
        }
      }, { skipInitialization: true }),

      editor.registerMutationListener(FootnoteDefinitionNode, (mutations) => {
        for (const [key, type] of mutations) {
          if (type === 'created') {
            footnotes.add(key)
            console.log('FootnoteDefinitionNode created', key)
          } else if (type === 'destroyed') {
            footnotes.delete(key)
            console.log('FootnoteDefinitionNode destroyed', key)
          }
        }
      }, { skipInitialization: true }),

      editor.registerMutationListener(FootnoteReferenceNode, (mutations) => {
        for (const [key, type] of mutations) {
          if (type === 'created') {
            console.log('FootnoteReferenceNode created', key)
            editor.update(() => {
              const root = $getRoot()
              let listNode = $getNodeByKey(listKey)

              // ensure a list node exists
              if (!listNode) {
                console.log('Creating footnote list node')
                const footnoteListNode = $createFootnoteListNode()
                console.log('Created footnote list node', footnoteListNode)
                root.append(footnoteListNode)
                listNode = footnoteListNode
              }

              const lastChild = root.getLastChild()
              if (lastChild !== listNode) {
                console.log('Moving footnote list node to end')
                if (listNode) listNode.remove()
                root.append(listNode)
              }

              const existingDefs = new Map()
              listNode.getChildren().forEach((child) => {
                if ($isFootnoteDefinitionNode(child)) {
                  existingDefs.set(child.getFootnoteId(), child)
                }
              })

              const orderedDefinitions = []
              for (const id of footnotes) {
                let def = existingDefs.get(id)
                if (!def) {
                  console.log('Creating footnote definition node', id)
                  def = $createFootnoteDefinitionNode(id)
                  const p = $createParagraphNode()
                  p.append($createTextNode(`Footnote ${id}: `))
                  def.append(p)
                } else {
                  console.log('Deleting footnote definition node', id)
                  existingDefs.delete(id)
                }
                orderedDefinitions.push(def)
              }

              listNode.getChildren().forEach((child) => child.remove())
              orderedDefinitions.forEach((defNode) => listNode.append(defNode))
            })
          } else if (type === 'destroyed') {
            footnotes.delete(key)
            editor.update(() => {
              const listNode = $getNodeByKey(listKey)
              if (footnotes.size === 0) {
                if (listNode) listNode.remove()
              }
            })
          }
        }
      }, { skipInitialization: true }))

    return () => {
      unregister()
      footnotes.clear()
      listKey = null
    }
  }
})
