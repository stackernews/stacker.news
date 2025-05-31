import { GqlAuthenticationError, GqlInputError } from '@/lib/error'

export default {
  Query: {
    customBranding: async (parent, { subName }, { models }) => {
      return models.customBranding.findUnique({ where: { subName } })
    }
  },
  Mutation: {
    setCustomBranding: async (parent, { subName, branding }, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      const sub = await models.sub.findUnique({ where: { name: subName } })
      if (!sub) {
        throw new GqlInputError('sub not found')
      }

      if (sub.userId !== me.id) {
        throw new GqlInputError('you do not own this sub')
      }

      const { title, primaryColor, secondaryColor, logoId, faviconId } = branding

      if (logoId) {
        const logo = await models.upload.findUnique({ where: { id: logoId } })
        if (!logo) {
          throw new GqlInputError('logo not found')
        }
      }

      if (faviconId) {
        const favicon = await models.upload.findUnique({ where: { id: faviconId } })
        if (!favicon) {
          throw new GqlInputError('favicon not found')
        }
      }

      return await models.customBranding.upsert({
        where: { subName },
        update: {
          title,
          primaryColor,
          secondaryColor,
          ...(logoId && { logo: { connect: { id: logoId } } }),
          ...(faviconId && { favicon: { connect: { id: faviconId } } })
        },
        create: {
          title,
          primaryColor,
          secondaryColor,
          ...(logoId && { logo: { connect: { id: logoId } } }),
          ...(faviconId && { favicon: { connect: { id: faviconId } } }),
          sub: { connect: { name: subName } }
        }
      })
    }
  }
}
