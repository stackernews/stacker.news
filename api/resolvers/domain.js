import { validateSchema, customDomainSchema } from '@/lib/validate'
import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { randomBytes } from 'node:crypto'
import { getDomainMapping } from '@/lib/domains'

export default {
  Query: {
    domain: async (parent, { subName }, { models }) => {
      return models.domain.findUnique({
        where: { subName },
        include: { records: true, attempts: true, certificate: true }
      })
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

        const updatedDomain = await models.$transaction(async tx => {
          const domain = await tx.domain.upsert({
            where: { subName },
            update: initializeDomain,
            create: {
              ...initializeDomain,
              sub: { connect: { name: subName } }
            }
          })

          // if on HOLD, get the existing TXT record
          const existingTXT = existing && existing.status === 'HOLD'
            ? await tx.domainVerificationRecord.findUnique({
              where: {
                domainId_type_recordName: {
                  domainId: existing.id,
                  type: 'TXT',
                  recordName: '_snverify.' + existing.domainName
                }
              }
            })
            : null

          // create the verification records
          const verificationRecords = [
            {
              domainId: updatedDomain.id,
              type: 'CNAME',
              recordName: domainName,
              recordValue: new URL(process.env.NEXT_PUBLIC_URL).host
            },
            {
              domainId: updatedDomain.id,
              type: 'TXT',
              recordName: '_snverify.' + domainName,
              recordValue: existingTXT // if we're resuming from HOLD, use the existing TXT record
                ? existingTXT.recordValue
                : randomBytes(32).toString('base64')
            }
          ]

          for (const record of verificationRecords) {
            await tx.domainVerificationRecord.upsert({
              where: {
                domainId_type_recordName: {
                  domainId: updatedDomain.id,
                  type: record.type,
                  recordName: record.recordName
                }
              },
              update: record,
              create: record
            })
          }

          // create the job to verify the domain in 30 seconds
          await tx.$executeRaw`
          INSERT INTO pgboss.job (name, data, retrylimit, retrydelay, startafter, keepuntil)
          VALUES ('domainVerification',
                  jsonb_build_object('domainId', ${updatedDomain.id}::INTEGER),
                  3,
                  60,
                  now() + interval '30 seconds',
                  now() + interval '2 days'
                )`

          return domain
        })

        return updatedDomain
      } else {
        try {
          // Delete any existing domain verification jobs
          if (existing) {
            return await models.$transaction(async tx => {
              await tx.$queryRaw`
              DELETE FROM pgboss.job
              WHERE name = 'domainVerification'
                  AND data->>'domainId' = ${existing.id}::TEXT`

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

      // O(1) lookups by type, simpler checks for CNAME, TXT and ACM validation records.
      return Object.fromEntries(domain.records.map(record => [record.type, record]))
    }
  }
}
