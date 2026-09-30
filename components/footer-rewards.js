import { gql } from '@apollo/client'
import { useQuery } from '@apollo/client/react'
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

export default function Rewards ({ className }) {
  const { data } = useQuery(REWARDS, SSR ? { ssr: false } : { pollInterval: LONG_POLL_INTERVAL_MS, nextFetchPolicy: 'cache-and-network' })
  const total = data?.rewards?.[0]?.total
  const time = data?.rewards?.[0]?.time
  return (
    <Link href='/rewards' className={className}>
      {total ? <span><RewardLine total={total} time={time} /></span> : 'rewards'}
    </Link>
  )
}
