import { createContext, useContext, useMemo } from 'react'
import { useQuery } from '@apollo/client/react'
import { PLATFORM_LIGHTNING_STATUS } from '@/fragments/platformLightning'

const PlatformLightningContext = createContext({
  available: true,
  message: null
})

export function PlatformLightningProvider ({ children }) {
  const { data } = useQuery(PLATFORM_LIGHTNING_STATUS, {
    pollInterval: 60_000,
    fetchPolicy: 'cache-and-network'
  })
  const value = useMemo(() => data?.platformLightningStatus ?? {
    available: true,
    message: null
  }, [data?.platformLightningStatus])

  return (
    <PlatformLightningContext.Provider value={value}>
      {children}
    </PlatformLightningContext.Provider>
  )
}

export const usePlatformLightning = () => useContext(PlatformLightningContext)
