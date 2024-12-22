import { notifyDailyStats } from '@/lib/webPush'
export async function summarizeDailySats ({ data: { userId }, models }) {
  let dailyStats
  try {
    dailyStats = await models.dailyStats.findUnique({ where: { id: userId } })
  } catch (err) {
    console.error('failed to lookup daily stats by user', err)
  }
  try {
    await notifyDailyStats({ userId, dailyStats })
  } catch (err) {
    console.error('failed to send push notification for daily stats', err)
  }
}
