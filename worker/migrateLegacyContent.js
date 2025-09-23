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

/*
async function scheduleLegacyContentMigration ({ itemId, models }) {
  const alreadyScheduled = await models.$queryRaw`
    SELECT 1
    FROM pgboss.job
    WHERE name = 'migrateLegacyContent' AND data->>'itemId' = ${itemId}::TEXT
  `
  if (alreadyScheduled.length > 0) return

  // singleton job, so that we don't run the same job multiple times
  // if on concurrent requests the check above fails
  await models.$executeRaw`
    INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter, keepuntil, singletonKey)
    VALUES ('migrateLegacyContent',
            jsonb_build_object('itemId', ${itemId}::INTEGER),
            21,
            true,
            now() + interval '15 seconds',
            now() + interval '1 day',
            'migrateLegacyContent:' || ${itemId}::TEXT)
  `
}
*/
