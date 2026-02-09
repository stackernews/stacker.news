import { FREE_COMMENTS_PER_MONTH, USER_ID } from '@/lib/constants'
import { Prisma } from '@prisma/client'

// Get the first day of next month at midnight UTC
export function getNextMonthStart () {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0))
}

// Check if user can create a free comment (has remaining monthly allowance)
export function canCreateFreeComment (user) {
  // Reset counter if past reset date
  if (user.freeCommentResetAt && new Date() >= new Date(user.freeCommentResetAt)) {
    // Counter will be reset, user can create free comment
    return true
  }
  return (user.freeCommentCount || 0) < FREE_COMMENTS_PER_MONTH
}

/**
 * Check if the item qualifies as a freebie
 * @param {Object} models - Prisma models
 * @param {Object} params - { mcost, baseMcost, parentId, bio, boost }
 * @param {Object} context - { me } with me.id
 * @returns {Promise<boolean>} - true if item should be free
 */
export async function checkFreebieEligibility (models, { mcost, baseMcost, parentId, bio, boost = 0 }, { me }) {
  // Only comments and bios can be freebies
  if (!parentId && !bio) return false

  // Cost must not exceed base cost (no spam multiplier)
  if (mcost > baseMcost) return false

  // Anon users can't get freebies
  if (me.id === USER_ID.anon) return false

  // Can't have boost
  if (boost > 0) return false

  // Fetch user data since me only has { id }
  const user = await models.user.findUnique({
    where: { id: me.id },
    select: { msats: true, mcredits: true, hasSendWallet: true, freeCommentCount: true, freeCommentResetAt: true }
  })

  // Must not be able to afford the cost
  const cantAfford = user.msats + user.mcredits < mcost
  if (!cantAfford) return false

  // Can't have a send wallet attached
  if (user.hasSendWallet) return false

  // For comments (not bio), check monthly limit
  if (!bio && !canCreateFreeComment(user)) return false

  return true
}

/**
 * Increment user's free comment counter after creating a freebie comment
 * @param {Object} tx - Prisma transaction
 * @param {Object} params - { item, userId }
 */
export async function incrementFreeCommentCount (tx, { item, userId }) {
  // Only increment for freebie comments (not bios), and not for anon
  if (!item.freebie || !item.parentId || userId === USER_ID.anon) return

  const user = await tx.user.findUnique({ where: { id: userId } })
  const now = new Date()
  const needsReset = user.freeCommentResetAt && now >= new Date(user.freeCommentResetAt)

  try {
    // these optimistic updates prevent races between the freebie check (outside of this tx)
    // if another concurrent freebie snuck in reaching/resetting the limit,
    // this prevents this freebie from being created
    if (needsReset || !user.freeCommentResetAt) {
      await tx.user.update({
        where: {
          id: userId,
          freeCommentResetAt: user.freeCommentResetAt
        },
        data: {
          freeCommentCount: 1,
          freeCommentResetAt: getNextMonthStart()
        }
      })
    } else {
      await tx.user.update({
        where: {
          id: userId,
          freeCommentCount: { lt: FREE_COMMENTS_PER_MONTH }
        },
        data: {
          freeCommentCount: { increment: 1 }
        }
      })
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2025', 'P2034'].includes(error.code)) {
      throw new Error('no free comments left')
    }

    console.error('unexpected error', error)
    throw error
  }
}
