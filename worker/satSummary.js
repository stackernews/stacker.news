import { notifySatSummary } from '@/lib/webPush'
export async function summarizeDailySats ({ data: { userId }, models }) {
  try {
    const stats = await models.$queryRaw`
      SELECT 
        sum(msats_stacked) as stacked, sum(msats_spent) as spent,
      FROM user_stats_days
      WHERE id = ${userId}
      AND t >= date_trunc('day', CURRENT_DATE - INTERVAL '1 day')
      AND t <= date_trunc('day', CURRENT_DATE)
      GROUP BY id
      HAVING sum(msats_stacked) != 0 OR sum(msats_spent) != 0
      LIMIT 1
    `

    if (stats.length) {
      await notifySatSummary({
        userId,
        satSummary: stats[0]
      })
    }
  } catch (err) {
    console.error('failed to process daily sat summary', err)
  }
}
