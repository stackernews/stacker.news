import serialize from '@/api/resolvers/serial'

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

    const { cost } = actionData
    const item = await models.item.findUnique({ where: { id: actionId } })

    if (item.status !== 'PENDING') {
      return
    }

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

export function actionErrorQueries ({ data: { actionType, actionId }, models }) {
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
