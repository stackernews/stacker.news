import { GraphQLError } from 'graphql'
import { IMAGE_PIXELS_MAX, UPLOAD_SIZE_MAX, UPLOAD_TYPES_ALLOW } from '../../lib/constants'
import { createPresignedPost } from '../s3'

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

      const data = {
        type,
        size,
        width,
        height,
        userId: me.id
      }

      let uploadId
      if (avatar) {
        const { photoId } = await models.user.findUnique({ where: { id: me.id } })
        if (photoId) uploadId = photoId
      }
      if (uploadId) {
        // update upload record
        await models.upload.update({ data, where: { id: uploadId } })
      } else {
        // create upload record
        const upload = await models.upload.create({ data })
        uploadId = upload.id
      }

      // get presigned POST url
      return createPresignedPost({ key: String(uploadId), type, size })
    }
  }
}
