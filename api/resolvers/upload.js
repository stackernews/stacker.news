import { GraphQLError } from 'graphql'
import { IMAGE_PIXELS_MAX, UPLOAD_SIZE_MAX, UPLOAD_TYPES_ALLOW } from '../../lib/constants'
import { createPresignedPost } from '../s3'
import { datePivot } from '../../lib/time'
import serialize from './serial'

// factor for bytes to megabyte
const MB = 1024 * 1024
// factor for msats to sats
const SATS = 1000

async function uploadCosts (models, userId, photoId, size) {
  let { _sum: { size: sumSize } } = await models.upload.aggregate({
    _sum: { size: true },
    where: { userId, createdAt: { gt: datePivot(new Date(), { days: -1 }) }, id: photoId ? { not: photoId } : undefined }
  })
  // assume the image was already uploaded in the calculation
  sumSize += size
  if (sumSize <= 5 * MB) {
    return 0 * SATS
  }
  if (sumSize <= 10 * MB) {
    return 10 * SATS
  }
  if (sumSize <= 25 * MB) {
    return 100 * SATS
  }
  if (sumSize <= 100 * MB) {
    return 1000 * SATS
  }
  return -1
}

export default {
  Mutation: {
    getSignedPOST: async (parent, { type, size, width, height, avatar }, { models, me }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in to get a signed url', { extensions: { code: 'FORBIDDEN' } })
      }

      if (UPLOAD_TYPES_ALLOW.indexOf(type) === -1) {
        throw new GraphQLError(`image must be ${UPLOAD_TYPES_ALLOW.map(t => t.replace('image/', '')).join(', ')}`, { extensions: { code: 'BAD_INPUT' } })
      }

      if (size > UPLOAD_SIZE_MAX) {
        throw new GraphQLError(`image must be less than ${UPLOAD_SIZE_MAX} bytes`, { extensions: { code: 'BAD_INPUT' } })
      }

      if (width * height > IMAGE_PIXELS_MAX) {
        throw new GraphQLError(`image must be less than ${IMAGE_PIXELS_MAX} pixels`, { extensions: { code: 'BAD_INPUT' } })
      }

      const { photoId } = await models.user.findUnique({ where: { id: me.id } })

      const costs = avatar ? 0 : await uploadCosts(models, me.id, photoId, size)
      if (costs < 0) {
        throw new GraphQLError('image quota of 100 MB exceeded', { extensions: { code: 'BAD_INPUT' } })
      }
      const feeTx = models.user.update({ data: { msats: { decrement: costs } }, where: { id: me.id } })

      const data = {
        type,
        size,
        width,
        height,
        userId: me.id
      }

      let uploadId
      if (avatar && photoId) uploadId = photoId
      if (uploadId) {
        // update upload record
        await serialize(models, models.upload.update({ data, where: { id: uploadId } }), feeTx)
      } else {
        // create upload record
        const [upload] = await serialize(models, models.upload.create({ data }), feeTx)
        uploadId = upload.id
      }

      // get presigned POST url
      return createPresignedPost({ key: String(uploadId), type, size })
    }
  }
}
