import { msatsToSats, satsToMsats } from '@/lib/format'

export const anonable = false
export const supportsPessimism = false
export const supportsOptimism = true

export async function getCost ({ sats }) {
  return satsToMsats(sats)
}

export async function perform ({ invoiceId, sats, id: itemId, ...args }, { me, cost, tx }) {
  itemId = parseInt(itemId)

  let invoiceData = {}
  if (invoiceId) {
    invoiceData = { invoiceId, invoiceActionState: 'PENDING' }
    // store a reference to the item in the invoice
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { actionId: itemId }
    })
  }

  const act = await tx.itemAct.create({ data: { msats: cost, itemId, userId: me.id, act: 'BOOST', ...invoiceData } })

  const [{ path }] = await tx.$queryRaw`
    SELECT ltree2text(path) as path FROM "Item" WHERE id = ${itemId}::INTEGER`
  return { id: itemId, sats, act: 'BOOST', path, actId: act.id }
}

export async function retry ({ invoiceId, newInvoiceId }, { tx, cost }) {
  await tx.itemAct.updateMany({ where: { invoiceId }, data: { invoiceId: newInvoiceId, invoiceActionState: 'PENDING' } })
  const [{ id, path }] = await tx.$queryRaw`
    SELECT "Item".id, ltree2text(path) as path
    FROM "Item"
    JOIN "ItemAct" ON "Item".id = "ItemAct"."itemId"
    WHERE "ItemAct"."invoiceId" = ${newInvoiceId}::INTEGER`
  return { id, sats: msatsToSats(cost), act: 'BOOST', path }
}

export async function onPaid ({ invoice, actId }, { models, tx }) {
  let itemAct
  if (invoice) {
    await tx.itemAct.updateMany({
      where: { invoiceId: invoice.id },
      data: {
        invoiceActionState: 'PAID'
      }
    })
    itemAct = await tx.itemAct.findFirst({ where: { invoiceId: invoice.id } })
  } else if (actId) {
    itemAct = await tx.itemAct.findFirst({ where: { id: { in: actId } } })
  } else {
    throw new Error('No invoice or actId')
  }

  // increment boost on item
  await tx.item.update({
    where: { id: itemAct.itemId },
    data: {
      boost: { increment: msatsToSats(itemAct.msats) }
    }
  })

  await tx.$executeRaw`
    INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter, expirein)
    VALUES ('expireBoost', jsonb_build_object('id', ${itemAct.itemId}::INTEGER), 21, true,
              now() + interval '30 days', interval '40 days')`
}

export async function onFail ({ invoice }, { tx }) {
  await tx.itemAct.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } })
}

export async function describe ({ id: itemId, sats }, { actionId, cost }) {
  return `SN: boost ${sats ?? msatsToSats(cost)} sats to #${itemId ?? actionId}`
}
