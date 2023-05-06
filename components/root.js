import { useContext, createContext } from 'react'

export const RootContext = createContext()

export function RootProvider ({ root, children }) {
  return (
    <RootContext.Provider value={root}>
      {children}
    </RootContext.Provider>
  )
}

export function useRoot () {
  return useContext(RootContext)
}
