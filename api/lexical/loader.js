import DataLoader from 'dataloader'
import { prepareLexicalState } from '@/lib/lexical/server/interpolator'

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
