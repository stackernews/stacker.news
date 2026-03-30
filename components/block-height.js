import { createContext, useContext, useMemo } from 'react'
import { useQuery } from '@apollo/client'
import { NORMAL_POLL_INTERVAL_MS, SSR } from '@/lib/constants'
import { BLOCK_HEIGHT } from '@/fragments/blockHeight'
import { datePivot } from '@/lib/time'

export const BlockHeightContext = createContext({
  height: 0,
  halving: null
})

export const useBlockHeight = () => useContext(BlockHeightContext)

const HALVING_INTERVAL = 210000

export const BlockHeightProvider = ({ blockHeight, children }) => {
  const { data } = useQuery(BLOCK_HEIGHT, {
    ...(SSR
      ? {}
      : {
          pollInterval: NORMAL_POLL_INTERVAL_MS,
          nextFetchPolicy: 'cache-and-network'
        })
  })
  const value = useMemo(() => {
    if (!data?.blockHeight) {
      return {
        height: blockHeight ?? 0,
        halving: null
      }
    }

    const remainingBlocks = HALVING_INTERVAL - (data.blockHeight % HALVING_INTERVAL)
    const minutesUntilHalving = remainingBlocks * 10
    const halving = datePivot(new Date(), { minutes: minutesUntilHalving })

    return {
      height: data.blockHeight,
      halving
    }
  }, [data?.blockHeight, blockHeight])
  return (
    <BlockHeightContext.Provider value={value}>
      {children}
    </BlockHeightContext.Provider>
  )
}
