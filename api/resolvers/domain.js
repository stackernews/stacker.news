import { validateSchema, customDomainSchema } from '@/lib/validate'
import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { randomBytes } from 'node:crypto'
import { getDomainMapping } from '@/lib/domains'
import { deleteDomainCertificate } from '@/lib/domain-verification'

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

      // we need to get the existing domain if we're updating or re-verifying
      const existing = await models.domain.findUnique({ where: { subName } })

      if (domainName) {
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
          // clean any existing domain verification job left
          if (existing && existing.status === 'HOLD') {
            await cleanDomainVerificationJobs(existing, tx)
          }

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
              domainId: domain.id,
              type: 'CNAME',
              recordName: domainName,
              recordValue: new URL(process.env.NEXT_PUBLIC_URL).host
            },
            {
              domainId: domain.id,
              type: 'TXT',
              recordName: '_snverify.' + domainName,
              recordValue: existingTXT // if we're resuming from HOLD, use the existing TXT record
                ? existingTXT.recordValue
                : randomBytes(32).toString('base64')
            }
          ]

          // create the verification records
          for (const record of verificationRecords) {
            await tx.domainVerificationRecord.upsert({
              where: {
                domainId_type_recordName: {
                  domainId: domain.id,
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
                  jsonb_build_object('domainId', ${domain.id}::INTEGER),
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
              // delete any existing domain verification job left
              await cleanDomainVerificationJobs(existing, tx)

              // deleting a domain will also delete the domain certificate
              // but we need to make sure to delete the certificate from ACM
              if (existing.certificate) {
                await deleteDomainCertificate(existing.certificate.certificateArn)
              }

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

      // O(1) lookups by type, simpler checks for CNAME, TXT and ACM validation records.
      return Object.fromEntries(domain.records.map(record => [record.type, record]))
    }
  }
}
