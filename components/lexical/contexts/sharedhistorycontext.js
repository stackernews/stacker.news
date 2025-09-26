import { createContext, useContext, useMemo } from 'react'
import { createEmptyHistoryState } from '@lexical/react/LexicalHistoryPlugin'

const SharedHistoryContext = createContext({
  historyState: null
})

export const SharedHistoryContextProvider = ({ children }) => {
  const historyContext = useMemo(() => ({ historyState: createEmptyHistoryState() }), [])

  return (
    <SharedHistoryContext.Provider value={historyContext}>
      {children}
    </SharedHistoryContext.Provider>
  )
}

export const useSharedHistoryContext = () => {
  return useContext(SharedHistoryContext)
}
