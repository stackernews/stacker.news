import { createContext, useContext, useMemo } from 'react'
import { useQuery } from '@apollo/client'
import { SSR } from '../lib/constants'
import { CHAIN_FEE } from '../fragments/chainFee'

export const ChainFeeContext = createContext({
  fee: 0
})

export const useChainFee = () => useContext(ChainFeeContext)

export const ChainFeeProvider = ({ chainFee, children }) => {
  const { data } = useQuery(CHAIN_FEE, {
    ...(SSR
      ? {}
      : {
          pollInterval: 30000,
          nextFetchPolicy: 'cache-and-network'
        })
  })
  const value = useMemo(() => ({
    fee: Math.floor(data?.chainFee ?? chainFee ?? 0)
  }), [data, chainFee])
  return (
    <ChainFeeContext.Provider value={value}>
      {children}
    </ChainFeeContext.Provider>
  )
}
