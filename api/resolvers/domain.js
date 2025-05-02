import { validateSchema, customDomainSchema } from '@/lib/validate'
import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { randomBytes } from 'node:crypto'
import { getDomainMapping } from '@/lib/domains'

export default {
  Query: {
    domain: async (parent, { subName }, { models }) => {
      return models.domain.findUnique({ where: { subName }, include: { verifications: true } })
    },
    domainMapping: async (parent, { domainName }, { models }) => {
      const mapping = await getDomainMapping(domainName)
      return mapping
    }
  },
  Mutation: {
    setDomain: async (parent, { subName, domainName }, { me, models }) => {
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

      domainName = domainName.trim() // protect against trailing spaces
      if (domainName && !validateSchema(customDomainSchema, { domainName })) {
        throw new GqlInputError('invalid domain format')
      }

      const existing = await models.domain.findUnique({ where: { subName } })

      if (domainName) {
        if (existing && existing.domainName === domainName && existing.status !== 'HOLD') {
          throw new GqlInputError('domain already set')
        }

        const initializeDomain = {
          domainName,
          updatedAt: new Date(),
          status: 'PENDING'
        }

        const updatedDomain = await models.domain.upsert({
          where: { subName },
          update: initializeDomain,
          create: {
            ...initializeDomain,
            sub: {
              connect: { name: subName }
            }
          }
        })

        const existingVerifications = await models.domainVerification.findMany({
          where: { domainId: updatedDomain.id }
        })

        const existingVerificationMap = Object.fromEntries(existingVerifications.map(v => [v.type, v]))

        const verifications = {
          CNAME: {
            domainId: updatedDomain.id,
            type: 'CNAME',
            state: 'PENDING',
            host: domainName,
            value: 'stacker.news'
          },
          TXT: {
            domainId: updatedDomain.id,
            type: 'TXT',
            state: 'PENDING',
            host: '_snverify.' + domainName,
            value: existing.status === 'HOLD' ? existingVerificationMap.TXT?.value : randomBytes(32).toString('base64')
          },
          SSL: {
            domainId: updatedDomain.id,
            type: 'SSL',
            state: 'WAITING',
            host: null,
            value: null,
            sslArn: null
          }
        }

        const initializeVerifications = Object.entries(verifications).map(([type, verification]) =>
          models.domainVerification.upsert({
            where: {
              domainId_type: {
                domainId: updatedDomain.id,
                type
              }
            },
            update: verification,
            create: {
              ...verification,
              domain: { connect: { id: updatedDomain.id } }
            }
          })
        )

        await Promise.all(initializeVerifications)

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

          return await models.domain.delete({ where: { subName } })
        } catch (error) {
          console.error(error)
          throw new GqlInputError('failed to delete domain')
        }
      }
    }
  }
}
