import { gql, useQuery } from '@apollo/client'
import Link from 'next/link'
import { RewardLine } from '../pages/rewards'
import { SSR } from '../lib/constants'

const REWARDS = gql`
{
  rewards {
    total
  }
}`

export default function Rewards () {
  const { data } = useQuery(REWARDS, SSR ? { ssr: false } : { pollInterval: 60000, nextFetchPolicy: 'cache-and-network' })
  const total = data?.rewards?.total

  return (
    <Link href='/rewards' className='nav-link p-0 p-0 d-inline-flex'>
      {total ? <span><RewardLine total={total} /></span> : 'rewards'}
    </Link>
  )
}
