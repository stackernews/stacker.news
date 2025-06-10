import createPrisma from '@/lib/create-prisma'
import { USER_ID } from '@/lib/constants'

export async function deletedUserEarnings ({ name }) {
  const models = createPrisma({ connectionParams: { connection_limit: 1 } })

  try {
    console.log(name, 'collecting earnings for deleted users')

    // Find earnings that went to deleted users since yesterday
    const deletedEarnings = await models.$queryRaw`
      SELECT 
        e."userId",
        SUM(e.msats)::BIGINT as total_msats,
        u."deletedAt"
      FROM "Earn" e
      JOIN "User" u ON e."userId" = u.id
      WHERE u."deletedAt" IS NOT NULL
        AND e."createdAt" >= date_trunc('day', now() AT TIME ZONE 'America/Chicago' - interval '1 day')
        AND e."createdAt" < date_trunc('day', now() AT TIME ZONE 'America/Chicago')
      GROUP BY e."userId", u."deletedAt"
    `

    if (deletedEarnings.length === 0) {
      console.log(name, 'no earnings for deleted users found')
      return
    }

    let totalDonatedSats = 0

    await models.$transaction(async (tx) => {
      for (const earning of deletedEarnings) {
        const donationSats = Number(earning.total_msats / 1000n)

        if (donationSats > 0) {
          // Create donation record
          await tx.donation.create({
            data: {
              sats: donationSats,
              userId: USER_ID.sn, // System donation
              createdAt: new Date()
            }
          })

          totalDonatedSats += donationSats

          // Remove the earnings from the deleted user (set msats to 0)
          await tx.user.update({
            where: { id: earning.userId },
            data: {
              msats: 0,
              mcredits: 0
            }
          })

          console.log(
            name,
            `donated ${donationSats} sats from deleted user ${earning.userId} to rewards pool`
          )
        }
      }
    })

    console.log(name, `total donated: ${totalDonatedSats} sats from ${deletedEarnings.length} deleted users`)
  } catch (error) {
    console.error(name, 'error collecting deleted user earnings:', error)
    throw error
  } finally {
    models.$disconnect().catch(console.error)
  }
}
