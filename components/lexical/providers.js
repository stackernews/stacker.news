import { SharedHistoryContextProvider } from '@/components/lexical/contexts/sharedhistory'
import { ToolbarContextProvider } from '@/components/lexical/contexts/toolbar'
import { TableContextProvider } from '@/components/lexical/contexts/table'

export function LexicalEditorProviders ({ children }) {
  return (
    <SharedHistoryContextProvider>
      <ToolbarContextProvider>
        <TableContextProvider>
          {children}
        </TableContextProvider>
      </ToolbarContextProvider>
    </SharedHistoryContextProvider>
  )
}
