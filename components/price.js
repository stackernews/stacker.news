import React, { useContext, useMemo } from 'react'
import { useQuery } from '@apollo/client'
import { fixedDecimal } from '@/lib/format'
import { useMe } from './me'
import { PRICE } from '@/fragments/price'
import { CURRENCY_SYMBOLS } from '@/lib/currency'
import { NORMAL_POLL_INTERVAL, SSR } from '@/lib/constants'
import { useBlockHeight } from './block-height'
import { useChainFee } from './chain-fee'
import { CompactLongCountdown } from './countdown'
import { usePriceCarousel } from './nav/price-carousel'

export const PriceContext = React.createContext({
  price: null,
  fiatSymbol: null
})

export function usePrice () {
  return useContext(PriceContext)
}

export function PriceProvider ({ price, children }) {
  const { me } = useMe()
  const fiatCurrency = me?.privates?.fiatCurrency
  const { data } = useQuery(PRICE, {
    variables: { fiatCurrency },
    ...(SSR
      ? {}
      : {
          pollInterval: NORMAL_POLL_INTERVAL,
          nextFetchPolicy: 'cache-and-network'
        })
  })

  const contextValue = useMemo(() => ({
    price: data?.price || price,
    fiatSymbol: CURRENCY_SYMBOLS[fiatCurrency] || '$'
  }), [data?.price, price, me?.privates?.fiatCurrency])

  return (
    <PriceContext.Provider value={contextValue}>
      {children}
    </PriceContext.Provider>
  )
}

export default function Price ({ className }) {
  const [selection, handleClick] = usePriceCarousel()

  const { price, fiatSymbol } = usePrice()
  const { height: blockHeight, halving } = useBlockHeight()
  const { fee: chainFee } = useChainFee()

  const compClassName = (className || '') + ' text-reset pointer'

  if (selection === 'yep') {
    if (!price || price < 0) return null
    return (
      <div className={compClassName} onClick={handleClick} variant='link'>
        {fixedDecimal(100000000 / price, 0) + ` sats/${fiatSymbol}`}
      </div>
    )
  }

  if (selection === '1btc') {
    return (
      <div className={compClassName} onClick={handleClick} variant='link'>
        1sat=1sat
      </div>
    )
  }

  if (selection === 'blockHeight') {
    if (blockHeight <= 0) return null
    return (
      <div className={compClassName} onClick={handleClick} variant='link'>
        {blockHeight}
      </div>
    )
  }

  if (selection === 'halving') {
    if (!halving) return null
    return (
      <div className={compClassName} onClick={handleClick} variant='link'>
        <CompactLongCountdown date={halving} />
      </div>
    )
  }

  if (selection === 'chainFee') {
    if (chainFee <= 0) return null
    return (
      <div className={compClassName} onClick={handleClick} variant='link'>
        {chainFee} sat/vB
      </div>
    )
  }

  if (selection === 'fiat') {
    if (!price || price < 0) return null
    return (
      <div className={compClassName} onClick={handleClick} variant='link'>
        {fiatSymbol + fixedDecimal(price, 0)}
      </div>
    )
  }
}
