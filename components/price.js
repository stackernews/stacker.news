import React, { useContext, useEffect, useState } from 'react'
import { useQuery } from '@apollo/client'
import { fixedDecimal } from '../lib/format'
import { useMe } from './me'
import { PRICE } from '../fragments/price'
import { CURRENCY_SYMBOLS } from '../lib/currency'
import { SSR } from '../lib/constants'
import { useBlockHeight } from './block-height'

export const PriceContext = React.createContext({
  price: null,
  fiatSymbol: null
})

export function usePrice () {
  return useContext(PriceContext)
}

export function PriceProvider ({ price, children }) {
  const me = useMe()
  const fiatCurrency = me?.fiatCurrency
  const { data } = useQuery(PRICE, {
    variables: { fiatCurrency },
    ...(SSR
      ? {}
      : {
          pollInterval: 30000,
          nextFetchPolicy: 'cache-and-network'
        })
  })

  const contextValue = {
    price: data?.price || price,
    fiatSymbol: CURRENCY_SYMBOLS[fiatCurrency] || '$'
  }

  return (
    <PriceContext.Provider value={contextValue}>
      {children}
    </PriceContext.Provider>
  )
}

export default function Price ({ className }) {
  const [asSats, setAsSats] = useState(undefined)
  useEffect(() => {
    setAsSats(window.localStorage.getItem('asSats'))
  }, [])
  const { price, fiatSymbol } = usePrice()
  const { height: blockHeight } = useBlockHeight()

  if (!price || price < 0 || blockHeight <= 0) return null

  // Options: yep, 1btc, blockHeight, undefined
  // yep -> 1btc -> blockHeight -> undefined -> yep
  const handleClick = () => {
    if (asSats === 'yep') {
      window.localStorage.setItem('asSats', '1btc')
      setAsSats('1btc')
    } else if (asSats === '1btc') {
      window.localStorage.setItem('asSats', 'blockHeight')
      setAsSats('blockHeight')
    } else if (asSats === 'blockHeight') {
      window.localStorage.removeItem('asSats')
      setAsSats(undefined)
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

  return (
    <div className={compClassName} onClick={handleClick} variant='link'>
      {fiatSymbol + fixedDecimal(price, 0)}
    </div>
  )
}
