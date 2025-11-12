import { prepareLexicalState } from '@/lib/lexical/utils/server/interpolator'
import { lexicalHTMLGenerator } from '@/lib/lexical/utils/server/html'
import { BATCH_MAX_ITEMS_PER_JOB, BATCH_DELAY_MS, BATCH_SIZE, BATCH_MAX_CONCURRENT } from '@/lib/constants'
import { Prisma } from '@prisma/client'

async function addMigrationError ({ itemId, type, message, retryCount = 0, models }) {
  await models.lexicalMigrationLog.upsert({
    where: { itemId },
    create: { itemId, type, message, createdAt: new Date() },
    update: { message, retryCount: retryCount + 1, updatedAt: new Date() }
  })
}

export async function migrateItem ({ itemId, fullRefresh = false, checkMedia = true, models }) {
  const startTime = Date.now()

  try {
    const item = await models.item.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        text: true,
        lexicalState: true,
        html: true
      }
    })

    if (!item) throw new Error(`item not found: ${itemId}`)

    if (item.lexicalState && !fullRefresh) {
      return {
        success: true,
        skipped: true,
        itemId,
        message: 'already migrated'
      }
    }

    if (!item.text || item.text.trim() === '') {
      return {
        success: true,
        skipped: true,
        itemId,
        message: 'no text content'
      }
    }

    let lexicalState = null
    let migrationError = null

    try {
      const result = await prepareLexicalState({ text: item.text }, { checkMedia })
      lexicalState = result?.lexicalState

      if (!lexicalState) throw new Error('prepareLexicalState did not return a valid lexical state')
    } catch (error) {
      console.error(`failed to convert markdown for item ${itemId}:`, error)
      migrationError = error
    }

    // log migration error
    if (!lexicalState || migrationError) {
      await addMigrationError({
        itemId,
        type: 'LEXICAL_CONVERSION',
        message: migrationError?.message || 'unknown error',
        retryCount: migrationError ? 1 : 0,
        models
      })

      return {
        success: false,
        itemId,
        error: migrationError?.message || 'unknown error'
      }
    }

    let html = null
    let htmlError = null

    try {
      html = lexicalHTMLGenerator(lexicalState)

      if (html && html.startsWith('error')) {
        throw new Error('html generation returned error')
      }
    } catch (error) {
      console.error(`failed to generate html for item ${itemId}:`, error)
      htmlError = error
    }

    // log html generation error
    if (!html || htmlError) {
      await addMigrationError({
        itemId,
        type: 'HTML_GENERATION',
        message: htmlError?.message || 'unknown error',
        retryCount: htmlError ? 1 : 0,
        models
      })

      return {
        success: false,
        itemId,
        error: htmlError?.message || 'unknown error'
      }
    }

    // update item with transaction
    await models.$transaction(async (tx) => {
      await tx.item.update({
        where: { id: itemId },
        data: {
          lexicalState,
          html
        }
      })

      // clear any migration errors on this item
      await tx.lexicalMigrationLog.deleteMany({ where: { itemId } })
    })

    const durationMs = Date.now() - startTime

    return {
      success: true,
      itemId,
      message: 'migration successful',
      durationMs
    }
  } catch (error) {
    console.error(`unexpected error migrating item ${itemId}:`, error)
    await addMigrationError({
      itemId,
      type: 'UNEXPECTED',
      message: error.message,
      retryCount: 1,
      models
    })

    return {
      success: false,
      itemId,
      error: error.message
    }
  }
}

export async function migrateLegacyContent ({ data, models }) {
  const { itemId, fullRefresh = false, checkMedia = true } = data

  console.log(`[migrateLegacyContent] starting migration for item ${itemId}`)

  const result = await migrateItem({
    itemId,
    fullRefresh,
    checkMedia,
    models
  })

  if (!result.success) {
    // throw error to trigger pgboss retry mechanism
    throw new Error(result.error || 'migration failed')
  }

  return result
}

/** get summary from migration result */
function getSummary (result) {
  return {
    totalProcessed: result.successCount + result.failureCount,
    successCount: result.successCount,
    failureCount: result.failureCount,
    failures: result.failures,
    durationMs: Date.now() - result.startTime
  }
}

function logSuccess (result) {
  return { ...result, successCount: result.successCount + 1 }
}

function logFailure (result, itemId, error) {
  return {
    ...result,
    failureCount: result.failureCount + 1,
    failures: [...result.failures, {
      itemId,
      error: error.message || error,
      timestamp: new Date().toISOString()
    }]
  }
}

