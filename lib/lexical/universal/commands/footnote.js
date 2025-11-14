import { createCommand, COMMAND_PRIORITY_EDITOR, $getSelection, $isRangeSelection, $createTextNode } from 'lexical'
import { $createFootnoteReferenceNode } from '@/lib/lexical/nodes/decorative/footnote'
export const SN_INSERT_FOOTNOTE_COMMAND = createCommand('SN_INSERT_FOOTNOTE_COMMAND')

export function registerSNInsertFootnoteCommand ({ editor }) {
  return editor.registerCommand(SN_INSERT_FOOTNOTE_COMMAND, () => {
    const selection = $getSelection()
    if (!$isRangeSelection(selection)) return false
    const footnote = $createFootnoteReferenceNode()
    footnote.append($createTextNode('1'))
    selection.insertNodes([footnote])
    footnote.select()
    return true
  }, COMMAND_PRIORITY_EDITOR)
}
