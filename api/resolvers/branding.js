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

      const { title, colors, logoId, faviconId } = branding

      const parsedLogoId = parseInt(logoId)
      const parsedFaviconId = parseInt(faviconId)

      if (parsedLogoId) {
        const logo = await models.upload.findUnique({ where: { id: parsedLogoId } })
        if (!logo) {
          throw new GqlInputError('logo not found')
        }
      }

      if (parsedFaviconId) {
        const favicon = await models.upload.findUnique({ where: { id: parsedFaviconId } })
        if (!favicon) {
          throw new GqlInputError('favicon not found')
        }
      }

      // TODO: validation, even of logo and favicon.

      return await models.customBranding.upsert({
        where: { subName },
        update: {
          title: title || subName,
          colors,
          ...(parsedLogoId && { logo: { connect: { id: parsedLogoId } } }),
          ...(parsedFaviconId && { favicon: { connect: { id: parsedFaviconId } } })
        },
        create: {
          title: title || subName,
          colors,
          ...(parsedLogoId && { logo: { connect: { id: parsedLogoId } } }),
          ...(parsedFaviconId && { favicon: { connect: { id: parsedFaviconId } } }),
          sub: { connect: { name: subName } }
        }
      })
    }
  }
}