async function processBatch (items, models, result, checkMedia = false) {
  let currentResult = result

  // process items in chunks of MAX_CONCURRENT
  for (let i = 0; i < items.length; i += BATCH_MAX_CONCURRENT) {
    const chunk = items.slice(i, i + BATCH_MAX_CONCURRENT)

    const chunkResults = await Promise.all(
      chunk.map(async (item) => {
        try {
          const migrationResult = await migrateItem({
            itemId: item.id,
            fullRefresh: false,
            checkMedia,
            models
          })

          if (migrationResult.success && !migrationResult.skipped) {
            return { success: true, itemId: item.id }
          } else if (!migrationResult.success) {
            return { success: false, itemId: item.id, error: migrationResult.error }
          }
          return { skipped: true }
        } catch (error) {
          console.error(`batch migration error for item ${item.id}:`, error)
          return { success: false, itemId: item.id, error }
        }
      })
    )

    // update result based on chunk results
    for (const chunkResult of chunkResults) {
      if (chunkResult.success) {
        currentResult = logSuccess(currentResult)
      } else if (chunkResult.success === false) {
        currentResult = logFailure(currentResult, chunkResult.itemId, chunkResult.error)
      }
    }

    // delay between chunks to prevent overload
    if (i + BATCH_MAX_CONCURRENT < items.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return currentResult
}

async function buildCustomWhereClause ({ values, models }) {
  if (!values || !values.by) return null

  const { by, toId, fromDate, toDate, user, migrateComments } = values

  const conditions = []

  if (by === 'id' && toId) {
    conditions.push(`id <= ${toId}`)
  } else if (by === 'date' && fromDate && toDate) {
    conditions.push(`"createdAt" >= '${fromDate}'::timestamp AND "createdAt" <= '${toDate}'::timestamp`)
  } else if (by === 'user' && user) {
    const userId = (await models.user.findUnique({ where: { name: user } }))?.id
    if (!userId) throw new Error(`user not found: ${user}`)
    conditions.push(`"userId" = ${userId}`)
  }

  if (migrateComments === false) {
    conditions.push('"parentId" IS NULL')
  }

  return conditions.length > 0 ? conditions.join(' AND ') : null
}

export async function migrateBatch ({ boss, models, data: { limit = BATCH_MAX_ITEMS_PER_JOB, values = {} } }) {
  console.log(`[migrateBatch] starting batch migration with limit ${limit}`)

  let result = {
    successCount: 0,
    failureCount: 0,
    failures: [],
    startTime: Date.now()
  }

  let processedTotal = 0
  let lastId = (values?.by === 'id' && values.fromId ? parseInt(values.fromId) - 1 : 0) || 0

  try {
    let hasMoreItems = false

    while (processedTotal < limit) {
      const customWhereClause = await buildCustomWhereClause({ values, models })
      console.log('customWhereClause', customWhereClause)

      const items = await models.$queryRaw`
        SELECT id, text
        FROM "Item"
        WHERE id > ${lastId}
          ${customWhereClause ? Prisma.raw(`AND (${customWhereClause})`) : Prisma.empty}
          ${values?.fullRefresh ? Prisma.empty : Prisma.raw('AND "lexicalState" IS NULL')}
          AND text IS NOT NULL
          AND TRIM(text) != ''
        ORDER BY id ASC
        LIMIT ${BATCH_SIZE}
      `

      if (items.length === 0) {
        console.log('[migrateBatch] no more items to migrate')
        hasMoreItems = false
        break
      }

      console.log(`[migrateBatch] processing batch of ${items.length} items starting from id ${items[0].id}`)

      result = await processBatch(items, models, result, values?.checkMedia)

      processedTotal += items.length
      lastId = items[items.length - 1].id

      // check if we've hit the limit but there might be more items
      if (processedTotal >= limit) {
        // peek
        const nextItems = await models.$queryRaw`
          SELECT id
          FROM "Item"
          WHERE id > ${lastId}
            ${customWhereClause ? Prisma.raw(`AND (${customWhereClause})`) : Prisma.empty}
            ${values?.fullRefresh ? Prisma.empty : Prisma.raw('AND "lexicalState" IS NULL')}
            AND text IS NOT NULL
            AND TRIM(text) != ''
          LIMIT 1
        `
        hasMoreItems = nextItems.length > 0
        break
      }

      if (processedTotal < limit) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS))
      }
    }

    const summary = getSummary(result)

    if (summary.totalProcessed > 0) {
      await models.lexicalBatchMigrationLog.create({
        data: {
          successCount: summary.successCount,
          failureCount: summary.failureCount,
          durationMs: summary.durationMs,
          summary: JSON.stringify(summary),
          createdAt: new Date()
        }
      })
    }

    // schedule next batch if there are more items
    if (hasMoreItems) {
      console.log(`[migrateBatch] scheduling next batch starting from id ${lastId + 1}`)

      await boss.send('migrateBatch', {
        limit,
        values: {
          ...values,
          // update fromId to continue from where we left off
          fromId: lastId + 1,
          by: 'id'
        }
      }, {
        retryLimit: 0,
        retryDelay: 0,
        startAfter: 5 // wait 5 seconds before starting next batch
      })

      summary.nextBatchScheduled = true
      summary.nextBatchStartsFromId = lastId + 1
    } else {
      console.log('[migrateBatch] all items migrated, no more batches to schedule')
      summary.allComplete = true
    }

    return summary
  } catch (error) {
    console.error('[migrateBatch] unexpected error:', error)
    throw error
  }
}
