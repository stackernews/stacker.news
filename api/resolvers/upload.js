import { USER_ID, IMAGE_PIXELS_MAX, UPLOAD_SIZE_MAX, UPLOAD_SIZE_MAX_AVATAR, UPLOAD_TYPES_ALLOW } from '@/lib/constants'
import { createPresignedPost } from '@/api/s3'
import { GqlAuthenticationError, GqlInputError } from '@/lib/error'

export default {
  Mutation: {
    getSignedPOST: async (parent, { type, size, width, height, avatar }, { models, me }) => {
      if (UPLOAD_TYPES_ALLOW.indexOf(type) === -1) {
        throw new GqlInputError(`image must be ${UPLOAD_TYPES_ALLOW.map(t => t.replace('image/', '')).join(', ')}`)
      }

      if (size > UPLOAD_SIZE_MAX) {
        throw new GqlInputError(`image must be less than ${UPLOAD_SIZE_MAX / (1024 ** 2)} megabytes`)
      }

      if (avatar && size > UPLOAD_SIZE_MAX_AVATAR) {
        throw new GqlInputError(`image must be less than ${UPLOAD_SIZE_MAX_AVATAR / (1024 ** 2)} megabytes`)
      }

      if (width * height > IMAGE_PIXELS_MAX) {
        throw new GqlInputError(`image must be less than ${IMAGE_PIXELS_MAX} pixels`)
      }

      const imgParams = {
        type,
        size,
        width,
        height,
        userId: me?.id || USER_ID.anon,
        paid: false
      }

      if (avatar) {
        if (!me) throw new GqlAuthenticationError()
        imgParams.paid = undefined
      }

      const upload = await models.upload.create({ data: { ...imgParams } })
      return createPresignedPost({ key: String(upload.id), type, size })
    }
  }
}
