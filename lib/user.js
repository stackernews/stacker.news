import { PUBLIC_MEDIA_URL } from './constants'

export const avatarSrc = photoId => photoId ? `${PUBLIC_MEDIA_URL}/${photoId}` : '/dorian400.jpg'

export const isMuted = async ({ models, muterId, mutedId }) => {
  const mute = await models.mute.findUnique({
    where: {
      muterId_mutedId: {
        muterId: Number(muterId),
        mutedId: Number(mutedId)
      }
    }
  })

  return !!mute
}
