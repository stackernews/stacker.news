import { createSNHeadlessEditor } from '@/lib/lexical/headless'
import { $trimEmptyNodes } from '@/lib/lexical/utils'
import { markdownToLexical } from '@/lib/lexical/utils/mdast'
import { GalleryExtension } from '@/lib/lexical/exts/gallery'
import { AutoLinkExtension } from '@/lib/lexical/exts/autolink'
import { ItemContextExtension } from '@/lib/lexical/exts/item-context'
import { mergeRegister } from '@lexical/utils'

/**
 * converts markdown to a serialized Lexical state
 * @param {string} [params.text] - markdown text to convert
 * @param {Object} [params.context] - context object
 * @returns {string|null} serialized lexical state or null for empty content
 */
export function prepareLexicalState ({ text, context = {} }) {
  if (!text?.trim()) return null

  const editor = createSNHeadlessEditor()
  // register extensions, must be registerable
  const unregister = mergeRegister(
    ItemContextExtension.register(editor, context),
    AutoLinkExtension.register(editor),
    GalleryExtension.register(editor)
  )

  let hasError = false

  let lexicalState = null
  try {
    // transform the markdown text into a lexical state via MDAST
    editor.update(() => {
      markdownToLexical(editor, text)
    })

    // trim empty nodes from the start and end of the root
    editor.update(() => {
      $trimEmptyNodes()
    })

    editor.read(() => {
      try {
        // very ugly but Next.js can't serialize undefined values
        lexicalState = JSON.stringify(editor.getEditorState())
      } catch (error) {
        console.error('error generating Lexical JSON State: ', error)
        hasError = true
      }
    })
  } finally {
    unregister?.()
  }

  if (hasError) return null

  // prepared text and lexical state
  return lexicalState
}
