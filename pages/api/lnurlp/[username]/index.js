import models from '../../../../api/models'
import { lnurlPayMetadataString } from '../../../../lib/lnurl'

export default async ({ query: { username } }, res) => {
  const user = await models.user.findUnique({ where: { name: username } })
  if (!user) {
    return res.status(400).json({ status: 'ERROR', reason: `user @${username} does not exist` })
  }

  return res.status(200).json({
    callback: `${process.env.SELF_URL}/api/lnurlp/${username}/pay`, // The URL from LN SERVICE which will accept the pay request parameters
    minSendable: 1000, // Min amount LN SERVICE is willing to receive, can not be less than 1 or more than `maxSendable`
    maxSendable: Number.MAX_SAFE_INTEGER,
    metadata: lnurlPayMetadataString(username), // Metadata json which must be presented as raw string here, this is required to pass signature verification at a later step
    tag: 'payRequest' // Type of LNURL
  })
}
