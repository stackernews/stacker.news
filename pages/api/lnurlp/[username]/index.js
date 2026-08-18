import { getPublicKey } from 'nostr'
import models from '@/api/models'
import { lnurlPayMetadata, lnurlpCallbackUrl } from '@/lib/lnurl'
import {
  LNURLP_COMMENT_MAX_LENGTH,
  MAX_WALLET_INVOICE_SATS,
  MIN_RECEIVE_MSATS,
  PROXY_PAYER_MIN_MSATS,
  PROXY_PAYER_MAX_MSATS
} from '@/lib/constants'
import { isLndMaintenance, LND_MAINTENANCE_MESSAGE } from '@/api/lnd/maintenance'

export default async ({ query: { username } }, res) => {
  if (isLndMaintenance()) {
    return res.status(503).json({ status: 'ERROR', reason: LND_MAINTENANCE_MESSAGE })
  }

  const user = await models.user.findUnique({ where: { name: username } })
  if (!user) {
    return res.status(400).json({ status: 'ERROR', reason: `user @${username} does not exist` })
  }

  const { metadata } = lnurlPayMetadata(username)
  const minSendable = user.proxyReceive ? PROXY_PAYER_MIN_MSATS : MIN_RECEIVE_MSATS
  const maxSendable = user.proxyReceive
    ? PROXY_PAYER_MAX_MSATS
    : BigInt(MAX_WALLET_INVOICE_SATS) * 1000n
  return res.status(200).json({
    callback: lnurlpCallbackUrl(username), // The URL from LN SERVICE which will accept the pay request parameters
    minSendable: Number(minSendable), // Min amount LN SERVICE is willing to receive, can not be less than 1 or more than `maxSendable`
    maxSendable: Number(maxSendable), // Max amount LN SERVICE is willing to receive
    metadata, // Metadata json which must be presented as raw string here, this is required to pass signature verification at a later step
    commentAllowed: LNURLP_COMMENT_MAX_LENGTH, // LUD-12 Comments for payRequests https://github.com/lnurl/luds/blob/luds/12.md
    payerData: { // LUD-18 payer data for payRequests https://github.com/lnurl/luds/blob/luds/18.md
      name: { mandatory: false },
      pubkey: { mandatory: false },
      identifier: { mandatory: false },
      email: { mandatory: false }
    },
    tag: 'payRequest', // Type of LNURL
    nostrPubkey: process.env.NOSTR_PRIVATE_KEY ? getPublicKey(process.env.NOSTR_PRIVATE_KEY) : undefined,
    allowsNostr: !!process.env.NOSTR_PRIVATE_KEY
  })
}
