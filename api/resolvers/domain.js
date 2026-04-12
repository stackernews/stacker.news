import { validateSchema, customDomainSchema } from '@/lib/validate'
import { GqlAuthenticationError, GqlInputError, GqlAuthorizationError } from '@/lib/error'
import {
  DOMAIN_VERIFICATION_HOLD_AFTER_DAYS,
  DOMAIN_VERIFICATION_INTERVAL_SECONDS,
  DOMAIN_VERIFICATION_RETRY_DELAY_SECONDS,
  DOMAIN_VERIFICATION_RETRY_LIMIT,
  SN_ADMIN_IDS
} from '@/lib/constants'

export async function cleanDomainVerificationJobs (domainId, models) {
  // delete any existing domain verification job left
  await models.$queryRaw`
  DELETE FROM pgboss.job
  WHERE name = 'domainVerification'
      AND data->>'domainId' = ${domainId}::TEXT`
}

/**
 * Schedule a domain verification job to run in a given amount of time.
 * @param {Object} options - The options for scheduling the job.
 * @param {number} options.domainId - The ID of the domain to verify.
 * @param {models} models - prisma models or transaction
 */
async function scheduleDomainVerificationJob (domainId, models) {
  await models.$executeRaw`
  INSERT INTO pgboss.job (name, data, retrylimit, retrydelay, startafter, keepuntil, singletonkey)
  VALUES ('domainVerification',
          jsonb_build_object('domainId', ${domainId}::INTEGER),
          ${DOMAIN_VERIFICATION_RETRY_LIMIT},
          ${DOMAIN_VERIFICATION_RETRY_DELAY_SECONDS},
          now() + ${DOMAIN_VERIFICATION_INTERVAL_SECONDS} * interval '1 second',
          now() + ${DOMAIN_VERIFICATION_HOLD_AFTER_DAYS} * interval '1 day',
          'domainVerification:' || ${domainId}::TEXT -- domain <-> job isolation
        )`
}

export default {
  Query: {
    domain: async (parent, { subName }, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      if (!SN_ADMIN_IDS.includes(Number(me.id))) {
        throw new GqlAuthorizationError('not an admin')
      }

      const sub = await models.sub.findUnique({ where: { name: subName } })
      if (!sub) {
        throw new GqlInputError('sub not found')
      }

      if (sub.userId !== Number(me.id)) {
        throw new GqlAuthorizationError('you do not own this sub')
      }

      return models.domain.findUnique({
        where: { subName },
        include: { records: true, attempts: true }
      })
    }
  },
  Mutation: {
    setDomain: async (parent, { subName, domainName }, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      if (!SN_ADMIN_IDS.includes(Number(me.id))) {
        throw new GqlAuthorizationError('not an admin')
      }

      const sub = await models.sub.findUnique({ where: { name: subName } })
      if (!sub) {
        throw new GqlInputError('sub not found')
      }

      if (sub.userId !== Number(me.id)) {
        throw new GqlAuthorizationError('you do not own this sub')
      }

      // we need to get the existing domain if we're updating or re-verifying
      const existing = await models.domain.findUnique({
        where: { subName },
        include: { records: true }
      })

      if (domainName) {
        domainName = domainName.trim().toLowerCase()
        await validateSchema(customDomainSchema, { domainName })

        const sameDomain = existing && existing.domainName === domainName

        // updating the domain name, recovering from HOLD is allowed
        if (sameDomain && existing.status !== 'HOLD') {
          throw new GqlInputError('domain already set')
        }

        // fresh updatedAt so we know when to put the domain in HOLD during verification
        const initializeDomain = {
          domainName,
          updatedAt: new Date(),
          status: 'PENDING'
        }

        const resuming = sameDomain && existing?.status === 'HOLD'

        const updatedDomain = await models.$transaction(async tx => {
          if (existing) {
            await cleanDomainVerificationJobs(existing.id, tx)
            if (!resuming) {
              await tx.domain.delete({ where: { subName } })
            }
          }

          const domain = resuming
            ? await tx.domain.update({ where: { id: existing.id }, data: initializeDomain })
            : await tx.domain.create({
              data: { ...initializeDomain, sub: { connect: { name: subName } } }
            })

          if (!resuming) {
            await tx.domainVerificationRecord.create({
              data: {
                domainId: domain.id,
                type: 'CNAME',
                recordName: domainName,
                recordValue: new URL(process.env.NEXT_PUBLIC_URL).host
              }
            })
          }

          await scheduleDomainVerificationJob(domain.id, tx)
          return domain
        })

        return updatedDomain
      } else {
        try {
          if (existing) {
            return await models.$transaction(async tx => {
              // delete any existing domain verification job left
              await cleanDomainVerificationJobs(existing.id, tx)
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
      if (!domain.records?.length) return null

      // O(1) lookups by type, simpler checks for CNAME and ACM validation records
      return Object.fromEntries(domain.records.map(record => [record.type, record]))
    }
  }
}
