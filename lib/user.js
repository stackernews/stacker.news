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
