import { useState } from 'react'
import { Button } from 'react-bootstrap'
import useSWR from 'swr'

const fetcher = url => fetch(url).then(res => res.json())

export default function Price () {
  const [asSats, setAsSats] = useState(false)

  const { data } = useSWR(
    'https://api.coinbase.com/v2/prices/BTC-USD/spot',
    fetcher,
    {
      refreshInterval: 30000
    })

  if (!data) return null

  const fixed = n => Number.parseFloat(n).toFixed(2)
  const handleClick = () => setAsSats(!asSats)
  if (asSats) {
    return (
      <Button className='text-reset' onClick={handleClick} variant='link'>
        {fixed(100000000 / data.data.amount) + ' sats/$'}
      </Button>
    )
  }

  return (
    <Button className='text-reset' onClick={handleClick} variant='link'>
      {'$' + fixed(data.data.amount)}
    </Button>
  )
}
