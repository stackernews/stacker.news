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
      <button className={compClassName} onClick={handleClick} variant='link' aria-label='Show 1 satoshi equals 1 satoshi'>
        {fixedDecimal(100000000 / price, 0) + ` sats/${fiatSymbol}`}
      </button>
    )
  }

  if (selection === '1btc') {
    return (
      <button className={compClassName} onClick={handleClick} variant='link' aria-label='Show blockheight'>
        1sat=1sat
      </button>
    )
  }

  if (selection === 'blockHeight') {
    if (blockHeight <= 0) return null
    return (
      <button className={compClassName} onClick={handleClick} variant='link' aria-label='Show fee rate'>
        {blockHeight}
      </button>
    )
  }

  if (selection === 'halving') {
    if (!halving) return null
    return (
      <button className={compClassName} onClick={handleClick} variant='link' aria-label='Show fiat price'>
        <CompactLongCountdown date={halving} />
      </button>
    )
  }

  if (selection === 'chainFee') {
    if (chainFee <= 0) return null
    return (
      <button className={compClassName} onClick={handleClick} variant='link' aria-label='Show time until halving'>
        {chainFee} sat/vB
      </button>
    )
  }

  if (selection === 'fiat') {
    if (!price || price < 0) return null
    return (
      <button className={compClassName} onClick={handleClick} variant='link' aria-label='Show price in satoshis per fiat unit'>
        {fiatSymbol + fixedDecimal(price, 0)}
      </button>
    )
  }
}
