// import { ssrMarkdownToLexicalConverter } from '@/lib/lexical/utils/ssrMarkdownToLexicalConverter'
// import { ssrLexicalHTMLGenerator } from '@/lib/lexical/utils/ssrLexicalHTMLGenerator'

// migrates legacy content to the new editorState Lexical format
// also generates the HTML for the item
export async function migrateLegacyContent ({ data: { itemId }, models }) {
  const item = await models.item.findUnique({
    where: { id: itemId }
  })

  if (!item) {
    throw new Error(`couldn't find item: ${itemId}`)
  }

  // convert the markdown to the new lexical state
  // const lexicalState = ssrMarkdownToLexicalConverter(item.text)

  // generate the HTML for the item, that will be used as a placeholder
  // const html = ssrLexicalHTMLGenerator(lexicalState)

  await models.item.update({
    where: { id: itemId },
    data: { lexicalState: '', html: '' }
  })
}
