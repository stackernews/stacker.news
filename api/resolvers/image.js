import { ANON_USER_ID, AWS_S3_URL_REGEXP } from '../../lib/constants'
import { datePivot } from '../../lib/time'

export default {
  Query: {
    imageFees: async (parent, { s3Keys }, { models, me }) => {
      const imgFees = await imageFees(s3Keys, { models, me })
      delete imgFees.queries
      // add defaults so we can be sure these properties always exist in the frontend
      return Object.assign({ fees: 0, unpaid: 0, feesPerImage: 0, size24h: 0, sizeNow: 0 }, imgFees)
    }
  }
}

export async function imageFeesFromText (text, { models, me }) {
  // no text means no image fees
  if (!text) return { queries: itemId => [], fees: 0 }

  // parse all s3 keys (= image ids) from text
  const textS3Keys = [...text.matchAll(AWS_S3_URL_REGEXP)].map(m => Number(m[1]))
  if (!textS3Keys.length) return { queries: itemId => [], fees: 0 }

  return imageFees(textS3Keys, { models, me })
}

export async function imageFees (s3Keys, { models, me }) {
  // To apply image fees, we return queries which need to be run, preferably in the same transaction as creating or updating an item.
  function queries (userId, imgIds, imgFees) {
    return itemId => {
      return [
        // pay fees
        models.$queryRawUnsafe('SELECT * FROM user_fee($1::INTEGER, $2::INTEGER, $3::BIGINT)', userId, itemId, imgFees * 1000),
        // mark images as paid
        models.upload.updateMany({ where: { id: { in: imgIds } }, data: { paid: true } })
      ]
    }
  }

  // we want to ignore image ids for which someone already paid during fee calculation
  // to make sure that every image is only paid once
  const unpaidS3Keys = (await models.upload.findMany({ select: { id: true }, where: { id: { in: s3Keys }, paid: false } })).map(({ id }) => id)
  const unpaid = unpaidS3Keys.length

  if (!unpaid) return { queries: itemId => [], fees: 0 }

  if (!me) {
    // anons pay for every new image 100 sats
    const feesPerImage = 100
    const fees = feesPerImage * unpaid
    return { queries: queries(ANON_USER_ID, unpaidS3Keys, fees), fees, feesPerImage, unpaid }
  }

  // check how much stacker uploaded in last 24 hours
  const { _sum: { size: size24h } } = await models.upload.aggregate({
    _sum: { size: true },
    where: {
      userId: me.id,
      createdAt: { gt: datePivot(new Date(), { days: -1 }) },
      paid: true
    }
  })

  // check how much stacker uploaded now in size
  const { _sum: { size: sizeNow } } = await models.upload.aggregate({
    _count: { id: true },
    _sum: { size: true },
    where: { id: { in: unpaidS3Keys } }
  })

  // total size that we consider to calculate fees includes size of images within last 24 hours and size of incoming images
  const size = size24h + sizeNow
  const MB = 1024 * 1024 // factor for bytes -> megabytes

  // 10 MB per 24 hours are free. fee is also 0 if there are no incoming images (obviously)
  let feesPerImage
  if (!sizeNow || size <= 10 * MB) {
    feesPerImage = 0
  } else if (size <= 25 * MB) {
    feesPerImage = 10
  } else if (size <= 50 * MB) {
    feesPerImage = 100
  } else if (size <= 100 * MB) {
    feesPerImage = 1000
  } else {
    feesPerImage = 10000
  }
  const fees = feesPerImage * unpaid
  return { queries: queries(me.id, unpaidS3Keys, fees * unpaid), fees, feesPerImage, unpaid, size24h, sizeNow }
}
