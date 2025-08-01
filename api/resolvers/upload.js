import { USER_ID, IMAGE_PIXELS_MAX, UPLOAD_SIZE_MAX, UPLOAD_SIZE_MAX_AVATAR, UPLOAD_TYPES_ALLOW, AWS_S3_URL_REGEXP, AVATAR_TYPES_ALLOW } from '@/lib/constants'
import { createPresignedPost } from '@/api/s3'
import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { msatsToSats } from '@/lib/format'

export default {
  Query: {
    uploadFees: async (parent, { s3Keys }, { models, me }) => {
      return uploadFees(s3Keys, { models, me })
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
  // returns info object in this format:
  // { bytes24h: int, bytesUnpaid: int, nUnpaid: int, uploadFeesMsats: BigInt }
  const [info] = await models.$queryRawUnsafe('SELECT * FROM upload_fees($1::INTEGER, $2::INTEGER[])', me ? me.id : USER_ID.anon, s3Keys)
  const uploadFees = msatsToSats(info.uploadFeesMsats)
  const totalFeesMsats = info.nUnpaid * Number(info.uploadFeesMsats)
  const totalFees = msatsToSats(totalFeesMsats)
  return { ...info, uploadFees, totalFees, totalFeesMsats }
}

export async function throwOnExpiredUploads (uploadIds, { tx }) {
  const deletedUploads = []
  for (const uploadId of uploadIds) {
    if (!await tx.upload.findUnique({ where: { id: uploadId } })) {
      deletedUploads.push(uploadId)
    }
  }
  if (deletedUploads.length > 0) {
    throw new Error(`upload(s) ${deletedUploads.join(', ')} are expired, consider reuploading.`)
  }
}
