import { validateSchema, customDomainSchema } from '@/lib/validate'
import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { randomBytes } from 'node:crypto'

export default {
  Query: {
    customDomain: async (parent, { subName }, { models }) => {
      return models.customDomain.findUnique({ where: { subName } })
    }
  },
  Mutation: {
    setCustomDomain: async (parent, { subName, domain }, { me, models }) => {
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
      domain = domain.trim() // protect against trailing spaces
      if (domain && !validateSchema(customDomainSchema, { domain })) {
        throw new GqlInputError('Invalid domain format')
      }

      if (domain) {
        const existing = await models.customDomain.findUnique({ where: { subName } })
        if (existing && existing.domain === domain) {
          throw new GqlInputError('domain already set')
        }
        const updatedDomain = await models.customDomain.upsert({
          where: { subName },
          update: {
            domain,
            dnsState: 'PENDING',
            sslState: 'WAITING',
            status: 'PENDING',
            certificateArn: null
          },
          create: {
            domain,
            dnsState: 'PENDING',
            sslState: 'WAITING',
            status: 'PENDING',
            verificationTxt: randomBytes(32).toString('base64'),
            sub: {
              connect: { name: subName }
            }
          }
        })

        // schedule domain verification in 5 seconds, worker will do the rest
        await models.$executeRaw`INSERT INTO pgboss.job (name, data)
          VALUES ('immediateDomainVerification', jsonb_build_object('domainId', ${updatedDomain.id}::INTEGER))`
        return updatedDomain
      } else {
        try {
          return await models.customDomain.delete({ where: { subName } })
        } catch (error) {
          console.error(error)
          throw new GqlInputError('failed to delete domain')
        }
      }
    }
  }
}
