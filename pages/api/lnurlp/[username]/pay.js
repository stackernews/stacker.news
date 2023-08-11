import models from '../../../../api/models'
import lnd from '../../../../api/lnd'
import { createInvoice } from 'ln-service'
import { lnurlPayDescriptionHashForUser } from '../../../../lib/lnurl'
import serialize from '../../../../api/resolvers/serial'
import { schnorr } from '@noble/curves/secp256k1'
import { createHash } from 'crypto'
import { datePivot } from '../../../../lib/time'
import { BALANCE_LIMIT_MSATS, INV_PENDING_LIMIT } from '../../../../lib/constants'

export default async ({ query: { username, amount, nostr } }, res) => {
  const user = await models.user.findUnique({ where: { name: username } })
  if (!user) {
    return res.status(400).json({ status: 'ERROR', reason: `user @${username} does not exist` })
  }
  try {
    // if nostr, decode, validate sig, check tags, set description hash
    let description, descriptionHash, noteStr
    if (nostr) {
      noteStr = decodeURIComponent(nostr)
      const note = JSON.parse(noteStr)
      const hasPTag = note.tags?.filter(t => t[0] === 'p').length >= 1
      const hasETag = note.tags?.filter(t => t[0] === 'e').length <= 1
      if (schnorr.verify(note.sig, note.id, note.pubkey) && hasPTag && hasETag) {
        description = user.hideInvoiceDesc ? undefined : 'zap'
        descriptionHash = createHash('sha256').update(noteStr).digest('hex')
      } else {
        res.status(400).json({ status: 'ERROR', reason: 'invalid NIP-57 note' })
        return
      }
    } else {
      description = user.hideInvoiceDesc ? undefined : `Funding @${username} on stacker.news`
      descriptionHash = lnurlPayDescriptionHashForUser(username)
    }

    if (!amount || amount < 1000) {
      return res.status(400).json({ status: 'ERROR', reason: 'amount must be >=1000 msats' })
    }

    // generate invoice
    const expiresAt = datePivot(new Date(), { minutes: 1 })
    const invoice = await createInvoice({
      description,
      description_hash: descriptionHash,
      lnd,
      mtokens: amount,
      expires_at: expiresAt
    })

    await serialize(models,
      models.$queryRaw`SELECT * FROM create_invoice(${invoice.id}, ${invoice.request},
        ${expiresAt}::timestamp, ${Number(amount)}, ${user.id}::INTEGER, ${noteStr || description},
        ${INV_PENDING_LIMIT}::INTEGER, ${BALANCE_LIMIT_MSATS})`)

    return res.status(200).json({
      pr: invoice.request,
      routes: []
    })
  } catch (error) {
    console.log(error)
    res.status(400).json({ status: 'ERROR', reason: error.message })
  }
}
