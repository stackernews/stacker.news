import React, { useContext, useEffect, useState } from 'react'
import { useQuery } from '@apollo/client'
import { Button } from 'react-bootstrap'
import { fixedDecimal } from '../lib/format'
import { useMe } from './me'
import { PRICE } from '../fragments/price'

export const PriceContext = React.createContext({
  price: null,
  fiatSymbol: null
})

export const CURRENCY_SYMBOLS = {
  AUD: '$',
  CAD: '$',
  EUR: '€',
  GBP: '£',
  USD: '$',
  NZD: '$',
  ZAR: 'R '
}

export function usePrice () {
  return useContext(PriceContext)
}

export function PriceProvider ({ price, children }) {
  const me = useMe()
  const fiatCurrency = me?.fiatCurrency;
  const { data } = useQuery(PRICE, { variables: { fiatCurrency }, pollInterval: 1000, fetchPolicy: 'cache-and-network' })

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

export default function Price () {
  const [asSats, setAsSats] = useState(undefined)
  useEffect(() => {
    setAsSats(localStorage.getItem('asSats'))
  }, [])
  const { price, fiatSymbol } = usePrice()

  if (!price) return null

  const handleClick = () => {
    if (asSats === 'yep') {
      localStorage.setItem('asSats', '1btc')
      setAsSats('1btc')
    } else if (asSats === '1btc') {
      localStorage.removeItem('asSats')
      setAsSats(undefined)
    } else {
      localStorage.setItem('asSats', 'yep')
      setAsSats('yep')
    }
  }

  if (asSats === 'yep') {
    return (
      <Button className='text-reset p-0 line-height-1' onClick={handleClick} variant='link'>
        {fixedDecimal(100000000 / price, 0) + ` sats/${fiatSymbol}`}
      </Button>
    )
  }

  if (asSats === '1btc') {
    return (
      <Button className='text-reset p-0 line-height-1' onClick={handleClick} variant='link'>
        1sat=1sat
      </Button>
    )
  }

  return (
    <Button className='text-reset p-0 line-height-1' onClick={handleClick} variant='link'>
      {fiatSymbol + fixedDecimal(price, 0)}
    </Button>
  )
}
