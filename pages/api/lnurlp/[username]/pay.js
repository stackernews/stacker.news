import models from '../../../../api/models'
import lnd from '../../../../api/lnd'
import { createInvoice } from 'ln-service'
import { lnurlPayDescriptionHash } from '../../../../lib/lnurl'
import serialize from '../../../../api/resolvers/serial'

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
  const descriptionHash = lnurlPayDescriptionHash(username)
  try {
    const invoice = await createInvoice({
      description,
      description_hash: descriptionHash,
      lnd,
      mtokens: amount,
      expires_at: expiresAt
    })

    await serialize(models,
      models.$queryRaw`SELECT * FROM create_invoice(${invoice.id}, ${invoice.request},
        ${expiresAt}, ${amount * 1000}, ${user.id})`)

    return res.status(200).json({
      pr: invoice.request
    })
  } catch (error) {
    console.log(error)
    res.status(400).json({ status: 'ERROR', reason: 'failed to create invoice' })
  }
}
