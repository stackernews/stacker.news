import { defineExtension, ParagraphNode } from 'lexical'
import { mergeRegister } from '@lexical/utils'
import { QuoteNode } from '@lexical/rich-text'
import { ListNode, ListItemNode } from '@lexical/list'
import { SNHeadingNode } from '@/lib/lexical/nodes/misc/heading'

// block-level nodes that can carry an element alignment (text-align).
// table cells are intentionally excluded: they reuse the same format to store
// markdown column alignment, which we want to preserve (see mdast/visitors/table.js)
const ALIGNABLE_NODES = [ParagraphNode, SNHeadingNode, QuoteNode, ListNode, ListItemNode]

// alignment isn't supported in the editor yet. element alignment only sneaks in
// through copy/paste of rich content (HTML text-align or lexical clipboard data),
// so we strip it back to the default.
function $clearAlignment (node) {
  if (node.getFormat() !== 0) {
    node.setFormat('')
  }
}

/** strips element alignment that surfaces when pasting rich content */
export const NoAlignmentExtension = defineExtension({
  name: 'NoAlignmentExtension',
  register: (editor) => {
    return mergeRegister(
      ...ALIGNABLE_NODES.map((klass) => editor.registerNodeTransform(klass, $clearAlignment))
    )
  }
})
