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
        throw new GqlInputError('invalid domain format')
      }

      const existing = await models.customDomain.findUnique({ where: { subName } })

      if (domain) {
        if (existing && existing.domain === domain && existing.status !== 'HOLD') {
          throw new GqlInputError('domain already set')
        }

        const initializeDomain = {
          domain,
          createdAt: new Date(),
          status: 'PENDING',
          verification: {
            dns: {
              state: 'PENDING',
              cname: 'stacker.news',
              // generate a random txt record only if it's a new domain
              txt: existing?.domain === domain && existing.verification.dns.txt
                ? existing.verification.dns.txt
                : randomBytes(32).toString('base64')
            },
            ssl: {
              state: 'WAITING',
              arn: null,
              cname: null,
              value: null
            }
          }
        }

        const updatedDomain = await models.customDomain.upsert({
          where: { subName },
          update: {
            ...initializeDomain
          },
          create: {
            ...initializeDomain,
            sub: {
              connect: { name: subName }
            }
          }
        })

        // schedule domain verification in 30 seconds
        await models.$executeRaw`
        INSERT INTO pgboss.job (name, data, retrylimit, retrydelay, startafter, keepuntil)
        VALUES ('domainVerification',
                jsonb_build_object('domainId', ${updatedDomain.id}::INTEGER),
                3,
                30,
                now() + interval '30 seconds',
                now() + interval '2 days')`

        return updatedDomain
      } else {
        try {
          // delete any existing domain verification jobs
          await models.$queryRaw`
          DELETE FROM pgboss.job
          WHERE name = 'domainVerification'
                AND data->>'domainId' = ${existing.id}::TEXT`

          return await models.customDomain.delete({ where: { subName } })
        } catch (error) {
          console.error(error)
          throw new GqlInputError('failed to delete domain')
        }
      }
    }
  }
}
