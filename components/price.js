import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@apollo/client'
import { fixedDecimal } from '@/lib/format'
import { useMe } from './me'
import { PRICE } from '@/fragments/price'
import { CURRENCY_SYMBOLS } from '@/lib/currency'
import { NORMAL_POLL_INTERVAL, SSR } from '@/lib/constants'
import { useBlockHeight } from './block-height'
import { useChainFee } from './chain-fee'

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
  const [asSats, setAsSats] = useState(undefined)
  useEffect(() => {
    const satSelection = window.localStorage.getItem('asSats')
    setAsSats(satSelection ?? 'fiat')
  }, [])

  const { price, fiatSymbol } = usePrice()
  const { height: blockHeight } = useBlockHeight()
  const { fee: chainFee } = useChainFee()

  if (!price || price < 0 || blockHeight <= 0 || chainFee <= 0) return null

  // Options: yep, 1btc, blockHeight, undefined
  // yep -> 1btc -> blockHeight -> chainFee -> undefined -> yep
  const handleClick = () => {
    if (asSats === 'yep') {
      window.localStorage.setItem('asSats', '1btc')
      setAsSats('1btc')
    } else if (asSats === '1btc') {
      window.localStorage.setItem('asSats', 'blockHeight')
      setAsSats('blockHeight')
    } else if (asSats === 'blockHeight') {
      window.localStorage.setItem('asSats', 'chainFee')
      setAsSats('chainFee')
    } else if (asSats === 'chainFee') {
      window.localStorage.removeItem('asSats')
      setAsSats('fiat')
    } else {
      window.localStorage.setItem('asSats', 'yep')
      setAsSats('yep')
    }
  }

  const compClassName = (className || '') + ' text-reset pointer'

  if (asSats === 'yep') {
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
    return (
      <div className={compClassName} onClick={handleClick} variant='link'>
        {blockHeight}
      </div>
    )
  }

  if (asSats === 'chainFee') {
    return (
      <div className={compClassName} onClick={handleClick} variant='link'>
        {chainFee} sat/vB
      </div>
    )
  }

  if (asSats === 'fiat') {
    return (
      <div className={compClassName} onClick={handleClick} variant='link'>
        {fiatSymbol + fixedDecimal(price, 0)}
      </div>
    )
  }
}
