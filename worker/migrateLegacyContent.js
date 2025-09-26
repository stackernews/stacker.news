import { ssrMarkdownToLexicalConverter } from '@/lib/lexical/utils/server/markdownToLexical'
import { ssrLexicalHTMLGenerator } from '@/lib/lexical/utils/server/lexicalToHTML'

// migrates legacy content to the new editorState Lexical format
// also generates the HTML for the item
export async function migrateLegacyContent ({ data: { itemId, fullRefresh }, models }) {
  console.log('Stacker News Lexical Migration Strategy worker started')
  console.log('Received itemId: ', itemId)
  const item = await models.item.findUnique({
    where: {
      id: itemId
    }
  })
  if (!item) {
    throw new Error(`couldn't find item: ${itemId}`)
  }

  let lexicalState = item.lexicalState
  console.log('lexicalState', lexicalState)
  if (!lexicalState || fullRefresh) {
    lexicalState = ssrMarkdownToLexicalConverter(item.text)
    if (!lexicalState) {
      throw new Error('couldn\'t convert markdown to lexical state')
    }
  }
  const html = ssrLexicalHTMLGenerator(lexicalState)
  if (html.startsWith('error')) {
    throw new Error('couldn\'t generate html')
  }
  await models.item.update({
    where: { id: item.id },
    data: { lexicalState, html }
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
