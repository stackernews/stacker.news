import { createContext, useContext, useMemo } from 'react'
import { useQuery } from '@apollo/client'
import { SSR } from '../lib/constants'
import { BLOCK_HEIGHT } from '../fragments/blockHeight'

export const BlockHeightContext = createContext({
  height: 0
})

export const useBlockHeight = () => useContext(BlockHeightContext)

export const BlockHeightProvider = ({ blockHeight, children }) => {
  const { data } = useQuery(BLOCK_HEIGHT, {
    ...(SSR
      ? {}
      : {
          pollInterval: 30000,
          nextFetchPolicy: 'cache-and-network'
        })
  })
  const value = useMemo(() => ({
    height: data?.blockHeight ?? blockHeight ?? 0
  }), [data, blockHeight])
  return (
    <BlockHeightContext.Provider value={value}>
      {children}
    </BlockHeightContext.Provider>
  )
}
