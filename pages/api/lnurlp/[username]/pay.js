import models from '@/api/models'
import { lnurlPayLimits, lnurlPayMetadata, lnurlpVerifyUrl, sanitizeLud18PayerData } from '@/lib/lnurl'
import { schnorr } from '@noble/curves/secp256k1'
import { createHash } from 'crypto'
import { LNURLP_COMMENT_MAX_LENGTH } from '@/lib/constants'
import { formatMsats, toPositiveBigInt } from '@/lib/format'
import assertGofacYourself from '@/api/resolvers/ofac'
import { characterLength } from '@/lib/validate'
import { walletLogger } from '@/wallets/server'
import pay from '@/api/payIn'
import { isLndMaintenance, LND_MAINTENANCE_MESSAGE } from '@/api/lnd/maintenance'
import { createExternalReceiveInvoice } from '@/wallets/server/receive'

export default async ({ query: { username, amount, nostr, comment, payerdata: payerData }, headers }, res) => {
  if (isLndMaintenance()) {
    return res.status(503).json({ status: 'ERROR', reason: LND_MAINTENANCE_MESSAGE })
  }

  const user = await models.user.findUnique({ where: { name: username } })
  if (!user) {
    return res.status(400).json({ status: 'ERROR', reason: `user @${username} does not exist` })
  }

  const { minSendable, maxSendable } = lnurlPayLimits({ proxyReceive: user.proxyReceive })
  const amountMsats = Number(amount)
  if (!Number.isFinite(amountMsats) || amountMsats < Number(minSendable)) {
    return res.status(400).json({ status: 'ERROR', reason: `amount must be >= ${minSendable} msats` })
  }
  if (amountMsats > Number(maxSendable)) {
    return res.status(400).json({ status: 'ERROR', reason: `amount must be <= ${maxSendable} msats` })
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
    const { metadata, description, descriptionHash: metadataDescriptionHash } = lnurlPayMetadata(username)
    let descriptionHash = metadataDescriptionHash
    let descriptionHashPreimage = metadata
    let note
    let lud18Data
    if (nostr) {
      descriptionHashPreimage = decodeURIComponent(nostr)
      note = JSON.parse(descriptionHashPreimage)
      // It MUST have only one p tag
      const hasPTag = note.tags?.filter(t => t[0] === 'p').length === 1
      // It MUST have 0 or 1 e tags
      const hasETag = note.tags?.filter(t => t[0] === 'e').length <= 1
      // If there is an amount tag, it MUST be equal to the amount query parameter
      const eventAmount = note.tags?.find(t => t[0] === 'amount')?.[1]
      if (schnorr.verify(note.sig, note.id, note.pubkey) && hasPTag && hasETag && (!eventAmount || Number(eventAmount) === Number(amount))) {
        // override description hash
        descriptionHash = createHash('sha256').update(descriptionHashPreimage).digest('hex')
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

      descriptionHashPreimage = metadata + payerData
      descriptionHash = createHash('sha256').update(descriptionHashPreimage).digest('hex')
    }

    if (comment && characterLength(comment) > LNURLP_COMMENT_MAX_LENGTH) {
      return res.status(400).json({
        status: 'ERROR',
        reason: `comment cannot exceed ${LNURLP_COMMENT_MAX_LENGTH} characters in length`
      })
    }

    let bolt11
    let hash
    let canVerify = user.proxyReceive
    if (user.proxyReceive) {
      const { payInBolt11 } = await pay('PROXY_PAYMENT', {
        msats: toPositiveBigInt(amount),
        description,
        descriptionHash,
        comment: comment || '',
        lud18Data,
        ...(note && { descriptionHashPreimage, note })
      }, { models, me: user })

      if (!payInBolt11) throw new Error('could not generate invoice')
      bolt11 = payInBolt11.bolt11
      hash = payInBolt11.hash
    } else {
      const direct = await createExternalReceiveInvoice(models, {
        userId: user.id,
        msats: toPositiveBigInt(amount),
        description,
        descriptionHash,
        descriptionHashPreimage,
        requireDescriptionHash: !!nostr,
        sourceType: 'LN_ADDR',
        sourceValue: `${username}@stacker.news`,
        comment: comment || '',
        lud18Data,
        note
      })
      bolt11 = direct.bolt11
      hash = direct.invoice.id
      canVerify = direct.transaction.nextCheckAt != null
    }

    return res.status(200).json({
      pr: bolt11,
      routes: [],
      ...(canVerify && { verify: lnurlpVerifyUrl(username, hash) })
    })
  } catch (error) {
    console.log(error)
    logger.error(`${user.name}@stacker.news payment failed: ${error.message}`)
      .catch(err => console.error('failed to write lnurl payment failure log:', err))
    res.status(400).json({ status: 'ERROR', reason: 'could not generate invoice to customer\'s attached wallet' })
  }
}
