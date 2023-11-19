import React, { useContext, useMemo } from 'react'
import { useQuery } from '@apollo/client'
import { ME } from '../fragments/users'
import { SSR } from '../lib/constants'

export const MeContext = React.createContext({
  me: null
})

export function MeProvider ({ me, children }) {
  const { data } = useQuery(ME, SSR ? {} : { pollInterval: 1000, nextFetchPolicy: 'cache-and-network' })
  const futureMe = data?.me || me

  const contextValue = useMemo(() => ({
    me: futureMe
      ? { ...futureMe, ...futureMe.privates, ...futureMe.optional }
      : null
  }), [me, data])

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
