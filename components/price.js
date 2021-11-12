import { useEffect, useState } from 'react'
import { Button } from 'react-bootstrap'
import useSWR from 'swr'

const fetcher = url => fetch(url).then(res => res.json())

export default function Price ({ onReady }) {
  const [asSats, setAsSats] = useState(undefined)
  useEffect(() => {
    setAsSats(localStorage.getItem('asSats'))
  }, [])

  const { data } = useSWR(
    'https://api.coinbase.com/v2/prices/BTC-USD/spot',
    fetcher,
    {
      refreshInterval: 30000
    })

  useEffect(() => {
    if (onReady) {
      onReady()
    }
  }, [data])

  if (!data || !data.data) return null

  const fixed = (n, f) => Number.parseFloat(n).toFixed(f)
  const handleClick = () => {
    if (asSats) {
      localStorage.removeItem('asSats')
      setAsSats(undefined)
    } else {
      localStorage.setItem('asSats', 'yep')
      setAsSats('yep')
    }
  }

  if (asSats) {
    return (
      <Button className='text-reset px-1 py-0' onClick={handleClick} variant='link'>
        {fixed(100000000 / data.data.amount, 0) + ' sats/$'}
      </Button>
    )
  }

  return (
    <Button className='text-reset px-1 py-0' onClick={handleClick} variant='link'>
      {'$' + fixed(data.data.amount, 2)}
    </Button>
  )
}
