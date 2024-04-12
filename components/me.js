import React, { useContext } from 'react'
import { useQuery } from '@apollo/client'
import { ME } from '@/fragments/users'
import { FAST_POLL_INTERVAL, SSR } from '@/lib/constants'

export const MeContext = React.createContext({
  me: null
})

export function MeProvider ({ me, children }) {
  const { data } = useQuery(ME, SSR ? {} : { pollInterval: FAST_POLL_INTERVAL, nextFetchPolicy: 'cache-and-network' })

  return (
    <MeContext.Provider value={data?.me || me}>
      {children}
    </MeContext.Provider>
  )
}

export function useMe () {
  return useContext(MeContext)
}
