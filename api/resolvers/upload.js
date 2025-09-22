import { USER_ID, IMAGE_PIXELS_MAX, UPLOAD_SIZE_MAX, UPLOAD_SIZE_MAX_AVATAR, UPLOAD_TYPES_ALLOW, AWS_S3_URL_REGEXP, AVATAR_TYPES_ALLOW, MEDIA_URL } from '@/lib/constants'
import { createPresignedPost } from '@/api/s3'
import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { msatsToSats } from '@/lib/format'
import { Prisma } from '@prisma/client'

export default {
  Query: {
    uploadFees: async (parent, { s3Keys }, { models, me }) => {
      const fees = await uploadFees(s3Keys, { models, me })
      // GraphQL doesn't support bigint
      return {
        totalFees: Number(fees.totalFees),
        totalFeesMsats: Number(fees.totalFeesMsats),
        uploadFees: Number(fees.uploadFees),
        uploadFeesMsats: Number(fees.uploadFeesMsats),
        nUnpaid: Number(fees.nUnpaid),
        bytesUnpaid: Number(fees.bytesUnpaid),
        bytes24h: Number(fees.bytes24h)
      }
    }
  },
  Mutation: {
    getSignedPOST: async (parent, { type, size, width, height, avatar }, { models, me }) => {
      if (UPLOAD_TYPES_ALLOW.indexOf(type) === -1) {
        throw new GqlInputError(`upload must be ${UPLOAD_TYPES_ALLOW.map(t => t.replace(/^(image|video)\//, '')).join(', ')}`)
      }

      if (size > UPLOAD_SIZE_MAX) {
        throw new GqlInputError(`upload must be less than ${UPLOAD_SIZE_MAX / (1024 ** 2)} megabytes`)
      }

      if (avatar) {
        if (AVATAR_TYPES_ALLOW.indexOf(type) === -1) {
          throw new GqlInputError(`avatar must be ${AVATAR_TYPES_ALLOW.map(t => t.replace('image/', '')).join(', ')}`)
        }

        if (size > UPLOAD_SIZE_MAX_AVATAR) {
          throw new GqlInputError(`avatar must be less than ${UPLOAD_SIZE_MAX_AVATAR / (1024 ** 2)} megabytes`)
        }
      }

      // width and height is 0 for videos
      if (width * height > IMAGE_PIXELS_MAX) {
        throw new GqlInputError(`image must be less than ${IMAGE_PIXELS_MAX} pixels`)
      }

      const fileParams = {
        type,
        size,
        width,
        height,
        userId: me?.id || USER_ID.anon,
        paid: false
      }

      if (avatar) {
        if (!me) throw new GqlAuthenticationError()
        fileParams.paid = undefined
      }

      const upload = await models.upload.create({ data: { ...fileParams } })
      return createPresignedPost({ key: String(upload.id), type, size })
    }
  }
}

export function uploadIdsFromText (text) {
  if (!text) return []
  return [...new Set([...text.matchAll(AWS_S3_URL_REGEXP)].map(m => Number(m[1])))]
}

export async function uploadFees (s3Keys, { models, me }) {
  const userId = me?.id ?? USER_ID.anon

  if (!s3Keys || s3Keys.length === 0) {
    return {
      bytes24h: 0n,
      bytesUnpaid: 0n,
      nUnpaid: 0n,
      uploadFees: 0n,
      uploadFeesMsats: 0n,
      totalFees: 0n,
      totalFeesMsats: 0n
    }
  }

  const [{
    bytes24h,
    bytesUnpaid,
    nUnpaid,
    uploadFeesMsats
  }] = await models.$queryRaw`
    SELECT uploadinfo.*,
      CASE
          -- anons always pay 100 sats per upload no matter the size
          WHEN ${userId} = 27 THEN 100000::BIGINT
          ELSE CASE
          -- 250MB are free per stacker and 24 hours
          WHEN uploadinfo."bytes24h" + uploadinfo."bytesUnpaid" <= 250 THEN 0::BIGINT
          -- 100 sats per upload
          ELSE 100000::BIGINT
      END
    END AS "uploadFeesMsats"
    FROM (
      SELECT
          -- how much bytes did stacker upload in last 24 hours?
          COALESCE(SUM(size) FILTER(WHERE paid = 't'), 0)::INTEGER AS "bytes24h",
          -- how much unpaid bytes do they want to upload now?
          COALESCE(SUM(size) FILTER(WHERE paid = 'f' AND id IN (${Prisma.join(s3Keys)})), 0)::INTEGER AS "bytesUnpaid",
          -- how many unpaid images do they want to upload now?
          COALESCE(COUNT(id) FILTER(WHERE paid = 'f' AND id IN (${Prisma.join(s3Keys)})), 0)::INTEGER AS "nUnpaid"
      FROM "Upload"
      WHERE "Upload"."userId" = ${userId}
      AND created_at >= NOW() - interval '24 hours'
    ) uploadinfo`

  const uploadFees = BigInt(msatsToSats(uploadFeesMsats))
  const totalFeesMsats = BigInt(nUnpaid) * uploadFeesMsats
  const totalFees = BigInt(msatsToSats(totalFeesMsats))
  return { bytes24h, bytesUnpaid, nUnpaid, uploadFees, uploadFeesMsats, totalFees, totalFeesMsats }
}

export async function throwOnExpiredUploads (uploadIds, { tx }) {
  if (uploadIds.length === 0) return

  const existingUploads = await tx.upload.findMany({
    where: { id: { in: uploadIds } },
    select: { id: true }
  })

  const existingIds = new Set(existingUploads.map(upload => upload.id))
  const deletedIds = uploadIds.filter(id => !existingIds.has(id))

  if (deletedIds.length > 0) {
    throw new Error(`upload(s) ${deletedIds.map(id => `${MEDIA_URL}/${id}`).join(', ')} are expired, consider reuploading.`)
  }
}
