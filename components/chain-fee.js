import { createContext, useContext, useMemo } from 'react'
import { useQuery } from '@apollo/client'
import { NORMAL_POLL_INTERVAL, SSR } from '@/lib/constants'
import { CHAIN_FEE } from '@/fragments/chainFee'

export const ChainFeeContext = createContext({
  fee: 0
})

export const useChainFee = () => useContext(ChainFeeContext)

export const ChainFeeProvider = ({ chainFee, children }) => {
  const { data } = useQuery(CHAIN_FEE, {
    ...(SSR
      ? {}
      : {
          pollInterval: NORMAL_POLL_INTERVAL,
          nextFetchPolicy: 'cache-and-network'
        })
  })
  const value = useMemo(() => ({
    fee: Math.floor(data?.chainFee ?? chainFee ?? 0)
  }), [data?.chainFee, chainFee])
  return (
    <ChainFeeContext.Provider value={value}>
      {children}
    </ChainFeeContext.Provider>
  )
}
