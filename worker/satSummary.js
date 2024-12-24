import { notifySatSummary } from '@/lib/webPush'
import { msatsToSats } from '@/lib/format'
export async function dailySatSummary ({ models }) {
  try {
    const stats = await models.$queryRaw`
      SELECT 
        id as userId, sum(msats_stacked) as stacked, sum(msats_spent) as spent
      FROM user_stats_days
      WHERE t >= date_trunc('day', CURRENT_DATE - INTERVAL '1 day')
      AND t <= date_trunc('day', CURRENT_DATE)
      GROUP BY id
      HAVING sum(msats_stacked) != 0 OR sum(msats_spent) != 0
    `

    if (stats.length) {
      for (const stat of stats) {
        const user = await models.user.findUnique({ where: { id: stat.userid } })
        if (user && user.noteSatSummary) {
          await notifySatSummary(
            stat.userid,
            (stats.stacked && msatsToSats(stats.stacked)) || 0,
            (stats.spent && msatsToSats(stats.spent)) || 0
          )
        }
      }
    }
  } catch (err) {
    console.error('failed to process daily sat summary', err)
  }
}
