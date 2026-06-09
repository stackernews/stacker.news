import { DragonExtension } from '@lexical/dragon'
import {
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_NORMAL,
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  DRAGSTART_COMMAND,
  DROP_COMMAND,
  DRAGOVER_COMMAND,
  defineExtension,
  $addUpdateTag,
  $createRangeSelection,
  $getSelection,
  $isRangeSelection,
  $getRoot,
  $setSelection,
  PASTE_COMMAND,
  COPY_COMMAND,
  CUT_COMMAND,
  PASTE_TAG,
  HISTORY_PUSH_TAG
} from 'lexical'
import { registerRichText } from '@lexical/rich-text'
import { mergeRegister, objectKlassEquals } from '@lexical/utils'
import { $getNodesFromText } from '@/lib/lexical/utils'
import { $lexicalToMarkdown } from '@/lib/lexical/utils/mdast'
import { withDisposableBridge } from '@/components/editor/hooks/use-headless-bridge'

/** redirects a paste event to a disposable rich text bridge,
 *  and exports the resulting EditorState as markdown via MDAST */
const getMarkdownVersionsFromPaste = withDisposableBridge((bridge, event) => {
  try {
    bridge.update(() => {
      const root = $getRoot()
      root.clear()
      root.selectEnd()
    }, { discrete: true })

    bridge.dispatchCommand(PASTE_COMMAND, event)

    let escaped = null
    let unescaped = null
    bridge.update(() => {
      escaped = $lexicalToMarkdown()
      unescaped = $lexicalToMarkdown(true)
    }, { discrete: true })

    return { escaped, unescaped }
  } catch {
    return null
  }
}, { name: 'sn-markdown-paste-bridge' })

export function pasteStages ({ plainText, markdownVersions }) {
  return [
    plainText,
    markdownVersions?.unescaped,
    markdownVersions?.escaped
  ].filter((text, index, stages) => text && text !== stages[index - 1])
}

function $selectInsertedNodes (nodes) {
  if (nodes.length === 0) return

  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  const selection = $createRangeSelection()
  selection.anchor.set(first.getKey(), 0, 'element')
  selection.focus.set(last.getKey(), last.getChildrenSize(), 'element')
  $setSelection(selection)
}

function $replaceSelectionWithText (text, selectInserted = false) {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return

  const nodes = $getNodesFromText(text, true)
  selection.insertNodes(nodes)

  if (selectInserted) {
    $selectInsertedNodes(nodes)
  } else {
    nodes[nodes.length - 1]?.selectEnd()
  }
}

export function insertPasteStages (editor, stages) {
  stages.forEach((text, index) => {
    editor.update(() => {
      $addUpdateTag(PASTE_TAG)
      $replaceSelectionWithText(text, index < stages.length - 1)
    }, { tag: HISTORY_PUSH_TAG, discrete: true })
  })
}

function onPasteForMarkdown (event, editor) {
  event.preventDefault()

  const clipboardData = objectKlassEquals(event, window.ClipboardEvent)
    ? event.clipboardData
    : null
  if (!clipboardData) return

  // check for rich content (lexical or HTML)
  const hasRichContent = clipboardData.getData('application/x-lexical-editor') || clipboardData.getData('text/html')
  const plainText = clipboardData.getData('text/plain') || clipboardData.getData('text/uri-list')
  const stages = pasteStages({
    plainText,
    markdownVersions: hasRichContent ? getMarkdownVersionsFromPaste(event) : null
  })

  if (stages.length === 0) return
  insertPasteStages(editor, stages)
}

/** rich text extension that handles plain text only */
export const MarkdownTextExtension = defineExtension({
  name: 'MarkdownTextExtension',
  conflictsWith: ['@lexical/rich-text', '@lexical/plain-text'],
  dependencies: [DragonExtension], // speech to text
  register: (editor) => {
    return mergeRegister(
      registerRichText(editor),
      // block formatting and text alignment commands
      editor.registerCommand(FORMAT_TEXT_COMMAND, () => true, COMMAND_PRIORITY_CRITICAL),
      editor.registerCommand(FORMAT_ELEMENT_COMMAND, () => true, COMMAND_PRIORITY_CRITICAL),

      // block drag drop (LexicalPlainText)
      editor.registerCommand(DROP_COMMAND, event => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return false
        event.preventDefault()
        return true
      }, COMMAND_PRIORITY_NORMAL),
      // block drag start (LexicalPlainText)
      editor.registerCommand(DRAGSTART_COMMAND, event => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return false
        event.preventDefault()
        return true
      }, COMMAND_PRIORITY_NORMAL),
      // block drag over
      editor.registerCommand(DRAGOVER_COMMAND, () => true, COMMAND_PRIORITY_NORMAL),

      // intercept paste and only handle plain text
      editor.registerCommand(
        PASTE_COMMAND,
        (e) => {
          const selection = $getSelection()
          if (!$isRangeSelection(selection)) return false

          onPasteForMarkdown(e, editor)
          return true
        },
        COMMAND_PRIORITY_NORMAL
      ),
      // copy as plain text only
      editor.registerCommand(
        COPY_COMMAND,
        (e) => {
          if (objectKlassEquals(e, window.ClipboardEvent) && e.clipboardData) {
            const selection = $getSelection()
            if (!$isRangeSelection(selection)) return false

            e.preventDefault()
            const text = selection.getTextContent()
            e.clipboardData.setData('text/plain', text)
            return true
          }

          return false
        },
        COMMAND_PRIORITY_NORMAL
      ),
      // cut as plain text only
      editor.registerCommand(
        CUT_COMMAND,
        (e) => {
          if (objectKlassEquals(e, window.ClipboardEvent) && e.clipboardData) {
            const selection = $getSelection()
            if (!$isRangeSelection(selection)) return false

            e.preventDefault()
            const text = selection.getTextContent()
            e.clipboardData.setData('text/plain', text)
            selection.removeText()
            return true
          }

          return false
        },
        COMMAND_PRIORITY_NORMAL
      )
    )
  }
})
