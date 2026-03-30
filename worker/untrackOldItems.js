import { datePivot } from '@/lib/time'

// deletes from commentsViewAt items that were never viewed and had no comments in the last 21 days
export async function untrackOldItems ({ models }) {
  const pivot = datePivot(new Date(), { days: -21 })

  await models.commentsViewAt.deleteMany({
    where: {
      AND: [
        // delete if never viewed in the last 21 days
        { lastViewedAt: { lt: pivot } },
        // AND if the item had no comments in the last 21 days
        {
          OR: [
            { item: { lastCommentAt: { lt: pivot } } },
            { item: { lastCommentAt: null, createdAt: { lt: pivot } } }
          ]
        }
      ]
    }
  })
}
