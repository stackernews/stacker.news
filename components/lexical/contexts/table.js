import { createContext, useState, useMemo, useContext } from 'react'

export const TableContext = createContext({
  cellConfig: null,
  cellPlugins: null,
  setCellConfig: () => {}
})

export function TableContextProvider ({ children }) {
  const [contextValue, setContextValue] = useState({
    cellConfig: null,
    cellPlugins: null
  })

  const value = useMemo(() => {
    return {
      cellConfig: contextValue.cellConfig,
      cellPlugins: contextValue.cellPlugins,
      set: (cellConfig, cellPlugins) => {
        setContextValue({ cellConfig, cellPlugins })
      }
    }
  }, [contextValue.cellConfig, contextValue.cellPlugins])

  return (
    <TableContext.Provider value={value}>
      {children}
    </TableContext.Provider>
  )
}

export function useTableContext () {
  return useContext(TableContext)
}
