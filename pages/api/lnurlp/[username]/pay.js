import models from '../../../../api/models'
import lnd from '../../../../api/lnd'
import { createInvoice } from 'ln-service'
import { lnurlPayDescriptionHashForUser, lnurlPayMetadataString, lnurlPayDescriptionHash } from '../../../../lib/lnurl'
import serialize from '../../../../api/resolvers/serial'
import { schnorr } from '@noble/curves/secp256k1'
import { createHash } from 'crypto'
import { datePivot } from '../../../../lib/time'
import { BALANCE_LIMIT_MSATS, INV_PENDING_LIMIT, LNURLP_COMMENT_MAX_LENGTH, USER_IDS_BALANCE_NO_LIMIT } from '../../../../lib/constants'
import { ssValidate, lud18PayerDataSchema } from '../../../../lib/validate'
import assertGofacYourself from '../../../../api/resolvers/ofac'

export default async ({ query: { username, amount, nostr, comment, payerdata: payerData }, headers }, res) => {
  const user = await models.user.findUnique({ where: { name: username } })
  if (!user) {
    return res.status(400).json({ status: 'ERROR', reason: `user @${username} does not exist` })
  }

  try {
    await assertGofacYourself({ models, headers })
    // if nostr, decode, validate sig, check tags, set description hash
    let description, descriptionHash, noteStr
    if (nostr) {
      noteStr = decodeURIComponent(nostr)
      const note = JSON.parse(noteStr)
      // It MUST have only one p tag
      const hasPTag = note.tags?.filter(t => t[0] === 'p').length === 1
      // It MUST have 0 or 1 e tags
      const hasETag = note.tags?.filter(t => t[0] === 'e').length <= 1
      // If there is an amount tag, it MUST be equal to the amount query parameter
      const eventAmount = note.tags?.find(t => t[0] === 'amount')?.[1]
      if (schnorr.verify(note.sig, note.id, note.pubkey) && hasPTag && hasETag && (!eventAmount || Number(eventAmount) === Number(amount))) {
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

    if (comment && comment.length > LNURLP_COMMENT_MAX_LENGTH) {
      return res.status(400).json({ status: 'ERROR', reason: `comment cannot exceed ${LNURLP_COMMENT_MAX_LENGTH} characters in length` })
    }

    let parsedPayerData
    if (payerData) {
      try {
        parsedPayerData = JSON.parse(payerData)
      } catch (err) {
        console.error('failed to parse payerdata', err)
        return res.status(400).json({ status: 'ERROR', reason: 'Invalid JSON supplied for payerdata parameter' })
      }

      try {
        await ssValidate(lud18PayerDataSchema, parsedPayerData)
      } catch (err) {
        console.error('error validating payer data', err)
        return res.status(400).json({ status: 'ERROR', reason: err.toString() })
      }

      // Update description hash to include the passed payer data
      const metadataStr = `${lnurlPayMetadataString(username)}${payerData}`
      descriptionHash = lnurlPayDescriptionHash(metadataStr)
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
      models.$queryRaw`SELECT * FROM create_invoice(${invoice.id}, NULL, ${invoice.request},
        ${expiresAt}::timestamp, ${Number(amount)}, ${user.id}::INTEGER, ${noteStr || description},
        ${comment || null}, ${parsedPayerData || null}::JSONB, ${INV_PENDING_LIMIT}::INTEGER,
        ${USER_IDS_BALANCE_NO_LIMIT.includes(Number(user.id)) ? 0 : BALANCE_LIMIT_MSATS})`)

    return res.status(200).json({
      pr: invoice.request,
      routes: []
    })
  } catch (error) {
    console.log(error)
    res.status(400).json({ status: 'ERROR', reason: 'could not generate invoice' })
  }
}
