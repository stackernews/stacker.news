import useSWR from 'swr'

const fetcher = url => fetch(url).then(res => res.json())

export default function Price () {
  const { data } = useSWR(
    'https://api.coinbase.com/v2/prices/BTC-USD/spot',
    fetcher,
    {
      refreshInterval: 30000
    })

  if (!data) return null

  return '$' + data.data.amount
}
