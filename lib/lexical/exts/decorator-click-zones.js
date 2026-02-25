import {
  defineExtension,
  $getRoot,
  $createParagraphNode,
  CLICK_COMMAND,
  COMMAND_PRIORITY_NORMAL
} from 'lexical'
import { $isUnwritable } from '@/lib/lexical/nodes/utils'

const ZONE_SIZE = 16

/**
 * Detects clicks/taps near the top or bottom edge of block-level decorator
 * nodes and inserts a paragraph at that boundary.
 */
export const DecoratorClickZonesExtension = defineExtension({
  name: 'DecoratorClickZonesExtension',
  register: (editor) => {
    return editor.registerCommand(
      CLICK_COMMAND,
      (event) => {
        if (!editor.isEditable()) return false

        const root = $getRoot()
        const children = root.getChildren()

        for (let i = 0; i < children.length; i++) {
          const child = children[i]
          if (!$isUnwritable(child)) continue

          const element = editor.getElementByKey(child.getKey())
          if (!element) continue

          const rect = element.getBoundingClientRect()
          const y = event.clientY

          const nearTop = y >= rect.top - ZONE_SIZE && y < rect.top + ZONE_SIZE
          const nearBottom = y > rect.bottom - ZONE_SIZE && y <= rect.bottom + ZONE_SIZE
          if (!nearTop && !nearBottom) continue

          if (nearTop) {
            const prev = i > 0 ? children[i - 1] : null
            if (prev && !$isUnwritable(prev)) continue
          } else {
            const next = i < children.length - 1 ? children[i + 1] : null
            if (next && !$isUnwritable(next)) continue
          }

          const paragraph = $createParagraphNode()
          if (nearTop) {
            child.insertBefore(paragraph)
          } else {
            child.insertAfter(paragraph)
          }
          paragraph.select()
          return true
        }

        return false
      },
      COMMAND_PRIORITY_NORMAL
    )
  }
})
