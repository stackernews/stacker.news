import DataLoader from 'dataloader'
import { prepareLexicalState } from '@/lib/lexical/server/interpolator'
import { DEFAULT_POSTS_SATS_FILTER, DEFAULT_COMMENTS_SATS_FILTER } from '@/lib/constants'

/**
 * creates a DataLoader that batches lexical state requests
 *
 * when multiple resolvers request the same text (e.g., for both lexicalState and html fields),
 * DataLoader ensures we only compute the state once per unique text within the same tick.
 *
 * when item fields (userId, parentId, netInvestment) are provided in the context,
 * computes outlawed status based on the viewer's sat filter settings vs the item's netInvestment.
 *
 * @param {Object} [params] - optional parameters
 * @param {Object} [params.me] - the current viewer from the request context
 * @param {DataLoader} [params.userLoader] - DataLoader for user lookups
 * @returns {DataLoader} DataLoader for lexical state
 */
export function lexicalStateLoader ({ me, userLoader } = {}) {
  async function getUserFilters () {
    if (!me || !userLoader) {
      return {
        postsSatsFilter: DEFAULT_POSTS_SATS_FILTER,
        commentsSatsFilter: DEFAULT_COMMENTS_SATS_FILTER,
        showImagesAndVideos: true
      }
    }
    const user = await userLoader.load(me.id)
    return {
      postsSatsFilter: user?.postsSatsFilter ?? DEFAULT_POSTS_SATS_FILTER,
      commentsSatsFilter: user?.commentsSatsFilter ?? DEFAULT_COMMENTS_SATS_FILTER,
      showImagesAndVideos: user?.showImagesAndVideos ?? true
    }
  }

  return new DataLoader(
    async (keys) => {
      const userFilters = await getUserFilters()
      return Promise.all(
        keys.map(({ text, context }) => {
          const { userId, parentId, netInvestment, ...rest } = context || {}
          let outlawed = false
          if (netInvestment !== undefined) {
            const threshold = parentId ? userFilters.commentsSatsFilter : userFilters.postsSatsFilter
            outlawed = me?.id !== userId && (netInvestment ?? 0) < threshold
          }
          // filter out media if the user has disabled them
          const showImagesAndVideos = userFilters.showImagesAndVideos
          return prepareLexicalState({ text, context: { ...rest, outlawed, showImagesAndVideos } })
            .catch(error => {
              console.error('error preparing Lexical State:', error)
              return null
            })
        })
      )
    },
    {
      cacheKeyFn: ({ text, context }) => {
        const { imgproxyUrls, rel, userId, parentId, netInvestment } = context || {}
        return JSON.stringify({ text, imgproxyUrls, rel, userId, parentId, netInvestment })
      }
    }
  )
}
