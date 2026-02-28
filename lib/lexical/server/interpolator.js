import { createSNHeadlessEditor } from '@/lib/lexical/server/headless'
import { $trimEmptyNodes } from '@/lib/lexical/utils'
import { markdownToLexical, lexicalToMarkdown } from '@/lib/lexical/utils/mdast'
import { GalleryExtension } from '@/lib/lexical/exts/gallery'
import { AutoLinkExtension } from '@/lib/lexical/exts/autolink'
import { ItemContextExtension } from '@/lib/lexical/exts/item-context'
import { mergeRegister } from '@lexical/utils'

/**
 * converts markdown to Lexical state or processes existing state
 * @param {string} [params.text] - markdown text to convert
 * @param {Object} [params.context] - context object
 * @returns {Promise<Object>} object with text and lexicalState properties
 */
export async function prepareLexicalState ({ text, context = {} }) {
  if (!text) {
    throw new Error('text is required')
  }

  const editor = createSNHeadlessEditor()
  const unregister = mergeRegister(
    ItemContextExtension.register?.(editor, context),
    AutoLinkExtension.register?.(editor),
    GalleryExtension.register?.(editor)
  )

  let hasError = false

  let lexicalState = {}
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

/**
 * converts lexical state to markdown
 * @param {string} [params.lexicalState] - lexical state to convert
 * @returns {string} markdown text
 */
export function prepareMarkdown ({ lexicalState }) {
  if (!lexicalState) {
    throw new Error('lexicalState is required')
  }

  try {
    const editor = createSNHeadlessEditor()
    editor.setEditorState(lexicalState)

    const markdown = lexicalToMarkdown(editor)
    return markdown
  } catch (error) {
    console.error('error preparing markdown from lexical state: ', error)
    return null
  }
}
