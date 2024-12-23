import { notifySatSummary } from '@/lib/webPush'
export async function summarizeDailySats ({ data: { userId }, models }) {
  let satSummary
  try {
    satSummary = await models.satSummary.findUnique({ where: { id: userId } })
  } catch (err) {
    console.error('failed to lookup daily stats by user', err)
  }
  try {
    await notifySatSummary({ userId, satSummary })
  } catch (err) {
    console.error('failed to send push notification for daily stats', err)
  }
}
