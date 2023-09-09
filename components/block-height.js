import { createContext, useContext } from 'react'
import { useQuery } from '@apollo/client'
import { SSR } from '../lib/constants'
import { BLOCK_HEIGHT } from '../fragments/block-height'

export const BlockHeightContext = createContext({
  height: 0
})

export const useBlockHeight = () => useContext(BlockHeightContext)

export const BlockHeightProvider = ({ children }) => {
  const { data } = useQuery(BLOCK_HEIGHT, {
    ...(SSR
      ? {}
      : {
          pollInterval: 30000,
          nextFetchPolicy: 'cache-and-network'
        })
  })
  const value = {
    height: data?.blockHeight ?? 0
  }
  return (
    <BlockHeightContext.Provider value={value}>
      {children}
    </BlockHeightContext.Provider>
  )
}
