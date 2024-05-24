import { createMentions } from '@/api/resolvers/item'
import { notifyTerritorySubscribers, notifyUserSubscribers } from '@/lib/webPush'

export async function finalizeAction ({ data: { hash }, models }) {
  const invoice = await models.invoice.findUnique({ where: { hash } })

  if (invoice.confirmedAt) {
    await handleAction({ data: invoice, models })
    return
  }

  const queries = await actionErrorQueries({ data: invoice, models })
  if (queries.length === 0) return
  await models.$transaction(queries)
}

export async function handleAction ({ data: { actionType, actionId, actionData }, models }) {
  if (!actionType || !actionId) return

  if (actionType === 'ITEM') {
    // update item status from PENDING to ACTIVE
    // and run queries which were skipped during creation

    const item = await models.item.findUnique({ where: { id: actionId } })

    if (item.status !== 'PENDING') {
      return
    }

    await models.$executeRaw`SELECT invoice_action(${actionType}, ${actionId}, ${actionData})`
    await createMentions(item, models)
    notifyUserSubscribers({ models, item })
    notifyTerritorySubscribers({ models, item })
  }
}

export function actionErrorQueries ({ data: { actionType, actionId }, models }) {
  if (!actionType || !actionId) return []

  if (actionType === 'ITEM') {
    return [
      models.$queryRaw`
        UPDATE "Item"
        SET status = 'FAILED'
        WHERE id = ${actionId} AND status = 'PENDING'`,
      models.$queryRaw`DELETE FROM "Reminder" WHERE "itemId" = ${actionId}`,
      models.$queryRaw`DELETE FROM pgboss.job WHERE name = 'reminder' AND data->>'itemId' = ${actionId}::text`,
      models.$queryRaw`DELETE FROM pgboss.job WHERE name = 'deleteItem' AND data->>'id' = ${actionId}::text`
    ]
  }

  return []
}
