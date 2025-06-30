import { validateSchema, customDomainSchema } from '@/lib/validate'
import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { SN_ADMIN_IDS } from '@/lib/constants'

async function cleanDomainVerificationJobs (domain, models) {
  // delete any existing domain verification job left
  await models.$queryRaw`
  DELETE FROM pgboss.job
  WHERE name = 'domainVerification'
      AND data->>'domainId' = ${domain.id}::TEXT`
}

export default {
  Query: {
    domain: async (parent, { subName }, { models }) => {
      return models.domain.findUnique({
        where: { subName },
        include: { records: true, attempts: true, certificate: true }
      })
    }
  },
  Mutation: {
    setDomain: async (parent, { subName, domainName }, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      if (!SN_ADMIN_IDS.includes(Number(me.id))) {
        throw new Error('not an admin')
      }

      const sub = await models.sub.findUnique({ where: { name: subName } })
      if (!sub) {
        throw new GqlInputError('sub not found')
      }

      if (sub.userId !== me.id) {
        throw new GqlInputError('you do not own this sub')
      }

      // we need to get the existing domain if we're updating or re-verifying
      const existing = await models.domain.findUnique({
        where: { subName },
        include: { records: true }
      })

      if (domainName) {
        // validate the domain name
        domainName = domainName.trim() // protect against trailing spaces
        await validateSchema(customDomainSchema, { domainName })

        // updating the domain name and recovering from HOLD is allowed
        if (existing && existing.domainName === domainName && existing.status !== 'HOLD') {
          throw new GqlInputError('domain already set')
        }

        // we should always make sure to get a new updatedAt timestamp
        // to know when should we put the domain in HOLD during verification
        const initializeDomain = {
          domainName,
          updatedAt: new Date(),
          status: 'PENDING'
        }

        const updatedDomain = await models.$transaction(async tx => {
          // we're changing the domain name, delete the domain if it exists
          if (existing) {
            // delete any existing domain verification job left
            await cleanDomainVerificationJobs(existing, tx)
            // delete the domain if we're not resuming from HOLD
            if (existing.status !== 'HOLD') {
              await tx.domain.delete({ where: { subName } })
            }
          }

          const domain = await tx.domain.create({
            data: {
              ...initializeDomain,
              sub: { connect: { name: subName } }
            }
          })

          // create the CNAME verification record
          await tx.domainVerificationRecord.create({
            data: {
              domainId: domain.id,
              type: 'CNAME',
              recordName: domainName,
              recordValue: new URL(process.env.NEXT_PUBLIC_URL).host
            }
          })

          // create the job to verify the domain in 30 seconds
          await tx.$executeRaw`
          INSERT INTO pgboss.job (name, data, retrylimit, retrydelay, startafter, keepuntil, singletonkey)
          VALUES ('domainVerification',
                  jsonb_build_object('domainId', ${domain.id}::INTEGER),
                  3,
                  60,
                  now() + interval '30 seconds',
                  now() + interval '2 days',
                  'domainVerification:' || ${domain.id}::TEXT -- domain <-> job isolation
                )`

          return domain
        })

        return updatedDomain
      } else {
        try {
          if (existing) {
            return await models.$transaction(async tx => {
              // delete any existing domain verification job left
              await cleanDomainVerificationJobs(existing, tx)
              // delete the domain
              return await tx.domain.delete({ where: { subName } })
            })
          }
          return null
        } catch (error) {
          console.error(error)
          throw new GqlInputError('failed to delete domain')
        }
      }
    }
  },
  Domain: {
    records: async (domain) => {
      if (!domain.records) return []

      // O(1) lookups by type, simpler checks for CNAME and ACM validation records
      return Object.fromEntries(domain.records.map(record => [record.type, record]))
    }
  }
}
