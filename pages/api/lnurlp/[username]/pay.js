import models from '@/api/models'
import { lnurlPayMetadata, lnurlpVerifyUrl, sanitizeLud18PayerData } from '@/lib/lnurl'
import { schnorr } from '@noble/curves/secp256k1'
import { createHash } from 'crypto'
import { LNURLP_COMMENT_MAX_LENGTH, PROXY_PAYER_MIN_MSATS, PROXY_PAYER_MAX_MSATS } from '@/lib/constants'
import { formatMsats, toPositiveBigInt } from '@/lib/format'
import assertGofacYourself from '@/api/resolvers/ofac'
import { characterLength } from '@/lib/validate'
import { walletLogger } from '@/wallets/server'
import pay from '@/api/payIn'

export default async ({ query: { username, amount, nostr, comment, payerdata: payerData }, headers }, res) => {
  const user = await models.user.findUnique({ where: { name: username } })
  if (!user) {
    return res.status(400).json({ status: 'ERROR', reason: `user @${username} does not exist` })
  }

  const canonicalUsername = user.name
  const amountMsats = Number(amount)
  if (!Number.isFinite(amountMsats) || amountMsats < Number(PROXY_PAYER_MIN_MSATS)) {
    return res.status(400).json({ status: 'ERROR', reason: `amount must be >= ${PROXY_PAYER_MIN_MSATS} msats` })
  }
  if (amountMsats > Number(PROXY_PAYER_MAX_MSATS)) {
    return res.status(400).json({ status: 'ERROR', reason: `amount must be <= ${PROXY_PAYER_MAX_MSATS} msats` })
  }
  if (amountMsats % 1000 !== 0) {
    return res.status(400).json({ status: 'ERROR', reason: 'amount must be a whole number of sats' })
  }

  const logger = walletLogger({ models, userId: user.id })
  logger.info(`${user.name}@stacker.news payment attempt`, { amount: formatMsats(amount), nostr, comment })
    .catch(err => console.error('failed to write lnurl payment attempt log:', err))

  try {
    await assertGofacYourself({ models, headers })
    // if nostr, decode, validate sig, check tags, set description hash
    let { description, descriptionHash } = lnurlPayMetadata(canonicalUsername)
    let noteStr
    let lud18Data
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
        // override description hash
        descriptionHash = createHash('sha256').update(noteStr).digest('hex')
      } else {
        res.status(400).json({ status: 'ERROR', reason: 'invalid NIP-57 note' })
        return
      }
    } else if (payerData) {
      let rawLud18Data
      try {
        rawLud18Data = JSON.parse(payerData)
      } catch (err) {
        console.error('failed to parse payerdata', err)
        return res.status(400).json({
          status: 'ERROR',
          reason: 'Invalid JSON supplied for payerdata parameter'
        })
      }

      try {
        lud18Data = await sanitizeLud18PayerData(rawLud18Data)
      } catch (err) {
        console.error('error validating payer data', err)
        return res.status(400).json({ status: 'ERROR', reason: err.toString() })
      }

      descriptionHash = createHash('sha256').update(lnurlPayMetadata(canonicalUsername).metadata + payerData).digest('hex')
    }

    if (comment && characterLength(comment) > LNURLP_COMMENT_MAX_LENGTH) {
      return res.status(400).json({
        status: 'ERROR',
        reason: `comment cannot exceed ${LNURLP_COMMENT_MAX_LENGTH} characters in length`
      })
    }

    // generate invoice
    const { payInBolt11 } = await pay('PROXY_PAYMENT', {
      msats: toPositiveBigInt(amount),
      description,
      descriptionHash,
      comment: comment || '',
      lud18Data,
      noteStr
    }, { models, me: user })

    if (!payInBolt11) throw new Error('could not generate invoice')

    return res.status(200).json({
      pr: payInBolt11.bolt11,
      routes: [],
      verify: lnurlpVerifyUrl(canonicalUsername, payInBolt11.hash)
    })
  } catch (error) {
    console.log(error)
    logger.error(`${user.name}@stacker.news payment failed: ${error.message}`)
      .catch(err => console.error('failed to write lnurl payment failure log:', err))
    res.status(400).json({ status: 'ERROR', reason: 'could not generate invoice to customer\'s attached wallet' })
  }
}
