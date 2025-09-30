import { LexicalPreferencesContextProvider } from '@/components/lexical/contexts/preferences'
import Editor from '@/components/lexical/editor'
import Reader from '@/components/lexical/reader'

// lexical starting point, can be a reader or an editor
export default function SNLexical ({ reader = false, ...props }) {
  return (
    <LexicalPreferencesContextProvider>
      {reader
        ? <Reader {...props} />
        : <Editor {...props} />}
    </LexicalPreferencesContextProvider>
  )
}
