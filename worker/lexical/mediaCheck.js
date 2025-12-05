import { createSNHeadlessEditor } from '@/lib/lexical/server/headless'
import { ssrCheckMediaNodes } from '@/lib/lexical/server/media/check'
import { lexicalHTMLGenerator } from '@/lib/lexical/server/html'

async function patchMedia (lexicalState) {
  const editor = createSNHeadlessEditor()
  editor.setEditorState(editor.parseEditorState(lexicalState))

  try {
    const updated = await ssrCheckMediaNodes(editor)
    if (!updated) return null
  } catch (error) {
    console.error('error checking media nodes: ', error)
    return null
  }

  let newLexicalState = null
  editor.read(() => {
    try {
      newLexicalState = editor.getEditorState().toJSON()
    } catch (error) {
      console.error('error generating Lexical JSON State: ', error)
      newLexicalState = null
    }
  })

  return newLexicalState
}

export async function mediaCheck ({ data: { id }, models }) {
  const item = await models.item.findUnique({ where: { id }, select: { lexicalState: true, updatedAt: true } })
  if (!item?.lexicalState) return null

  const newLexicalState = await patchMedia(item.lexicalState)
  if (!newLexicalState) return null

  const html = lexicalHTMLGenerator(newLexicalState)

  const result = await models.item.updateMany({
    where: { id, updatedAt: item.updatedAt },
    data: { lexicalState: newLexicalState, html }
  })

  if (result.count === 0) {
    console.warn(`[mediaCheck] item ${id} was updated by another process, skipping update`)
  }
}
