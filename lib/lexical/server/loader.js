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
  return new DataLoader(async (texts) => {
    return Promise.all(
      texts.map(text =>
        prepareLexicalState({ text })
          .catch(error => {
            console.error('error preparing Lexical State:', error)
            return null
          })
      )
    )
  })
}
