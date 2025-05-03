import { validateSchema, customDomainSchema } from '@/lib/validate'
import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { randomBytes } from 'node:crypto'
import { getDomainMapping } from '@/lib/domains'

export default {
  Query: {
    domain: async (parent, { subName }, { models }) => {
      return models.domain.findUnique({
        where: { subName },
        include: {
          records: true,
          attempts: true,
          certificate: true
        }
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

        // Get existing records if any
        const existingRecords = existing
          ? await models.domainVerificationRecord.findMany({
            where: { domainId: existing.id }
          })
          : []

        const existingRecordMap = Object.fromEntries(existingRecords.map(r => [r.type, r]))

        // Setup verification records
        const verificationRecords = [
          {
            domainId: updatedDomain.id,
            type: 'CNAME',
            recordName: domainName,
            recordValue: 'stacker.news'
          },
          {
            domainId: updatedDomain.id,
            type: 'TXT',
            recordName: '_snverify.' + domainName,
            recordValue: existing && existing.status === 'HOLD' && existingRecordMap.TXT
              ? existingRecordMap.TXT.recordValue
              : randomBytes(32).toString('base64')
          }
        ]

        // Create or update verification records
        const recordPromises = verificationRecords.map(record =>
          models.domainVerificationRecord.upsert({
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
        )

        await Promise.all(recordPromises)

        // Schedule domain verification in 30 seconds
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
          // Delete any existing domain verification jobs
          if (existing) {
            await models.$queryRaw`
            DELETE FROM pgboss.job
            WHERE name = 'domainVerification'
                  AND data->>'domainId' = ${existing.id}::TEXT`

            return await models.domain.delete({ where: { subName } })
          }
          return null
        } catch (error) {
          console.error(error)
          throw new GqlInputError('failed to delete domain')
        }
      }
    }
  }
}
