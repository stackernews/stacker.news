import { validateSchema, customDomainSchema } from '@/lib/validate'
import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { randomBytes } from 'node:crypto'
import { getDomainMappingsCache } from '@/lib/domains'

export default {
  Query: {
    customDomain: async (parent, { subName }, { models }) => {
      return models.customDomain.findUnique({ where: { subName } })
    },
    domainMapping: async (parent, { domain }, { models }) => {
      const domainMappings = await getDomainMappingsCache()
      return domainMappings?.[domain]
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
        if (existing && existing.domain === domain && existing.status !== 'HOLD') {
          throw new GqlInputError('domain already set')
        }
        const updatedDomain = await models.customDomain.upsert({
          where: { subName },
          update: {
            domain,
            status: 'PENDING',
            verification: {
              dns: {
                state: 'PENDING',
                cname: 'stacker.news',
                txt: randomBytes(32).toString('base64')
              },
              ssl: {
                state: 'WAITING',
                arn: null,
                cname: null,
                value: null
              }
            }
          },
          create: {
            domain,
            status: 'PENDING',
            verification: {
              dns: {
                state: 'PENDING',
                cname: 'stacker.news',
                txt: randomBytes(32).toString('base64')
              },
              ssl: {
                state: 'WAITING',
                arn: null,
                cname: null,
                value: null
              }
            },
            sub: {
              connect: { name: subName }
            }
          }
        })

        // schedule domain verification in 5 seconds, apply exponential backoff and keep it for 2 days
        await models.$executeRaw`INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, retrydelay, startafter, keepuntil)
          VALUES ('domainVerification',
                  jsonb_build_object('domainId', ${updatedDomain.id}::INTEGER),
                  21,
                  true,
                  '30', -- 30 seconds of delay between retries
                  now() + interval '5 seconds',
                  now() + interval '2 days')`

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
