import React, { useContext, useEffect, useState } from 'react'
import { Button } from 'react-bootstrap'
import useSWR from 'swr'

const fetcher = url => fetch(url).then(res => res.json())

export const PriceContext = React.createContext({
  price: null
})

const ENDPOINT = 'https://api.coinbase.com/v2/prices/BTC-USD/spot'

export async function getPrice () {
  const data = await fetcher(ENDPOINT)
  return data?.data?.amount
}

export function PriceProvider ({ price, children }) {
  const { data } = useSWR(
    ENDPOINT,
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

  if (!price) return null

  const fixed = (n, f) => Number.parseFloat(n).toFixed(f)
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
      <Button className='text-reset p-0' onClick={handleClick} variant='link'>
        {fixed(100000000 / price, 0) + ' sats/$'}
      </Button>
    )
  }

  if (asSats === '1btc') {
    return (
      <Button className='text-reset p-0' onClick={handleClick} variant='link'>
        1sat=1sat
      </Button>
    )
  }

  return (
    <Button className='text-reset p-0' onClick={handleClick} variant='link'>
      {'$' + fixed(price, 0)}
    </Button>
  )
}
