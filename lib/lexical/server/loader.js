import DataLoader from 'dataloader'
import { prepareLexicalState } from '@/lib/lexical/server/interpolator'

/**
 * creates a DataLoader that batches lexical state requests
 *
 * when multiple resolvers request the same text (e.g., for both lexicalState and html fields),
 *
 * DataLoader ensures we only compute the state once per unique text within the same tick.
 *
 * @returns {DataLoader} DataLoader for lexical state
 */
export function lexicalStateLoader () {
  return new DataLoader(
    async (keys) => {
      return Promise.all(
        keys.map(({ text, context }) =>
          prepareLexicalState({ text, context })
            .catch(error => {
              console.error('error preparing Lexical State:', error)
              return null
            })
        )
      )
    },
    {
      cacheKeyFn: ({ text, context }) => {
        const { outlawed, imgproxyUrls, rel } = context || {}
        return JSON.stringify({ text, outlawed, imgproxyUrls, rel })
      }
    }
  )
}
