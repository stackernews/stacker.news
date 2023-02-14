import models from '../../../../api/models'
import lnd from '../../../../api/lnd'
import { createInvoice } from 'ln-service'
import { lnurlPayDescriptionHashForUser } from '../../../../lib/lnurl'
import serialize from '../../../../api/resolvers/serial'
import * as secp256k1 from '@noble/secp256k1'
import { createHash } from 'crypto'

export default async ({ query: { username, amount, nostr } }, res) => {
  const user = await models.user.findUnique({ where: { name: username } })
  if (!user) {
    return res.status(400).json({ status: 'ERROR', reason: `user @${username} does not exist` })
  }
  try {
  // if nostr, decode, validate sig, check tags, set description hash
    let description, descriptionHash
    if (nostr) {
      const noteStr = decodeURI(nostr)
      const note = JSON.parse(noteStr)
      const hasPTag = note.tags?.filter(t => t[0] === 'p').length >= 1
      const hasETag = note.tags?.filter(t => t[0] === 'e').length <= 1
      if (await secp256k1.schnorr.verify(note.sig, note.id, note.pubkey) &&
      hasPTag && hasETag) {
        description = user.hideInvoiceDesc ? undefined : `${amount} msats for @${user.name} on stacker.news via NIP-57`
        descriptionHash = createHash('sha256').update(noteStr).digest('hex')
      } else {
        res.status(400).json({ status: 'ERROR', reason: 'invalid NIP-57 note' })
        return
      }
    } else {
      description = user.hideInvoiceDesc ? undefined : `${amount} msats for @${user.name} on stacker.news`
      descriptionHash = lnurlPayDescriptionHashForUser(username)
    }

    if (!amount || amount < 1000) {
      return res.status(400).json({ status: 'ERROR', reason: 'amount must be >=1000 msats' })
    }

    // generate invoice
    const expiresAt = new Date(new Date().setMinutes(new Date().getMinutes() + 1))
    const invoice = await createInvoice({
      description: description,
      description_hash: descriptionHash,
      lnd,
      mtokens: amount,
      expires_at: expiresAt
    })

    await serialize(models,
      models.$queryRaw`SELECT * FROM create_invoice(${invoice.id}, ${invoice.request},
        ${expiresAt}, ${Number(amount)}, ${user.id})`)

    return res.status(200).json({
      pr: invoice.request,
      routes: []
    })
  } catch (error) {
    console.log(error)
    res.status(400).json({ status: 'ERROR', reason: error.message })
  }
}
