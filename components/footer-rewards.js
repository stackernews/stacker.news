import { gql, useQuery } from '@apollo/client'
import Link from 'next/link'
import { RewardLine } from '@/pages/rewards'
import { LONG_POLL_INTERVAL_MS, SSR } from '@/lib/constants'

const REWARDS = gql`
{
  rewards {
    total
    time
  }
}`

export default function Rewards () {
  const { data } = useQuery(REWARDS, SSR ? { ssr: false } : { pollInterval: LONG_POLL_INTERVAL_MS, nextFetchPolicy: 'cache-and-network' })
  const total = data?.rewards?.[0]?.total
  const time = data?.rewards?.[0]?.time
  return (
    <Link href='/rewards' className='nav-link p-0 p-0 d-inline-flex'>
      {total ? <span><RewardLine total={total} time={time} /></span> : 'rewards'}
    </Link>
  )
}
