// from LexicalCollapsiblePlugin
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $findMatchingParent,
  $insertNodeToNearestRoot,
  mergeRegister
} from '@lexical/utils'
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  createCommand,
  INSERT_PARAGRAPH_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_ARROW_UP_COMMAND
} from 'lexical'
import { useEffect } from 'react'

import {
  $createSpoilerContainerNode,
  $isSpoilerContainerNode,
  SpoilerContainerNode
} from '@/lib/lexical/nodes/formatting/spoiler/container'
import {
  $createSpoilerContentNode,
  $isSpoilerContentNode,
  SpoilerContentNode
} from '@/lib/lexical/nodes/formatting/spoiler/content'
import {
  $createSpoilerTitleNode,
  $isSpoilerTitleNode,
  SpoilerTitleNode
} from '@/lib/lexical/nodes/formatting/spoiler/title'

export const INSERT_SPOILER_COMMAND = createCommand(
  'INSERT_SPOILER_COMMAND'
)

// TODO: CLEANUP AND REFACTOR THIS PLUGIN
export default function SpoilerPlugin () {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    if (
      !editor.hasNodes([
        SpoilerContainerNode,
        SpoilerTitleNode,
        SpoilerContentNode
      ])
    ) {
      throw new Error(
        'SpoilerPlugin: SpoilerContainerNode, SpoilerTitleNode, or SpoilerContentNode not registered on editor'
      )
    }

    const $onEscapeUp = () => {
      const selection = $getSelection()
      if (
        $isRangeSelection(selection) &&
        selection.isCollapsed() &&
        selection.anchor.offset === 0
      ) {
        const container = $findMatchingParent(
          selection.anchor.getNode(),
          $isSpoilerContainerNode
        )

        if ($isSpoilerContainerNode(container)) {
          const parent = container.getParent()
          if (
            parent !== null &&
            parent.getFirstChild() === container &&
            selection.anchor.key === container.getFirstDescendant()?.getKey()
          ) {
            container.insertBefore($createParagraphNode())
          }
        }
      }

      return false
    }

    const $onEscapeDown = () => {
      const selection = $getSelection()
      if ($isRangeSelection(selection) && selection.isCollapsed()) {
        const container = $findMatchingParent(
          selection.anchor.getNode(),
          $isSpoilerContainerNode
        )

        if ($isSpoilerContainerNode(container)) {
          const parent = container.getParent()
          if (parent !== null && parent.getLastChild() === container) {
            const titleParagraph = container.getFirstDescendant()
            const contentParagraph = container.getLastDescendant()

            if (
              (contentParagraph !== null &&
                selection.anchor.key === contentParagraph.getKey() &&
                selection.anchor.offset ===
                  contentParagraph.getTextContentSize()) ||
              (titleParagraph !== null &&
                selection.anchor.key === titleParagraph.getKey() &&
                selection.anchor.offset === titleParagraph.getTextContentSize())
            ) {
              container.insertAfter($createParagraphNode())
            }
          }
        }
      }

      return false
    }

    return mergeRegister(
      // Structure enforcing transformers for each node type. In case nesting structure is not
      // "Container > Title + Content" it'll unwrap nodes and convert it back
      // to regular content.
      editor.registerNodeTransform(SpoilerContentNode, (node) => {
        const parent = node.getParent()
        if (!$isSpoilerContainerNode(parent)) {
          const children = node.getChildren()
          for (const child of children) {
            node.insertBefore(child)
          }
          node.remove()
        }
      }),

      editor.registerNodeTransform(SpoilerTitleNode, (node) => {
        const parent = node.getParent()
        if (!$isSpoilerContainerNode(parent)) {
          node.replace($createParagraphNode().append(...node.getChildren()))
        }
      }),

      editor.registerNodeTransform(SpoilerContainerNode, (node) => {
        const children = node.getChildren()
        if (
          children.length !== 2 ||
          !$isSpoilerTitleNode(children[0]) ||
          !$isSpoilerContentNode(children[1])
        ) {
          for (const child of children) {
            node.insertBefore(child)
          }
          node.remove()
        }
      }),

      // When spoiler is the last child pressing down/right arrow will insert paragraph
      // below it to allow adding more content. It's similar what $insertBlockNode
      // (mainly for decorators), except it'll always be possible to continue adding
      // new content even if trailing paragraph is accidentally deleted
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        $onEscapeDown,
        COMMAND_PRIORITY_LOW
      ),

      editor.registerCommand(
        KEY_ARROW_RIGHT_COMMAND,
        $onEscapeDown,
        COMMAND_PRIORITY_LOW
      ),

      // When spoiler is the first child pressing up/left arrow will insert paragraph
      // above it to allow adding more content. It's similar what $insertBlockNode
      // (mainly for decorators), except it'll always be possible to continue adding
      // new content even if leading paragraph is accidentally deleted
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        $onEscapeUp,
        COMMAND_PRIORITY_LOW
      ),

      editor.registerCommand(
        KEY_ARROW_LEFT_COMMAND,
        $onEscapeUp,
        COMMAND_PRIORITY_LOW
      ),

      // Enter goes from Title to Content rather than a new line inside Title
      editor.registerCommand(
        INSERT_PARAGRAPH_COMMAND,
        () => {
          const selection = $getSelection()
          if ($isRangeSelection(selection)) {
            const titleNode = $findMatchingParent(
              selection.anchor.getNode(),
              (node) => $isSpoilerTitleNode(node)
            )

            if ($isSpoilerTitleNode(titleNode)) {
              const container = titleNode.getParent()
              if (container && $isSpoilerContainerNode(container)) {
                if (!container.getOpen()) {
                  container.toggleOpen()
                }
                titleNode.getNextSibling()?.selectEnd()
                return true
              }
            }
          }

          return false
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        INSERT_SPOILER_COMMAND,
        () => {
          editor.update(() => {
            const title = $createSpoilerTitleNode()
            const paragraph = $createParagraphNode()
            $insertNodeToNearestRoot(
              $createSpoilerContainerNode(true).append(
                title.append(paragraph),
                $createSpoilerContentNode().append($createParagraphNode())
              )
            )
            paragraph.select()
          })
          return true
        },
        COMMAND_PRIORITY_LOW
      )
    )
  }, [editor])

  return null
}
