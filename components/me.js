import React, { useContext } from 'react'
import { useQuery } from '@apollo/client'
import { ME } from '../fragments/users'

export const MeContext = React.createContext({
  me: null
})

export function MeProvider ({ me, children }) {
  const { data } = useQuery(ME, { pollInterval: 1000 })

  const contextValue = {
    me: data ? data.me : me
  }

  return (
    <MeContext.Provider value={contextValue}>
      {children}
    </MeContext.Provider>
  )
}

export function useMe () {
  const { me } = useContext(MeContext)
  return me
}
