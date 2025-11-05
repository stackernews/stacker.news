import { prepareLexicalState } from '@/lib/lexical/utils/server/interpolator'
import { lexicalHTMLGenerator } from '@/lib/lexical/utils/server/html'

// migrates legacy content to the new editorState Lexical format
// also generates the HTML for the item
export async function migrateLegacyContent ({ data: { itemId, fullRefresh, checkMedia = true }, models }) {
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
    console.log('converting markdown to lexical state')
    const result = await prepareLexicalState({ text: item.text }, { checkMedia })
    lexicalState = result.lexicalState
    if (!lexicalState) {
      throw new Error('couldn\'t convert markdown to lexical state')
    }
  }
  console.log('lexicalState generated:', lexicalState)
  const html = lexicalHTMLGenerator(lexicalState)
  if (html.startsWith('error')) {
    throw new Error('couldn\'t generate html')
  }
  await models.item.update({
    where: { id: item.id },
    data: { lexicalState, html }
  })
}

export async function migrateItemLegacy ({ itemId, text, models }) {
  const result = await prepareLexicalState({ text }, { checkMedia: false })
  const lexicalState = result.lexicalState
  if (!lexicalState) {
    throw new Error('couldn\'t convert markdown to lexical state')
  }
  const html = lexicalHTMLGenerator(lexicalState, itemId)
  if (html.startsWith('error')) {
    throw new Error('couldn\'t generate html')
  }
  await models.item.update({
    where: { id: itemId },
    data: { lexicalState, html }
  })
}

// EXPERIMENTAL: batch migration of everything
export async function migrateEverythingLegacy ({ models }) {
  const BATCH_SIZE = 2000
  let processedCount = 0
  let hasMore = true
  const failedItems = []

  while (hasMore) {
    const items = await models.$queryRaw`
      SELECT id, text
      FROM "Item"
      WHERE "lexicalState" IS NULL AND "text" IS NOT NULL AND TRIM("text") != '' ORDER BY id ASC LIMIT ${BATCH_SIZE}
    `

    for (const item of items) {
      try {
        await migrateItemLegacy({ itemId: item.id, text: item.text, models })
        processedCount++
      } catch (error) {
        failedItems.push({ id: item.id, error: error.message })
      }
    }

    if (items.length < BATCH_SIZE) {
      hasMore = false
    }
  }

  console.log(`Migration complete. Total items migrated: ${processedCount}`)
  console.log(`Failed items: ${JSON.stringify(failedItems)}`)
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
