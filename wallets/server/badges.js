import { notifyNewStreak, notifyStreakLost } from '@/lib/webPush'

// Wallet badge + streak bookkeeping, kept out of the protocol-save resolver.
// `updateWalletBadges` runs inside the caller's transaction (it takes `tx`) and
// returns deferred push-notification thunks; the caller fires them with
// `sendWalletBadgeNotifications` only after the transaction commits.

function sendWalletBadgeNotifications (notifications = []) {
  return Promise.all(notifications.map(notify => Promise.resolve().then(notify))).catch(console.error)
}

// Run `fn` inside a transaction and fire its badge notifications only after the
// commit. `fn(tx)` returns `{ value, notifications }`; we return `value`. Keeps
// the "never push before commit" ordering in one place instead of every caller.
export async function commitWithBadgeNotifications (models, fn) {
  const { value, notifications } = await models.$transaction(fn)
  sendWalletBadgeNotifications(notifications)
  return value
}

// Recompute the user's has-recv/has-send badges from their current protocols and
// start/end the matching HORSE (recv) / GUN (send) streaks. Returns push thunks
// for any streak that just started or ended.
export async function updateWalletBadges ({ userId, tx }) {
  const pushNotifications = []

  // Lock the user row before reading the old badge state so concurrent saves for
  // the same user serialize here. Otherwise both read the pre-transition value and
  // each start a duplicate, never-reaped HORSE/GUN streak (no open-streak unique
  // constraint exists). Mirrors assertVaultKeyUnchanged's FOR UPDATE on users.
  const [{ hasRecvWallet: oldHasRecvWallet, hasSendWallet: oldHasSendWallet }] = await tx.$queryRaw`
    SELECT "hasRecvWallet", "hasSendWallet" FROM users WHERE id = ${userId} FOR UPDATE`

  const wallets = await tx.wallet.findMany({
    where: {
      userId
    },
    include: {
      protocols: true
    }
  })

  const newHasRecvWallet = wallets.some(({ protocols }) => protocols.some(({ send, enabled }) => !send && enabled))
  const newHasSendWallet = wallets.some(({ protocols }) => protocols.some(({ send, enabled }) => send && enabled))

  await tx.user.update({
    where: { id: userId },
    data: {
      hasRecvWallet: newHasRecvWallet,
      hasSendWallet: newHasSendWallet
    }
  })

  const startStreak = async (type) => {
    const streak = await tx.streak.create({
      data: { userId, type, startedAt: new Date() }
    })
    return streak.id
  }

  const endStreak = async (type) => {
    const [streak] = await tx.$queryRaw`
        UPDATE "Streak"
        SET "endedAt" = now(), updated_at = now()
        WHERE "userId" = ${userId}
        AND "type" = ${type}::"StreakType"
        AND "endedAt" IS NULL
        RETURNING "id"
      `
    return streak?.id
  }

  if (!oldHasRecvWallet && newHasRecvWallet) {
    const streakId = await startStreak('HORSE')
    if (streakId) pushNotifications.push(() => notifyNewStreak(userId, { type: 'HORSE', id: streakId }))
  }
  if (!oldHasSendWallet && newHasSendWallet) {
    const streakId = await startStreak('GUN')
    if (streakId) pushNotifications.push(() => notifyNewStreak(userId, { type: 'GUN', id: streakId }))
  }

  if (oldHasRecvWallet && !newHasRecvWallet) {
    const streakId = await endStreak('HORSE')
    if (streakId) pushNotifications.push(() => notifyStreakLost(userId, { type: 'HORSE', id: streakId }))
  }
  if (oldHasSendWallet && !newHasSendWallet) {
    const streakId = await endStreak('GUN')
    if (streakId) pushNotifications.push(() => notifyStreakLost(userId, { type: 'GUN', id: streakId }))
  }

  return pushNotifications
}
