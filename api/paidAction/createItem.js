export const anonable = true
export const supportsPessimism = true
export const supportsOptimism = true

export async function getCost () {
  // TODO
  return null
}

export async function performStatements (
  { invoiceId, uploadIds = [], itemForwards = [], pollOptions = [], boost = 0, ...data },
  { me, models, cost }) {
  const boostMsats = BigInt(boost) * BigInt(1000)

  const itemActs = []
  if (boostMsats > 0) {
    itemActs.push({
      msats: boostMsats, act: 'BOOST', invoiceId, invoiceActionState: 'PENDING', userId: me.id
    })
  }
  if (cost > 0) {
    itemActs.push({
      msats: cost - boostMsats, act: 'FEE', invoiceId, invoiceActionState: 'PENDING', userId: me.id
    })
  }

  return [
    models.upload.updateMany({
      where: { id: { in: uploadIds } },
      data: { invoiceId, actionInvoiceState: 'PENDING' }
    }),
    models.item.create({
      data: {
        ...data,
        boost,
        invoiceId,
        actionInvoiceState: 'PENDING'
      },
      threadSubscription: {
        createMany: [
          { userId: me.id },
          ...itemForwards.map(({ userId }) => ({ userId }))
        ]
      },
      itemForwards: {
        createMany: itemForwards
      },
      pollOptions: {
        createMany: pollOptions
      },
      itemUploads: {
        connect: uploadIds.map(id => ({ uploadId: id }))
      },
      itemAct: {
        createMany: itemActs
      }
    })
  ]
  // TODO: run_auction for job or just remove jobs?
}

export async function resultsToResponse (results, args, context) {
  // TODO
  return null
}

export async function onPaidStatements ({ invoice }, { models }) {
  const item = await models.item.findFirst({ where: { invoiceId: invoice.id } })

  return [
    models.itemAct.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } }),
    models.item.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } }),
    models.upload.updateMany({ where: { invoiceId: invoice.id }, data: { actionInvoiceState: 'PAID' } }),
    // TODO: this doesn't work because it's a trigger
    models.$executeRaw`SELECT ncomments_after_comment(${item.id}::INTEGER)`
    // TODO: create mentions
    // TODO: bot stuff
    // TODO: notifications
  ]
}

export async function onFailedStatements ({ invoice }, { models }) {
  return [
    models.itemAct.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } }),
    models.item.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } }),
    models.upload.updateMany({ where: { invoiceId: invoice.id }, data: { actionInvoiceState: 'FAILED' } })
  ]
}

export async function describe ({ parentId }, context) {
  return `SN: create ${parentId ? `reply to #${parentId}` : 'post'}`
}
