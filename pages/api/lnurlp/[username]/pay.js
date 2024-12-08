import models from '@/api/models'
import lnd from '@/api/lnd'
import { lnurlPayDescriptionHashForUser, lnurlPayMetadataString, lnurlPayDescriptionHash } from '@/lib/lnurl'
import { schnorr } from '@noble/curves/secp256k1'
import { createHash } from 'crypto'
import { LNURLP_COMMENT_MAX_LENGTH, MAX_INVOICE_DESCRIPTION_LENGTH } from '@/lib/constants'
import { validateSchema, toPositiveBigInt } from '@/lib/format'
import assertGofacYourself from '@/api/resolvers/ofac'
import performPaidAction from '@/api/paidAction'
import { lud18PayerDataSchema } from '@/lib/validate'

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
        description = 'zap'
        descriptionHash = createHash('sha256').update(noteStr).digest('hex')
      } else {
        res.status(400).json({ status: 'ERROR', reason: 'invalid NIP-57 note' })
        return
      }
    } else {
      description = `Paying @${username} on stacker.news`
      description += comment ? `: ${comment}` : '.'
      description = description.slice(0, MAX_INVOICE_DESCRIPTION_LENGTH)
      descriptionHash = lnurlPayDescriptionHashForUser(username)
    }

    if (!amount || amount < 1000) {
      return res.status(400).json({ status: 'ERROR', reason: 'amount must be >=1000 msats' })
    }

    if (comment?.length > LNURLP_COMMENT_MAX_LENGTH) {
      return res.status(400).json({
        status: 'ERROR',
        reason: `comment cannot exceed ${LNURLP_COMMENT_MAX_LENGTH} characters in length`
      })
    }

    let parsedPayerData
    if (payerData) {
      try {
        parsedPayerData = JSON.parse(payerData)
      } catch (err) {
        console.error('failed to parse payerdata', err)
        return res.status(400).json({
          status: 'ERROR',
          reason: 'Invalid JSON supplied for payerdata parameter'
        })
      }

      try {
        await validateSchema(lud18PayerDataSchema, parsedPayerData)
      } catch (err) {
        console.error('error validating payer data', err)
        return res.status(400).json({ status: 'ERROR', reason: err.toString() })
      }

      // Update description hash to include the passed payer data
      const metadataStr = `${lnurlPayMetadataString(username)}${payerData}`
      descriptionHash = lnurlPayDescriptionHash(metadataStr)
    }

    // generate invoice
    const { invoice } = await performPaidAction('RECEIVE', {
      msats: toPositiveBigInt(amount),
      description,
      descriptionHash,
      comment: comment || '',
      lud18Data: parsedPayerData,
      noteStr
    }, { models, lnd, me: user })

    if (!invoice?.bolt11) throw new Error('could not generate invoice')

    return res.status(200).json({
      pr: invoice.bolt11,
      routes: [],
      verify: invoice.hash ? `${process.env.NEXT_PUBLIC_URL}/api/lnurlp/${username}/verify/${invoice.hash}` : undefined
    })
  } catch (error) {
    console.log(error)
    res.status(400).json({ status: 'ERROR', reason: 'could not generate invoice' })
  }
}
