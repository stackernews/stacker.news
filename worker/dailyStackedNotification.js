import createPrisma from '@/lib/create-prisma'
import { numWithUnits } from '@/lib/format'
// Import directly from web-push package
import webPush from 'web-push'

// Setup webPush config
const webPushEnabled = process.env.NODE_ENV === 'production' ||
  (process.env.VAPID_MAILTO && process.env.NEXT_PUBLIC_VAPID_PUBKEY && process.env.VAPID_PRIVKEY)

if (webPushEnabled) {
  webPush.setVapidDetails(
    process.env.VAPID_MAILTO,
    process.env.NEXT_PUBLIC_VAPID_PUBKEY,
    process.env.VAPID_PRIVKEY
  )
} else {
  console.warn('VAPID_* env vars not set, skipping webPush setup')
}

// This job runs daily to send notifications to active users about their daily stacked and spent sats
export async function dailyStackedNotification () {
  // grab a greedy connection
  const models = createPrisma({ connectionParams: { connection_limit: 1 } })

  try {
    // Get yesterday's date (UTC)
    const yesterday = new Date()
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const dateStr = yesterday.toISOString().split('T')[0]

    // First check that the data exists for yesterday
    const dateCheck = await models.$queryRaw`
      SELECT COUNT(*) as count FROM user_stats_days WHERE t::date = ${dateStr}::date
    `
    console.log(`Found ${dateCheck[0].count} total user_stats_days records for ${dateStr}`)

    // Get users who had activity yesterday and have notifications enabled
    const activeUsers = await models.$queryRaw`
      SELECT 
        usd."id" as "userId", 
        usd."msats_stacked" / 1000 as "sats_stacked", 
        usd."msats_spent" / 1000 as "sats_spent"
      FROM 
        user_stats_days usd
      JOIN 
        users u ON usd."id" = u.id
      WHERE 
        usd.t::date = ${dateStr}::date
        AND (usd."msats_stacked" > 0 OR usd."msats_spent" > 0)
        AND usd."id" IS NOT NULL
        AND u."noteDailyStacked" = true
    `

    console.log(`Found ${activeUsers.length} active users with statistics for ${dateStr}`)
    
    // If no active users, exit early
    if (activeUsers.length === 0) {
      console.log('No active users found, exiting')
      return
    }
    
    // Send notifications to each active user
    await Promise.all(activeUsers.map(async user => {
      try {
        // Use integer values for sats
        const satsStacked = Math.floor(Number(user.sats_stacked))
        const satsSpent = Math.floor(Number(user.sats_spent))
        
        // Format the stacked and spent amounts
        const stackedFormatted = numWithUnits(satsStacked, { abbreviate: false })
        const spentFormatted = numWithUnits(satsSpent, { abbreviate: false })
        
        // Create title with summary
        let title = ''
        
        if (satsStacked > 0 && satsSpent > 0) {
          title = `Yesterday you stacked ${stackedFormatted} and spent ${spentFormatted}`
        } else if (satsStacked > 0) {
          title = `Yesterday you stacked ${stackedFormatted}`
        } else if (satsSpent > 0) {
          title = `Yesterday you spent ${spentFormatted}`
        } else {
          // This shouldn't happen based on our query, but just to be safe
          return
        }
        
        // Calculate net change
        const netChange = satsStacked - satsSpent
        let body = ''
        
        if (netChange > 0) {
          body = `Net gain: ${numWithUnits(netChange, { abbreviate: false })}`
        } else if (netChange < 0) {
          body = `Net loss: ${numWithUnits(Math.abs(netChange), { abbreviate: false })}`
        } else {
          body = 'Net change: 0 sats'
        }
        
        // Get user's push subscriptions directly
        const subscriptions = await models.pushSubscription.findMany({
          where: { 
            userId: user.userId,
            user: { noteDailyStacked: true } 
          }
        })
        
        // Create notification payload
        const payload = JSON.stringify({
          title,
          options: {
            body,
            timestamp: Date.now(),
            icon: '/icons/icon_x96.png',
            tag: 'DAILY_SUMMARY',
            data: {
              stacked: satsStacked,
              spent: satsSpent,
              net: netChange
            }
          }
        })
        
        // Send notifications directly to each subscription
        if (subscriptions.length > 0) {
          console.log(`Sending ${subscriptions.length} notifications to user ${user.userId}`)
          
          // Check for required VAPID settings
          if (!webPushEnabled) {
            console.warn(`Skipping notifications for user ${user.userId} - webPush not configured`)
            return
          }
          
          await Promise.allSettled(
            subscriptions.map(subscription => {
              const { endpoint, p256dh, auth } = subscription
              console.log(`Sending notification to endpoint: ${endpoint.substring(0, 30)}...`)
              return webPush.sendNotification({ endpoint, keys: { p256dh, auth } }, payload)
                .then(() => console.log(`Successfully sent notification to user ${user.userId}`))
                .catch(err => console.error(`Push error for user ${user.userId}:`, err))
            })
          )
        } else {
          console.log(`No push subscriptions found for user ${user.userId}`)
        }
      } catch (err) {
        console.error(`Error sending notification to user ${user.userId}:`, err)
      }
    }))

    console.log(`Sent daily stacked notifications to ${activeUsers.length} users`)
  } catch (err) {
    console.error('Error in dailyStackedNotification:', err)
  } finally {
    await models.$disconnect()
  }
}