import { USER_ID, AWS_S3_URL_REGEXP } from '@/lib/constants'
import { msatsToSats } from '@/lib/format'

export default {
  Query: {
    imageFeesInfo: async (parent, { s3Keys }, { models, me }) => {
      return imageFeesInfo(s3Keys, { models, me })
    }
  }
}

export function uploadIdsFromText (text, { models }) {
  if (!text) return null
  return [...text.matchAll(AWS_S3_URL_REGEXP)].map(m => Number(m[1]))
}

export async function imageFeesInfo (s3Keys, { models, me }) {
  // returns info object in this format:
  // { bytes24h: int, bytesUnpaid: int, nUnpaid: int, imageFeeMsats: BigInt }
  const [info] = await models.$queryRawUnsafe('SELECT * FROM image_fees_info($1::INTEGER, $2::INTEGER[])', me ? me.id : USER_ID.anon, s3Keys)
  const imageFee = msatsToSats(info.imageFeeMsats)
  const totalFeesMsats = info.nUnpaid * Number(info.imageFeeMsats)
  const totalFees = msatsToSats(totalFeesMsats)
  return { ...info, imageFee, totalFees, totalFeesMsats }
}
