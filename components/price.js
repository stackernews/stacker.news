import React, { useContext, useEffect, useState } from 'react'
import { Button } from 'react-bootstrap'
import useSWR from 'swr'
import { fixedDecimal } from '../lib/format'
import { useMe } from './me'

const fetcher = url => fetch(url).then(res => res.json()).catch()

export const PriceContext = React.createContext({
  price: null
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

const endpoint = (fiat) => `https://api.coinbase.com/v2/prices/BTC-${fiat ?? 'USD'}/spot`

export async function getPrice (fiat) {
  const data = await fetcher(endpoint(fiat))
  return data?.data?.amount
}

export function PriceProvider ({ price, children }) {
  const me = useMe()
  const { data } = useSWR(
    endpoint(me?.fiatCurrency),
    fetcher,
    {
      refreshInterval: 30000
    })

  const contextValue = {
    price: data?.data?.amount || price
  }

  return (
    <PriceContext.Provider value={contextValue}>
      {children}
    </PriceContext.Provider>
  )
}

export function usePrice () {
  const { price } = useContext(PriceContext)
  return price
}

export default function Price () {
  const [asSats, setAsSats] = useState(undefined)
  useEffect(() => {
    setAsSats(localStorage.getItem('asSats'))
  }, [])
  const price = usePrice()
  const me = useMe()
  const fiatSymbol = CURRENCY_SYMBOLS[me?.fiatCurrency || 'USD']

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
