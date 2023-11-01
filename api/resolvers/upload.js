import { GraphQLError } from 'graphql'
import { ANON_USER_ID, IMAGE_PIXELS_MAX, UPLOAD_SIZE_MAX, UPLOAD_SIZE_MAX_AVATAR, UPLOAD_TYPES_ALLOW } from '../../lib/constants'
import { createPresignedPost } from '../s3'

export default {
  Mutation: {
    getSignedPOST: async (parent, { type, size, width, height, avatar }, { models, me }) => {
      if (UPLOAD_TYPES_ALLOW.indexOf(type) === -1) {
        throw new GraphQLError(`image must be ${UPLOAD_TYPES_ALLOW.map(t => t.replace('image/', '')).join(', ')}`, { extensions: { code: 'BAD_INPUT' } })
      }

      if (size > UPLOAD_SIZE_MAX) {
        throw new GraphQLError(`image must be less than ${UPLOAD_SIZE_MAX / (1024 ** 2)} megabytes`, { extensions: { code: 'BAD_INPUT' } })
      }

      if (avatar && size > UPLOAD_SIZE_MAX_AVATAR) {
        throw new GraphQLError(`image must be less than ${UPLOAD_SIZE_MAX_AVATAR / (1024 ** 2)} megabytes`, { extensions: { code: 'BAD_INPUT' } })
      }

      if (width * height > IMAGE_PIXELS_MAX) {
        throw new GraphQLError(`image must be less than ${IMAGE_PIXELS_MAX} pixels`, { extensions: { code: 'BAD_INPUT' } })
      }

      const imgParams = {
        type,
        size,
        width,
        height,
        userId: me?.id || ANON_USER_ID
      }

      if (avatar) {
        if (!me) throw new GraphQLError('you must be logged in', { extensions: { code: 'FORBIDDEN' } })
        return avatarGetSignedPOST({ me, models, imgParams })
      }

      const upload = await models.upload.create({ data: { ...imgParams, paid: false } })
      return createPresignedPost({ key: String(upload.id), type, size })
    }
  }
}

async function avatarGetSignedPOST ({ me, models, imgParams }) {
  // avatar uploads are always free
  imgParams.paid = undefined

  const { photoId } = await models.user.findUnique({ where: { id: me.id } })
  let uploadId
  if (photoId) {
    await models.upload.update({ data: imgParams, where: { id: photoId } })
    uploadId = photoId
  } else {
    const upload = await models.upload.create({ data: imgParams })
    uploadId = upload.id
  }

  return createPresignedPost({ key: String(uploadId), type: imgParams.type, size: imgParams.size })
}
