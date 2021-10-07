import models from '../../../../api/models'
import lnd from '../../../../api/lnd'
import { createInvoice } from 'ln-service'

export default async ({ query: { username, amount } }, res) => {
  const user = await models.user.findUnique({ where: { name: username } })
  if (!user) {
    return res.status(400).json({ status: 'ERROR', reason: `user @${username} does not exist` })
  }

  if (!amount || amount < 1000) {
    return res.status(400).json({ status: 'ERROR', reason: 'amount must be >=1000 msats' })
  }

  // generate invoice
  const expiresAt = new Date(new Date().setHours(new Date().getHours() + 3))
  const description = `${amount} msats for @${user.name} on stacker.news`
  try {
    const invoice = await createInvoice({
      description,
      lnd,
      mtokens: amount,
      expires_at: expiresAt
    })

    const data = {
      hash: invoice.id,
      bolt11: invoice.request,
      expiresAt: expiresAt,
      msatsRequested: Number(amount),
      user: {
        connect: {
          id: user.id
        }
      }
    }

    await models.invoice.create({ data })

    return res.status(200).json({
      pr: invoice.request
    })
  } catch (error) {
    console.log(error)
    res.status(400).json({ status: 'ERROR', reason: 'failed to create invoice' })
  }
}
