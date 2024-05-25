export async function finalizeAction ({ data: { hash }, models }) {
  const invoice = await models.invoice.findUnique({ where: { hash } })

  const { actionType, actionId } = invoice

  if (actionType === 'ITEM') {
    const queries = await actionErrorQueries({ data: { actionType, actionId }, models })
    await models.$transaction(queries)
  }
}

export async function actionErrorQueries ({ data: { actionType, actionId }, models }) {
  if (!actionType || !actionId) return []

  if (actionType === 'ITEM') {
    const item = await models.item.findUnique({ where: { id: actionId } })

    if (item.status !== 'PENDING') return []

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
