import { handleActionError } from './wallet'

export async function finalizeAction ({ data: { type, id }, models }) {
  const queries = handleActionError({ data: { actionType: type, actionId: id }, models })
  if (queries.length === 0) return

  await models.$transaction(queries)
}

export async function handleAction ({ data: { msatsReceived, actionType, actionId, actionData }, models }) {
  if (!actionType || !actionId) return

  if (actionType === 'ITEM') {
    // update item status from PENDING to ACTIVE
    // and run queries which were skipped during creation

    const { cost } = actionData
    const item = await models.item.findUnique({ where: { id: actionId } })

    await serialize([
      models.item.update({
        where: {
          id: item.id
        },
        data: {
          status: 'ACTIVE'
        }
      }),
      models.user.update({
        where: {
          id: item.userId
        },
        data: {
          msats: {
            decrement: cost
          }
        }
      }),
      // run skipped queries
      models.itemAct.create({
        data: { msats: cost, itemId: item.id, userId: item.userId, act: 'FEE' }
      }),
      item.boost > 0 && models.$executeRaw(`SELECT item_act(${item.id}::INTEGER, ${item.userId}::INTEGER, 'BOOST'::"ItemActType", ${item.boost}::INTEGER)`),
      item.maxBid && models.$executeRaw(`SELECT run_auction(${item.id}::INTEGER)`)
    ], { models })
  }
}

export function handleActionError ({ data: { actionType, actionId }, models }) {
  if (!actionType || !actionId) return []

  if (actionType === 'ITEM') {
    return [
      models.$queryRaw`
        UPDATE "Item"
        SET status = 'FAILED'
        WHERE id = ${actionId} AND status = 'PENDING'`
    ]
  }

  return []
}
