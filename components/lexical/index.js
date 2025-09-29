import { LexicalPreferencesContextProvider } from '@/components/lexical/contexts/preferences'
import Editor from '@/components/lexical/editor'
import Reader from '@/components/lexical/reader'

export default function SNLexical ({ type = 'editor', ...props }) {
  return (
    <LexicalPreferencesContextProvider>
      {type === 'editor' ? <Editor {...props} /> : <Reader {...props} />}
    </LexicalPreferencesContextProvider>
  )
}
