import { notifyNewStreak, notifyStreakLost } from '@/lib/webPush'

export async function pushNotification ({ data: { type, userId, streakId } }) {
  switch (type) {
    case 'horse-found': await notifyNewStreak(userId, { id: streakId, type: 'HORSE' }); break
    case 'horse-lost': await notifyStreakLost(userId, { id: streakId, type: 'HORSE' }); break
    case 'gun-found': await notifyNewStreak(userId, { id: streakId, type: 'GUN' }); break
    case 'gun-lost': await notifyStreakLost(userId, { id: streakId, type: 'GUN' }); break
  }
}
