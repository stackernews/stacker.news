import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@apollo/client'
import { fixedDecimal } from '@/lib/format'
import { useMe } from './me'
import { PRICE } from '@/fragments/price'
import { CURRENCY_SYMBOLS } from '@/lib/currency'
import { NORMAL_POLL_INTERVAL, SSR } from '@/lib/constants'
import { useBlockHeight } from './block-height'
import { useChainFee } from './chain-fee'
import { CompactLongCountdown } from './countdown'

export const PriceContext = React.createContext({
  price: null,
  fiatSymbol: null
})

export function usePrice () {
  return useContext(PriceContext)
}

export function PriceProvider ({ price, children }) {
  const me = useMe()
  const fiatCurrency = me?.privates?.fiatCurrency
  const { data, refetch } = useQuery(PRICE, {
    variables: { fiatCurrency },
    ...(SSR
      ? {}
      : {
          pollInterval: NORMAL_POLL_INTERVAL,
          nextFetchPolicy: 'cache-and-network'
        })
  });

  useEffect(() => {
    if (fiatCurrency) {
      refetch({ fiatCurrency });
    }
  }, [fiatCurrency, refetch]);
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

const STORAGE_KEY = 'asSats'
const DEFAULT_SELECTION = 'fiat'

const carousel = [
  'fiat',
  'yep',
  '1btc',
  'blockHeight',
  'chainFee',
  'halving'
]

export default function Price ({ className }) {
  const [asSats, setAsSats] = useState(undefined)
  const [pos, setPos] = useState(0)

  useEffect(() => {
    const selection = window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_SELECTION
    setAsSats(selection)
    setPos(carousel.findIndex((item) => item === selection))
  }, [])

  const { price, fiatSymbol } = usePrice()
  const { height: blockHeight, halving } = useBlockHeight()
  const { fee: chainFee } = useChainFee()

  const handleClick = () => {
    const nextPos = (pos + 1) % carousel.length

    window.localStorage.setItem(STORAGE_KEY, carousel[nextPos])
    setAsSats(carousel[nextPos])
    setPos(nextPos)
  }

  const compClassName = (className || '') + ' text-reset pointer'

  if (asSats === 'yep') {
    if (!price || price < 0) return null
    return (
      <div className={compClassName} onClick={handleClick} variant='link'>
        {fixedDecimal(100000000 / price, 0) + ` sats/${fiatSymbol}`}
      </div>
    )
  }

  if (asSats === '1btc') {
    return (
      <div className={compClassName} onClick={handleClick} variant='link'>
        1sat=1sat
      </div>
    )
  }

  if (asSats === 'blockHeight') {
    if (blockHeight <= 0) return null
    return (
      <div className={compClassName} onClick={handleClick} variant='link'>
        {blockHeight}
      </div>
    )
  }

  if (asSats === 'halving') {
    if (!halving) return null
    return (
      <div className={compClassName} onClick={handleClick} variant='link'>
        <CompactLongCountdown date={halving} />
      </div>
    )
  }

  if (asSats === 'chainFee') {
    if (chainFee <= 0) return null
    return (
      <div className={compClassName} onClick={handleClick} variant='link'>
        {chainFee} sat/vB
      </div>
    )
  }

  if (asSats === 'fiat') {
    if (!price || price < 0) return null
    return (
      <div className={compClassName} onClick={handleClick} variant='link'>
        {fiatSymbol + fixedDecimal(price, 0)}
      </div>
    )
  }
}
