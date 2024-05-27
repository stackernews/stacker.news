export const anonable = true
export const peer2peerable = false
export const supportsPessimism = true
export const supportsOptimism = true

export async function getCost ({ sats }) {
  return BigInt(sats) * BigInt(1000)
}

export async function performStatements ({ invoiceId, uploadIds, itemForwards, costMsats, boostMsats, ...data }, { me, models }) {
  return [
    models.upload.updateMany({
      where: { id: { in: uploadIds } },
      data: { invoiceId, actionInvoiceState: 'PENDING' }
    }),
    models.item.create({
      data: {
        ...data,
        invoiceId,
        boost: boostMsats,
        actionInvoiceState: 'PENDING'
      },
      connect: {
        threadSubscription: {
          createMany: [{
            userId: me.id
          }, itemForwards.map(({ userId }) => ({ userId }))]
        },
        itemForwards: {
          createMany: itemForwards
        },
        pollOptions: {
          createMany: data.pollOptions
        },
        itemUploads: {
          updateMany: uploadIds.map(id => ({ uploadId: id }))
        },
        itemAct: {
          createMany: [{
            msats: costMsats - boostMsats,
            act: 'FEE',
            invoiceActionState: 'PENDING'
          },
          {
            msats: boostMsats,
            act: 'BOOST',
            invoiceActionState: 'PENDING'
          }]
        }
      }
    })
  ]
}

export async function onPaidStatements ({ invoice }, { models }) {
  const item = await models.item.findFirst({ where: { invoiceId: invoice.id } })

  return [
    models.itemAct.update({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } }),
    models.item.update({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } }),
    models.upload.updateMany({ where: { invoiceId: invoice.id }, data: { actionInvoiceState: 'PAID' } }),
    models.$executeRaw`SELECT ncomments_after_comment(${item.id}::INTEGER)`
  ]
}
