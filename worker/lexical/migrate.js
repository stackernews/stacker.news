import { prepareLexicalState } from '@/lib/lexical/utils/server/interpolator'
import { lexicalHTMLGenerator } from '@/lib/lexical/utils/server/html'
import { Prisma } from '@prisma/client'

const PARTITION_COUNT = 10 // items distributed across n partitions (e.g. 100 items / 10 partitions = 10 items per partition)
const PARTITION_FETCH_SIZE = 1000 // items fetched per partition batch (e.g. 1000 items per batch)
const PARTITION_CONCURRENCY = 5 // items processed concurrently per batch (e.g. 5 items per batch)
const PARTITION_DELAY_MS = 100 // delay between partition batches (e.g. 100ms between batches)

async function addMigrationError ({ itemId, type, message, models }) {
  await models.lexicalMigrationLog.upsert({
    where: { itemId },
    create: { itemId, type, message, retryCount: 1, createdAt: new Date() },
    update: {
      message,
      retryCount: { increment: 1 },
      updatedAt: new Date()
    }
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

    if (!lexicalState || migrationError) {
      await addMigrationError({
        itemId,
        type: 'LEXICAL_CONVERSION',
        message: migrationError?.message || 'unknown error',
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

    if (!html || htmlError) {
      await addMigrationError({
        itemId,
        type: 'HTML_GENERATION',
        message: htmlError?.message || 'unknown error',
        models
      })

      return {
        success: false,
        itemId,
        error: htmlError?.message || 'unknown error'
      }
    }

    await models.$transaction(async (tx) => {
      // using updateMany to prevent errors in race conditions
      // this way we can use count to check if the item was already migrated
      const updated = await tx.item.updateMany({
        where: {
          id: itemId,
          // multiple workers may be running this
          // for idempotency, only update if not already migrated
          ...(fullRefresh ? {} : { lexicalState: { equals: Prisma.AnyNull } })
        },
        data: {
          lexicalState,
          html
        }
      })

      if (updated.count === 0) {
        return {
          success: true,
          skipped: true,
          itemId,
          message: 'already migrated'
        }
      }

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

export async function distributedMigration ({ boss, models, data }) {
  const { totalPartitions = PARTITION_COUNT, checkMedia = false } = data || {}
  console.log('[distributedMigration] analyzing items for migration...')

  const stats = await models.$queryRaw`
    SELECT
      MIN(id) as min_id,
      MAX(id) as max_id,
      COUNT(*) as total
    FROM "Item"
    WHERE "lexicalState" IS NULL
      AND text IS NOT NULL
      AND TRIM(text) != ''
  `

  const minId = Number(stats[0].min_id)
  const maxId = Number(stats[0].max_id)
  const total = Number(stats[0].total)

  if (!total || total === 0) {
    console.log('[distributedMigration] no items to migrate')
    return { success: true, message: 'no items to migrate', totalPartitions: 0 }
  }

  const idRange = Math.ceil((maxId - minId) / totalPartitions)
  const itemsPerPartition = Math.ceil(total / totalPartitions)

  console.log(`[distributedMigration] found ${total} items to migrate in ${totalPartitions} partitions`)
  console.log(`[distributedMigration] range per partition: ${idRange}, each partition will process ${itemsPerPartition} items`)

  // now we create many small partition jobs, we may have 3 workers that pgboss can distribute to
  const jobs = []
  for (let i = 0; i < totalPartitions; i++) {
    const fromId = minId + (i * idRange)
    const toId = minId + ((i + 1) * idRange)
    jobs.push(
      boss.send(
        'migratePartition',
        { fromId, toId, partition: i + 1, totalPartitions, checkMedia },
        {
          singletonKey: `migrate-partition-${i}`,
          retryLimit: 3,
          retryDelay: 60,
          retryBackoff: true
        }
      )
    )
  }

  await Promise.all(jobs)
  console.log(`[distributedMigration] ${totalPartitions} partitions scheduled`)

  return {
    success: true,
    totalPartitions,
    totalItems: Number(total),
    itemsPerPartition,
    idRange: { min: Number(minId), max: Number(maxId) }
  }
}

export async function migratePartition ({ models, data }) {
  const { fromId, toId, partition, totalPartitions, checkMedia = false } = data

  console.log(`[partition ${partition}/${totalPartitions}] processing range ${fromId}-${toId}...`)

  let result = {
    partition,
    totalPartitions,
    fromId,
    toId,
    successCount: 0,
    failureCount: 0,
    failures: [],
    startTime: Date.now()
  }

  let lastId = fromId - 1
  let batchNumber = 0

  try {
    while (true) {
      batchNumber++

      const items = await models.$queryRaw`
        SELECT id, text
        FROM "Item"
        WHERE id > ${lastId}
          AND id <= ${toId}
          AND text IS NOT NULL AND TRIM(text) != ''
          AND "lexicalState" IS NULL
        ORDER BY id ASC
        LIMIT ${PARTITION_FETCH_SIZE}
      `

      if (items.length === 0) {
        console.log(`[partition ${partition}/${totalPartitions}] completed (${batchNumber} batches)`)
        break
      }

      console.log(`[partition ${partition}/${totalPartitions}] processing batch ${batchNumber} containing ${items.length} items`)

      result = await processPartitionBatch(items, models, result, checkMedia)

      lastId = items[items.length - 1].id

      await new Promise(resolve => setTimeout(resolve, PARTITION_DELAY_MS))
    }

    const summary = getSummary(result)
    await models.lexicalBatchMigrationLog.create({
      data: {
        successCount: summary.successCount,
        failureCount: summary.failureCount,
        durationMs: summary.durationMs,
        summary: JSON.stringify({
          ...summary,
          partition,
          totalPartitions,
          fromId,
          toId,
          batches: batchNumber
        })
      }
    })

    console.log(
      `[partition ${partition}/${totalPartitions}] completed:`,
      `${summary.successCount} successes, ${summary.failureCount} failures`,
      `(${summary.durationMs}ms total)`
    )

    return summary
  } catch (error) {
    console.error(`[partition ${partition}/${totalPartitions}] unexpected error:`, error)
    throw error
  }
}

async function processPartitionBatch (items, models, result, checkMedia) {
  let currentResult = result

  for (let i = 0; i < items.length; i += PARTITION_CONCURRENCY) {
    const chunk = items.slice(i, i + PARTITION_CONCURRENCY)

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

    for (const chunkResult of chunkResults) {
      if (chunkResult.success) {
        currentResult = logSuccess(currentResult)
      } else if (chunkResult.success === false) {
        currentResult = logFailure(currentResult, chunkResult.itemId, chunkResult.error)
      }
    }
  }

  return currentResult
}
