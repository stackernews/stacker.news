import { getPublicKey } from 'nostr'
import models from '../../../../api/models'
import { lnurlPayMetadataString } from '../../../../lib/lnurl'
import { LNURLP_COMMENT_MAX_LENGTH } from '../../../../lib/constants'

export default async ({ query: { username } }, res) => {
  const user = await models.user.findUnique({ where: { name: username } })
  if (!user) {
    return res.status(400).json({ status: 'ERROR', reason: `user @${username} does not exist` })
  }

  return res.status(200).json({
    callback: `${process.env.PUBLIC_URL}/api/lnurlp/${username}/pay`, // The URL from LN SERVICE which will accept the pay request parameters
    minSendable: 1000, // Min amount LN SERVICE is willing to receive, can not be less than 1 or more than `maxSendable`
    maxSendable: 1000000000,
    metadata: lnurlPayMetadataString(username), // Metadata json which must be presented as raw string here, this is required to pass signature verification at a later step
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
